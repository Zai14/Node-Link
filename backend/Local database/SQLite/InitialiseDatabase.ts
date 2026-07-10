import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ---------------------------------------------------------------------------
// Schema versioning — migrations only run once per version bump.
// Increment DB_SCHEMA_VERSION when adding a new migration step.
// ---------------------------------------------------------------------------

const DB_SCHEMA_VERSION = 7;
const VERSION_KEY = "sqlite_schema_version";

// ---------------------------------------------------------------------------
// Migration steps (index = version number, run in order)
// ---------------------------------------------------------------------------

type Migration = (db: SQLite.SQLiteDatabase) => Promise<void>;

const migrations: Migration[] = [
  // Version 1 — add E2E signature columns to existing databases
  async (db) => {
    const result = await db.getAllAsync<any>("PRAGMA table_info(messages)");
    const columnNames = result.map((col: any) => col.name);

    const signatureColumns = [
      { name: "signature", type: "TEXT" },
      { name: "signatureNonce", type: "TEXT" },
      { name: "signatureTimestamp", type: "INTEGER" },
      { name: "messageHash", type: "TEXT" },
      { name: "signatureVerified", type: "INTEGER DEFAULT 0" },
    ];

    for (const column of signatureColumns) {
      if (!columnNames.includes(column.name)) {
        await db.execAsync(
          `ALTER TABLE messages ADD COLUMN ${column.name} ${column.type}`
        );
        console.log(`Added signature column: ${column.name}`);
      }
    }
  },

  // Version 2 — upgrade to composite (conversationId, timestamp) index
  async (db) => {
    await db.execAsync("DROP INDEX IF EXISTS idx_messages_conversationId;");
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversationId_ts
      ON messages (conversationId, timestamp);
    `);
  },

  // Version 3 — composite (sender, timestamp) index for sent-message lookups
  async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_sender_ts
      ON messages (sender, timestamp);
    `);
  },

  // Version 4 — partial index for unread message queries
  // Speeds up: getUnreadMessageCounts (WHERE readAt IS NULL GROUP BY conversationId)
  // Also helps: markMessagesAsRead, getUnreadMessageCountForConversation
  async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_unread
      ON messages (conversationId) WHERE readAt IS NULL;
    `);
  },

  // Version 5 — composite (receiver, timestamp) index for received-message lookups
  async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_ts
      ON messages (receiver, timestamp);
    `);
  },

  // Version 6 — composite (status, timestamp) index for failed/sending message queries
  async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_status_ts
      ON messages (status, timestamp);
    `);
  },

  // Version 7 — composite (receiver, status) index for finding messages by type for a user
  async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_messages_receiver_status
      ON messages (receiver, status);
    `);
  },
];

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

/**
 * Opens the database on supported platforms (iOS/Android).
 */
const openDatabase = async () => {
  if (Platform.OS === "ios" || Platform.OS === "android") {
    try {
      return await SQLite.openDatabaseAsync("chat.db");
    } catch (error) {
      console.error("❌ Failed to open database:", error);
      throw error;
    }
  } else {
    const msg = "SQLite is not supported on this platform.";
    console.warn(msg);
    throw new Error(msg);
  }
};

/**
 * Creates the schema for a brand-new database, then records the latest
 * schema version so no migrations are needed.
 */
const createFreshSchema = async (
  db: SQLite.SQLiteDatabase
): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY NOT NULL,
      conversationId TEXT,
      sender TEXT,
      receiver TEXT,
      text TEXT,
      timestamp TEXT,
      imageUrl TEXT,
      fileName TEXT,
      fileSize TEXT,
      videoUrl TEXT,
      audioUrl TEXT,
      replyTo TEXT,
      status TEXT,
      encrypted INTEGER,
      decrypted INTEGER,
      encryptedContent TEXT,
      iv TEXT,
      createdAt INTEGER,
      receivedAt INTEGER,
      encryptionVersion TEXT,
      readAt INTEGER,
      signature TEXT,
      signatureNonce TEXT,
      signatureTimestamp INTEGER,
      messageHash TEXT,
      signatureVerified INTEGER DEFAULT 0
    );
  `);

  // Composite index for fast conversation lookups + sorted message queries
  // Covers: WHERE conversationId = ? ORDER BY timestamp ASC
  // Also covers: WHERE conversationId = ? (leading column)
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversationId_ts
    ON messages (conversationId, timestamp);
  `);

  // Composite index for sent-message lookups grouped by sender
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_sender_ts
    ON messages (sender, timestamp);
  `);

  // Partial index for unread message queries
  // Speeds up: getUnreadMessageCounts (WHERE readAt IS NULL GROUP BY conversationId)
  // Also helps: markMessagesAsRead, getUnreadMessageCountForConversation
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON messages (conversationId) WHERE readAt IS NULL;
  `);

  // Composite index for received-message lookups grouped by receiver
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_receiver_ts
    ON messages (receiver, timestamp);
  `);

  // Composite index for status-based queries (failed, sending, etc.)
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_status_ts
    ON messages (status, timestamp);
  `);

  // Composite index for finding messages by type for a specific receiver
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_messages_receiver_status
    ON messages (receiver, status);
  `);
};

/**
 * Runs any pending migrations and persists the new version to AsyncStorage.
 */
const runPendingMigrations = async (
  db: SQLite.SQLiteDatabase
): Promise<void> => {
  try {
    const storedVersionStr = await AsyncStorage.getItem(VERSION_KEY);

    // No stored version = fresh database — createFreshSchema already
    // created the table with all columns and indexes. Save version and skip.
    if (storedVersionStr === null) {
      await AsyncStorage.setItem(VERSION_KEY, String(DB_SCHEMA_VERSION));
      console.log(`Fresh database, schema v${DB_SCHEMA_VERSION}.`);
      return;
    }

    const storedVersion = parseInt(storedVersionStr, 10);

    if (storedVersion >= DB_SCHEMA_VERSION) {
      console.log(`Schema up-to-date (v${storedVersion}), skipping migrations.`);
      return;
    }

    console.log(
      `Schema v${storedVersion} → v${DB_SCHEMA_VERSION}, running ${
        DB_SCHEMA_VERSION - storedVersion
      } migration(s)...`
    );

    // Run each pending migration in order
    for (let v = storedVersion; v < DB_SCHEMA_VERSION; v++) {
      const migration = migrations[v];
      if (migration) {
        console.log(`Running schema migration v${v + 1}...`);
        await migration(db);
      }
    }

    await AsyncStorage.setItem(VERSION_KEY, String(DB_SCHEMA_VERSION));
    console.log(`Schema migrated to v${DB_SCHEMA_VERSION}.`);
  } catch (error) {
    console.warn("⚠️ Schema migration error:", error);
    // Don't throw — app functions without newer schema features
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let dbInitPromise: Promise<void> | null = null;

/**
 * Ensures the SQLite database is initialised with the latest schema.
 * Safe to call multiple times — only runs once per process.
 */
export const ensureDatabaseInitialized = async (): Promise<void> => {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const db = await openDatabase();
      await createFreshSchema(db);
      await runPendingMigrations(db);
    })();
  }
  return dbInitPromise;
};

export { openDatabase };
