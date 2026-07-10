// utils/ChatUtils/ConversationIdContext.tsx
//
// Provides a shared, cached mapping from wallet addresses to their canonical
// conversation IDs (hash-based). Avoids repeated AsyncStorage reads that were
// previously done in ChatDetailScreen and other components.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import { getConversationId } from "./getConversationId";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResolvedConversation {
  /** The canonical (hash-based) conversation ID, or the legacy fallback */
  canonicalId: string;
  /** The other participant's wallet address extracted from the nav param */
  receiverAddress: string;
}

export interface ConversationIdContextType {
  /**
   * Returns the cached canonical ID for a given wallet address, or null
   * if it hasn't been loaded yet.
   */
  getCachedCanonicalId: (walletAddress: string) => string | null;

  /**
   * Resolves a conversation from a legacy nav param (convo_{wallet}) to a
   * ResolvedConversation.  Uses the in-memory cache synchronously; if not
   * found, falls back to the legacy ID.
   */
  resolveConversation: (conversationId: string) => ResolvedConversation;

  /**
   * Stores a canonical ID mapping.  Persists to AsyncStorage and updates
   * the in-memory cache.  Called by handleConnect after the RPC completes.
   */
  setCanonicalId: (
    walletAddress: string,
    canonicalId: string
  ) => Promise<void>;

  /** True once the initial batch of IDs has been loaded from AsyncStorage. */
  cacheReady: boolean;
}

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "conversation_id_";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ConversationIdContext =
  createContext<ConversationIdContextType | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface Props {
  children: ReactNode;
}

export const ConversationIdProvider = ({ children }: Props) => {
  const [cache, setCache] = useState<Record<string, string>>({});
  const [cacheReady, setCacheReady] = useState(false);

  // Track whether the SQL migration has already run (prevents double-migrate)
  const migratedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // SQLite migration: update legacy convo_{wallet} message IDs to their canonical
  // hash-based IDs so that message loading never needs to search two IDs.
  // ---------------------------------------------------------------------------

  const migrateLegacyMessages = useCallback(
    async (currentCache: Record<string, string>) => {
      if (migratedRef.current) return;
      migratedRef.current = true;

      try {
        if (Platform.OS !== "ios" && Platform.OS !== "android") return;

        const db = await SQLite.openDatabaseAsync("chat.db");

        // Find all distinct legacy convo_{wallet} conversationIds in the DB
        const rows: { conversationId: string }[] = await db.getAllAsync(
          `SELECT DISTINCT conversationId FROM messages WHERE conversationId LIKE 'convo_%'`
        );

        if (rows.length === 0) {
          console.log(
            "ConversationIdContext: no legacy convo_ IDs to migrate"
          );
          return;
        }

        let migratedCount = 0;

        for (const { conversationId: legacyId } of rows) {
          if (!legacyId) continue;
          const walletAddress = legacyId.replace(/^convo_/, "");
          const canonicalId = currentCache[walletAddress];

          // Only migrate if we have a canonical ID for this wallet
          if (canonicalId && canonicalId !== legacyId) {
            await db.runAsync(
              `UPDATE messages SET conversationId = ? WHERE conversationId = ?`,
              [canonicalId, legacyId]
            );
            migratedCount++;
          }
        }

        console.log(
          `ConversationIdContext: migrated ${migratedCount} legacy conversation ID(s) to canonical hash IDs`
        );
      } catch (err) {
        console.warn("ConversationIdContext: SQLite migration failed", err);
      }
    },
    []
  );

  // Pre-warm the cache from AsyncStorage on mount, then run the migration
  useEffect(() => {
    const prewarmAndMigrate = async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const convoKeys = allKeys.filter((k) => k.startsWith(STORAGE_PREFIX));

        let loaded: Record<string, string> = {};

        if (convoKeys.length > 0) {
          const entries = await Promise.all(
            convoKeys.map(async (key) => {
              const walletAddress = key.replace(STORAGE_PREFIX, "");
              const canonicalId = await AsyncStorage.getItem(key);
              return [walletAddress, canonicalId] as [string, string | null];
            })
          );

          for (const [wallet, id] of entries) {
            if (id) loaded[wallet] = id;
          }

          console.log(
            `ConversationIdContext: pre-warmed ${Object.keys(loaded).length} mappings`
          );
        }

        setCache(loaded);

        // Migrate legacy SQLite messages BEFORE signaling cacheReady so that
        // consumers (ChatDetailScreen) never fetch from the canonical hash
        // before legacy rows have been updated.
        await migrateLegacyMessages(loaded);

        setCacheReady(true);
      } catch (err) {
        console.warn("ConversationIdContext: pre-warm failed", err);
        setCacheReady(true);
      }
    };

    prewarmAndMigrate();
  }, [migrateLegacyMessages]);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const getCachedCanonicalId = useCallback(
    (walletAddress: string): string | null => cache[walletAddress] ?? null,
    [cache]
  );

  const resolveConversation = useCallback(
    (conversationId: string): ResolvedConversation => {
      const receiverAddress = conversationId.replace(/^convo_/, "");
      const cached = cache[receiverAddress];

      return {
        canonicalId: cached ?? conversationId,
        receiverAddress,
      };
    },
    [cache]
  );

  const setCanonicalId = useCallback(
    async (walletAddress: string, canonicalId: string) => {
      // Update cache immediately (synchronous for subsequent reads)
      setCache((prev) => ({ ...prev, [walletAddress]: canonicalId }));
      // Persist to AsyncStorage
      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}${walletAddress}`,
        canonicalId
      );
    },
    []
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <ConversationIdContext.Provider
      value={{
        getCachedCanonicalId,
        resolveConversation,
        setCanonicalId,
        cacheReady,
      }}
    >
      {children}
    </ConversationIdContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useConversationId(): ConversationIdContextType {
  const ctx = useContext(ConversationIdContext);
  if (!ctx) {
    throw new Error(
      "useConversationId must be used within a ConversationIdProvider"
    );
  }
  return ctx;
}
