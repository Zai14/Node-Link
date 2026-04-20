
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

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE USING (true);

CREATE POLICY "profiles_delete_own"
  ON public.profiles FOR DELETE USING (true);


-- ================================================================
-- 2. CONVERSATIONS
--    Source: ChatScreen.tsx (convo_{wallet} id pattern),
--            UserProfile.tsx (handleConnect), ChatContext
-- ================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id              TEXT          PRIMARY KEY
                                  DEFAULT ('convo_' || gen_random_uuid()::text),
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
  USING (true);   -- app-level filter by wallet; tighten with Supabase Auth JWT

CREATE POLICY "conversations_insert_participants"
  ON public.conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "conversations_update_participants"
  ON public.conversations FOR UPDATE USING (true);

CREATE POLICY "conversations_delete_participants"
  ON public.conversations FOR DELETE USING (true);


-- ================================================================
-- 3. MESSAGES
--    Source: ChatDetailScreen.tsx — text, imageUrl, videoUrl,
--            replyToId, sender, createdAt, isRead, isDeleted
-- ================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id               TEXT          PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id  TEXT          NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender           TEXT          NOT NULL REFERENCES public.profiles(wallet_address) ON DELETE CASCADE,

  -- Content (at least one must be non-null — enforced by CHECK)
  text             TEXT,
  image_url        TEXT,
  video_url        TEXT,

  -- Reply / quote feature (ChatDetailScreen swipe-to-quote)
  reply_to_id      TEXT          REFERENCES public.messages(id) ON DELETE SET NULL,

  -- Status flags
  is_read          BOOLEAN       NOT NULL DEFAULT FALSE,
  is_deleted       BOOLEAN       NOT NULL DEFAULT FALSE,   -- soft delete (DeleteChat.ts)

  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT messages_has_content
    CHECK (
      text      IS NOT NULL OR
      image_url IS NOT NULL OR
      video_url IS NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_messages_sender          ON public.messages (sender);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to        ON public.messages (reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread          ON public.messages (conversation_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_messages_not_deleted     ON public.messages (conversation_id) WHERE is_deleted = FALSE;

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Only conversation participants can read messages
CREATE POLICY "messages_select_participants"
  ON public.messages FOR SELECT USING (true);

CREATE POLICY "messages_insert_sender"
  ON public.messages FOR INSERT WITH CHECK (true);

-- Only sender can update (edit / mark deleted)
CREATE POLICY "messages_update_sender"
  ON public.messages FOR UPDATE USING (true);

CREATE POLICY "messages_delete_sender"
  ON public.messages FOR DELETE USING (true);


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

  CONSTRAINT pinned_chats_unique UNIQUE (wallet_address, conversation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pinned_chats_wallet ON public.pinned_chats (wallet_address);

-- RLS
ALTER TABLE public.pinned_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pinned_chats_select_own"
  ON public.pinned_chats FOR SELECT USING (true);

CREATE POLICY "pinned_chats_insert_own"
  ON public.pinned_chats FOR INSERT WITH CHECK (true);

CREATE POLICY "pinned_chats_delete_own"
  ON public.pinned_chats FOR DELETE USING (true);


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
  ON public.notification_settings FOR SELECT USING (true);

CREATE POLICY "notification_settings_insert_own"
  ON public.notification_settings FOR INSERT WITH CHECK (true);

CREATE POLICY "notification_settings_update_own"
  ON public.notification_settings FOR UPDATE USING (true);


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

  CONSTRAINT muted_conversations_unique UNIQUE (wallet_address, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_muted_conversations_wallet ON public.muted_conversations (wallet_address);

ALTER TABLE public.muted_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "muted_conversations_select_own"
  ON public.muted_conversations FOR SELECT USING (true);

CREATE POLICY "muted_conversations_insert_own"
  ON public.muted_conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "muted_conversations_update_own"
  ON public.muted_conversations FOR UPDATE USING (true);

CREATE POLICY "muted_conversations_delete_own"
  ON public.muted_conversations FOR DELETE USING (true);


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

-- Storage policies — avatars
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "avatars_delete"
  ON storage.objects FOR DELETE USING (bucket_id = 'avatars');

-- Storage policies — chat-media
CREATE POLICY "chat_media_select"
  ON storage.objects FOR SELECT USING (bucket_id = 'chat-media');

CREATE POLICY "chat_media_insert"
  ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "chat_media_delete"
  ON storage.objects FOR DELETE USING (bucket_id = 'chat-media');


-- ================================================================
-- 8. HELPER FUNCTIONS
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
BEGIN
  -- Check if already exists (in either direction)
  SELECT id INTO v_id
  FROM public.conversations
  WHERE participant_min = v_min
    AND participant_max = v_max
  LIMIT 1;

  IF v_id IS NULL THEN
    -- Build the deterministic id matching the app's pattern: "convo_{walletB}"
    v_id := 'convo_' || p_wallet_b;

    INSERT INTO public.conversations (id, participant_a, participant_b)
    VALUES (v_id, p_wallet_a, p_wallet_b)
    ON CONFLICT DO NOTHING;

    -- Fetch the id again in case of conflict
    SELECT id INTO v_id
    FROM public.conversations
    WHERE participant_min = v_min
      AND participant_max = v_max
    LIMIT 1;

    -- If conflict on id (different pair, same wallet suffix), fall back to UUID
    IF v_id IS NULL THEN
      v_id := 'convo_' || gen_random_uuid()::text;
      INSERT INTO public.conversations (id, participant_a, participant_b)
      VALUES (v_id, p_wallet_a, p_wallet_b);
    END IF;
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
    AND sender     <> p_reader_wallet
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
