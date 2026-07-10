
-- ================================================================
--  NodeLink — Complete Supabase SQL Schema
--  Tables: profiles, conversations, messages,
--          pinned_chats, notifications
--  Includes: indexes, RLS policies, triggers, helper functions,
--            storage buckets
-- ================================================================

-- ----------------------------------------------------------------
-- EXTENSIONS
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram search on username/name


-- ================================================================
-- 1. PROFILES
--    Source: RegisterUser.ts, UpdateUserData.ts, MyProfile.tsx,
--            UserProfile.tsx, SettingsScreen.tsx
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  wallet_address  TEXT          PRIMARY KEY,
  username        TEXT          UNIQUE NOT NULL
                                  CHECK (
                                    char_length(username) >= 3
                                    AND char_length(username) <= 50
                                    AND username ~ '^[a-zA-Z0-9_]+$'
                                  ),
  name            TEXT          NOT NULL
                                  CHECK (char_length(name) <= 100),
  bio             TEXT          DEFAULT 'Im not being spied on'
                                  CHECK (bio IS NULL OR char_length(bio) <= 500),
  avatar          TEXT          NOT NULL DEFAULT 'default',
  public_key      TEXT,                        -- E2E encryption public key
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower  ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_name_trgm       ON public.profiles USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm   ON public.profiles USING gin (username gin_trgm_ops);

-- Case-insensitive unique index to prevent usernames differing only by case
-- e.g. "JohnDoe" and "johndoe" should not both be allowed
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower_unique
  ON public.profiles (LOWER(username));

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);   -- profiles are public for search/discovery

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (public.auth_wallet() = wallet_address);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (public.auth_wallet() = wallet_address);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE
  USING (public.auth_wallet() = wallet_address);


-- ================================================================
-- 2. CONVERSATIONS
--    Source: ChatScreen.tsx (convo_{wallet} id pattern),
--            UserProfile.tsx (handleConnect), ChatContext
-- ================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id              TEXT          PRIMARY KEY
                                  DEFAULT ('convo_' || encode(gen_random_uuid()::bytea, 'hex')),
  participant_a   TEXT          NOT NULL REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,
  participant_b   TEXT          NOT NULL REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,                 -- updated by trigger on new message
  last_message    TEXT,                        -- preview text for ChatScreen list
  is_deleted_a    BOOLEAN       NOT NULL DEFAULT FALSE,   -- soft delete for participant_a
  is_deleted_b    BOOLEAN       NOT NULL DEFAULT FALSE,   -- soft delete for participant_b

  -- Guarantee no duplicate pairs (a,b) or (b,a) using generated columns
  participant_min TEXT GENERATED ALWAYS AS (LEAST(participant_a, participant_b)) STORED,
  participant_max TEXT GENERATED ALWAYS AS (GREATEST(participant_a, participant_b)) STORED,
  CONSTRAINT conversations_unique_pair UNIQUE (participant_min, participant_max)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_participant_a ON public.conversations (participant_a);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_b ON public.conversations (participant_b);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg_at   ON public.conversations (last_message_at DESC NULLS LAST);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Only participants can see a conversation
CREATE POLICY "conversations_select_participants"
  ON public.conversations FOR SELECT
  USING (
    public.auth_wallet() = participant_a
    OR public.auth_wallet() = participant_b
  );

CREATE POLICY "conversations_insert_participants"
  ON public.conversations FOR INSERT
  WITH CHECK (
    public.auth_wallet() = participant_a
    OR public.auth_wallet() = participant_b
  );

CREATE POLICY "conversations_update_participants"
  ON public.conversations FOR UPDATE
  USING (
    public.auth_wallet() = participant_a
    OR public.auth_wallet() = participant_b
  );

CREATE POLICY "conversations_delete_participants"
  ON public.conversations FOR DELETE
  USING (
    public.auth_wallet() = participant_a
    OR public.auth_wallet() = participant_b
  );


-- ================================================================
-- 3. MESSAGES
--    Source: ChatDetailScreen.tsx — text, imageUrl, videoUrl,
--            replyToId, sender, createdAt, isRead, isDeleted
--           HandleSendMessage.ts — encryptedContent, iv,
--            signature, messageHash, encryptionVersion
--    NOTE: Messages are primarily transported via GunDB and
--          stored locally in SQLite. This Supabase table is an
--          optional cloud backup/sync layer.
-- ================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id               TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id  TEXT          NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender           TEXT          NOT NULL REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,
  receiver         TEXT          NOT NULL REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,

  -- Plaintext content (at least one must be non-null — enforced by CHECK)
  text             TEXT,
  image_url        TEXT,
  video_url        TEXT,
  audio_url        TEXT,

  -- Attachment metadata
  file_name        TEXT,
  file_size        TEXT,

  -- E2E encryption fields
  encrypted        BOOLEAN       NOT NULL DEFAULT FALSE,
  encrypted_content TEXT,                       -- ciphertext from Encrypt.ts
  iv               TEXT,                        -- initialization vector (hex, 12 bytes)
  encryption_version TEXT       NOT NULL DEFAULT 'AES-256-GCM',
  decrypted        BOOLEAN       NOT NULL DEFAULT FALSE,

  -- Message delivery status (mirrors Message.status from app)
  status           TEXT          NOT NULL DEFAULT 'sending'
                                  CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed', 'received')),

  -- Reply / quote feature (ChatDetailScreen swipe-to-quote)
  reply_to_id      TEXT          REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Signature / verification fields (SignMessages.ts)
  signature        TEXT,
  signature_nonce  TEXT,
  signature_timestamp BIGINT,
  message_hash     TEXT,
  signature_verified BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Status flags
  is_read          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_deleted       BOOLEAN       NOT NULL DEFAULT FALSE,   -- soft delete (DeleteChat.ts)

  -- Timestamps
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- At least one content field must be present
  CONSTRAINT messages_has_content
    CHECK (
      text            IS NOT NULL OR
      image_url       IS NOT NULL OR
      video_url       IS NOT NULL OR
      audio_url       IS NOT NULL OR
      encrypted_content IS NOT NULL
    )
);

-- Auto-update updated_at
CREATE TRIGGER trg_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-update conversations.last_message + last_message_at after insert
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_at = NEW.created_at,
    last_message    = COALESCE(
                        NEW.text,
                        CASE WHEN NEW.image_url IS NOT NULL THEN '📷 Image'  ELSE NULL END,
                        CASE WHEN NEW.video_url IS NOT NULL THEN '🎥 Video'  ELSE NULL END,
                        CASE WHEN NEW.audio_url IS NOT NULL THEN '🎵 Audio'  ELSE NULL END,
                        'Attachment'
                      )
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_messages_update_conversation
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, created_at DESC);
DROP INDEX IF EXISTS idx_messages_sender;
CREATE INDEX IF NOT EXISTS idx_messages_sender_created_at ON public.messages (sender, created_at DESC);

DROP INDEX IF EXISTS idx_messages_receiver;
CREATE INDEX IF NOT EXISTS idx_messages_receiver_created_at ON public.messages (receiver, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to        ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread          ON public.messages (conversation_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted     ON public.messages (conversation_id) WHERE is_deleted = FALSE;
DROP INDEX IF EXISTS idx_messages_status;
CREATE INDEX IF NOT EXISTS idx_messages_status_created_at ON public.messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_status ON public.messages (receiver, status);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- TODO: Replace with wallet-address-based RLS when Supabase Auth is integrated.
-- The app currently uses the anon key and manages auth via wallet signatures,
-- so current_user is always 'anon' and cannot be used for participant checks.

CREATE POLICY "messages_select_participants"
  ON public.messages FOR SELECT
  USING (
    public.auth_wallet() = sender
    OR public.auth_wallet() = receiver
  );

CREATE POLICY "messages_insert_sender"
  ON public.messages FOR INSERT
  WITH CHECK (public.auth_wallet() = sender);

CREATE POLICY "messages_update_sender"
  ON public.messages FOR UPDATE
  USING (
    public.auth_wallet() = sender
    OR public.auth_wallet() = receiver
  );

CREATE POLICY "messages_delete_sender"
  ON public.messages FOR DELETE
  USING (
    public.auth_wallet() = sender
    OR public.auth_wallet() = receiver
  );


-- ================================================================
-- 4. PINNED CHATS
--    Source: ChatScreen.tsx — togglePinChat(), pinnedChats state,
--            swipe → Pin action, pin icon in chat list
-- ================================================================
CREATE TABLE IF NOT EXISTS public.pinned_chats (
  id              BIGSERIAL     PRIMARY KEY,
  wallet_address  TEXT          NOT NULL REFERENCES public.profiles(wallet_address)  ON DELETE CASCADE,
  conversation_id TEXT          NOT NULL REFERENCES public.conversations(id)         ON DELETE CASCADE,
  pinned_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT pinned_chats_unique UNIQUE (wallet_address, conversation_id)
);

CREATE TRIGGER trg_pinned_chats_updated_at
  BEFORE UPDATE ON public.pinned_chats
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pinned_chats_wallet ON public.pinned_chats (wallet_address);

-- RLS
ALTER TABLE public.pinned_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pinned_chats_select_own"
  ON public.pinned_chats FOR SELECT
  USING (public.auth_wallet() = wallet_address);

CREATE POLICY "pinned_chats_insert_own"
  ON public.pinned_chats FOR INSERT
  WITH CHECK (public.auth_wallet() = wallet_address);

CREATE POLICY "pinned_chats_delete_own"
  ON public.pinned_chats FOR DELETE
  USING (public.auth_wallet() = wallet_address);


-- ================================================================
-- 5. NOTIFICATIONS
--    Source: Notifications.tsx — enable/disable, mute duration,
--            quiet hours, message preview, conversation tones
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notification_settings (
  wallet_address          TEXT          PRIMARY KEY
                                          REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,
  notifications_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
  show_message_preview    BOOLEAN       NOT NULL DEFAULT TRUE,
  conversation_tones      BOOLEAN       NOT NULL DEFAULT TRUE,
  tap_haptic_enabled      BOOLEAN       NOT NULL DEFAULT TRUE,
  tap_haptic_sensitivity  TEXT          NOT NULL DEFAULT 'Light'
                                          CHECK (tap_haptic_sensitivity IN ('Light', 'Medium', 'Heavy')),

  -- Mute duration (stored as interval label matching app options)
  mute_until              TIMESTAMPTZ,  -- NULL = not muted; future timestamp = muted until

  -- Quiet hours (stored as HH:MM strings matching app state)
  quiet_hours_start       TIME,         -- e.g. '22:00'
  quiet_hours_end         TIME,         -- e.g. '07:00'

  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create default notification settings when a profile is created
CREATE OR REPLACE FUNCTION public.create_default_notification_settings()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.notification_settings (wallet_address)
  VALUES (NEW.wallet_address)
  ON CONFLICT (wallet_address) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profile_create_notifications
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_settings();

-- RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_select_own"
  ON public.notification_settings FOR SELECT
  USING (public.auth_wallet() = wallet_address);

CREATE POLICY "notification_settings_insert_own"
  ON public.notification_settings FOR INSERT
  WITH CHECK (public.auth_wallet() = wallet_address);

CREATE POLICY "notification_settings_update_own"
  ON public.notification_settings FOR UPDATE
  USING (public.auth_wallet() = wallet_address);


-- ================================================================
-- 6. MUTED CONVERSATIONS
--    Source: ChatScreen.tsx — swipe → Mute action,
--            Notifications.tsx — mute duration picker
-- ================================================================
CREATE TABLE IF NOT EXISTS public.muted_conversations (
  id              BIGSERIAL     PRIMARY KEY,
  wallet_address  TEXT          NOT NULL REFERENCES public.profiles(wallet_address)  ON DELETE CASCADE,
  conversation_id TEXT          NOT NULL REFERENCES public.conversations(id)         ON DELETE CASCADE,
  muted_until     TIMESTAMPTZ,  -- NULL = muted forever; timestamp = muted until then
  muted_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT muted_conversations_unique UNIQUE (wallet_address, conversation_id)
);

CREATE TRIGGER trg_muted_conversations_updated_at
  BEFORE UPDATE ON public.muted_conversations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_muted_conversations_wallet ON public.muted_conversations (wallet_address);

ALTER TABLE public.muted_conversations ENABLE ROW LEVEL SECURITY;

-- TODO: Replace with wallet-address-based RLS when Supabase Auth is integrated.

CREATE POLICY "muted_conversations_select_own"
  ON public.muted_conversations FOR SELECT
  USING (public.auth_wallet() = wallet_address);

CREATE POLICY "muted_conversations_insert_own"
  ON public.muted_conversations FOR INSERT
  WITH CHECK (public.auth_wallet() = wallet_address);

CREATE POLICY "muted_conversations_update_own"
  ON public.muted_conversations FOR UPDATE
  USING (public.auth_wallet() = wallet_address);

CREATE POLICY "muted_conversations_delete_own"
  ON public.muted_conversations FOR DELETE
  USING (public.auth_wallet() = wallet_address);


-- ================================================================
-- 7. STORAGE BUCKETS
--    Source: UploadAvatar.ts, ChatDetailScreen (image/video msgs)
-- ================================================================

-- Avatar bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Chat media bucket (private — only participants should access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — avatars (public read, owner write)
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );

-- Storage policies — chat-media (participant-only access)
-- Files are named: {conversation_id}/{filename}
-- Access requires being a participant in the conversation extracted from the path.
CREATE POLICY "chat_media_select_participant"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'chat-media'
    AND (
      -- Extract conversation_id from file path (first path segment)
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = SPLIT_PART(name, '/', 1)
          AND (public.auth_wallet() = c.participant_a OR public.auth_wallet() = c.participant_b)
      )
    )
  );

CREATE POLICY "chat_media_insert_sender"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-media'
    AND auth.role() = 'authenticated'
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = SPLIT_PART(name, '/', 1)
          AND (public.auth_wallet() = c.participant_a OR public.auth_wallet() = c.participant_b)
      )
    )
  );

CREATE POLICY "chat_media_delete_participant"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-media'
    AND (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = SPLIT_PART(name, '/', 1)
          AND (public.auth_wallet() = c.participant_a OR public.auth_wallet() = c.participant_b)
      )
    )
  );


-- ================================================================
-- 8. WALLET-BASED AUTHENTICATION (replaces all `USING (true)` RLS below)
--    Links wallet addresses to Supabase Auth users so RLS policies
--    can verify identity via auth.jwt() claims.
-- ================================================================

-- Creates or returns a Supabase Auth user for a wallet address
-- Uses email-based auth with a deterministic email tied to the wallet.
CREATE OR REPLACE FUNCTION public.resolve_wallet_auth_user(
  p_wallet TEXT
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid;
  v_email TEXT := p_wallet || '@wallet.nodelink.app';
  v_password TEXT := 'wallet_' || encode(digest(p_wallet, 'sha256'), 'hex');
BEGIN
  -- Check if user exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    -- Create user in auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      confirmation_token, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '',
      NOW(),
      jsonb_build_object('provider', 'wallet', 'wallet_address', p_wallet),
      jsonb_build_object('wallet_address', p_wallet),
      NOW(),
      NOW()
    )
    RETURNING id INTO v_user_id;

    -- Create identity in auth.identities
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'wallet_address', p_wallet, 'email', v_email),
      'wallet', p_wallet,
      NOW(), NOW(), NOW()
    );
  END IF;

  RETURN v_user_id;
END;
$$;

-- Helper: get wallet from auth JWT
CREATE OR REPLACE FUNCTION public.auth_wallet()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'wallet_address', ''),
    NULLIF(current_setting('request.jwt.claim.wallet_address', true), ''),
    REPLACE(auth.jwt() ->> 'email', '@wallet.nodelink.app', '')
  );
$$;

-- ================================================================
-- 9. HELPER FUNCTIONS
-- ================================================================

-- Check username availability (CheckUsername.ts)
CREATE OR REPLACE FUNCTION public.is_username_taken(
  p_username       TEXT,
  p_wallet_exclude TEXT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(username) = LOWER(p_username)
      AND (p_wallet_exclude IS NULL OR wallet_address <> p_wallet_exclude)
  );
$$;

-- Live general search — name, username, wallet (SearchUser.ts)
CREATE OR REPLACE FUNCTION public.search_users(
  p_term  TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (username TEXT, wallet_address TEXT, avatar TEXT, name TEXT)
LANGUAGE sql STABLE AS $$
  SELECT username, wallet_address, avatar, name
  FROM public.profiles
  WHERE
    name           ILIKE '%' || p_term || '%'
    OR username    ILIKE '%' || p_term || '%'
    OR wallet_address ILIKE '%' || p_term || '%'
  ORDER BY
    CASE WHEN LOWER(username) = LOWER(p_term) THEN 0 ELSE 1 END,  -- exact match first
    username ASC
  LIMIT p_limit;
$$;

-- Username prefix search — "@" mode (SearchUser.ts)
CREATE OR REPLACE FUNCTION public.search_users_by_username_prefix(
  p_prefix TEXT,
  p_limit  INT DEFAULT 10
)
RETURNS TABLE (username TEXT, wallet_address TEXT, avatar TEXT, name TEXT)
LANGUAGE sql STABLE AS $$
  SELECT username, wallet_address, avatar, name
  FROM public.profiles
  WHERE LOWER(username) LIKE LOWER(p_prefix) || '%'
  ORDER BY username ASC
  LIMIT p_limit;
$$;

-- Get or create a conversation between two wallets (handleConnect, UserProfile.tsx)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_wallet_a TEXT,
  p_wallet_b TEXT
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_id TEXT;
  v_min TEXT := LEAST(p_wallet_a, p_wallet_b);
  v_max TEXT := GREATEST(p_wallet_a, p_wallet_b);
  v_hash BIGINT;
BEGIN
  -- Use advisory lock to prevent race conditions between concurrent calls
  -- Hash the sorted pair to get a unique lock ID
  v_hash := ('x' || substr(md5(v_min || v_max), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_hash);

  -- Check if already exists (now safe from race conditions)
  SELECT id INTO v_id
  FROM public.conversations
  WHERE participant_min = v_min
    AND participant_max = v_max
  LIMIT 1;

  IF v_id IS NULL THEN
    -- Build deterministic id from both sorted wallets: "convo_{md5(v_min || v_max).substr(0,16)}"
    -- This ensures the same pair always produces the same ID, regardless of who initiated
    v_id := 'convo_' || encode(digest(v_min || v_max, 'md5'), 'hex');

    INSERT INTO public.conversations (id, participant_a, participant_b)
    VALUES (v_id, p_wallet_a, p_wallet_b)
    ON CONFLICT DO NOTHING;

    -- Fetch the id again in case of concurrent insert race (advisory lock should prevent this)
    SELECT id INTO v_id
    FROM public.conversations
    WHERE participant_min = v_min
      AND participant_max = v_max
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;

-- Get unread message count per conversation for a wallet (GetUnreadCounts.ts)
CREATE OR REPLACE FUNCTION public.get_unread_counts(p_wallet TEXT)
RETURNS TABLE (conversation_id TEXT, unread_count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT
    m.conversation_id,
    COUNT(*) AS unread_count
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE
    (c.participant_a = p_wallet OR c.participant_b = p_wallet)
    AND m.sender   <> p_wallet
    AND m.is_read   = FALSE
    AND m.is_deleted = FALSE
  GROUP BY m.conversation_id;
$$;

-- Mark all messages in a conversation as read (called when user opens ChatDetail)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  p_conversation_id TEXT,
  p_reader_wallet   TEXT
)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE public.messages
  SET is_read = TRUE
  WHERE
    conversation_id = p_conversation_id
    AND receiver    = p_reader_wallet
    AND is_read     = FALSE;
$$;


-- ================================================================
-- 9. ENTITY RELATIONSHIP SUMMARY (comments only)
-- ================================================================
--
--  profiles           1 ──< conversations   (participant_a / participant_b)
--  conversations      1 ──< messages        (conversation_id)
--  messages           1 ──< messages        (reply_to_id — self-ref)
--  profiles           1 ──< pinned_chats    (wallet_address)
--  conversations      1 ──< pinned_chats    (conversation_id)
--  profiles           1 ─── notification_settings (1-to-1, auto-created)
--  profiles           1 ──< muted_conversations   (wallet_address)
--  conversations      1 ──< muted_conversations   (conversation_id)
--
--  storage.buckets:
--    avatars      → profiles.avatar URL          (public)
--    chat-media   → messages.image_url/video_url (private)
--
-- ================================================================
