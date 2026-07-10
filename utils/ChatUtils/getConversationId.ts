// utils/ChatUtils/getConversationId.ts
//
// Generate deterministic conversation IDs matching the SQL function
// `get_or_create_conversation` in supabase_migration.sql.
//
// The ID is based on both wallet addresses sorted, then hashed via md5,
// so the same pair always produces the same ID regardless of who initiated.
//
// Pattern: "convo_{md5(LEAST(a,b) || GREATEST(a,b))}"
//
// The TypeScript side generates the same ID as PostgreSQL's:
//   encode(digest(v_min || v_max, 'md5'), 'hex')
// which is equivalent to md5(v_min || v_max).

import { createHash } from "crypto";

/**
 * Generate a deterministic conversation ID from two wallet addresses.
 * Wallets are sorted lexicographically before hashing, so the order
 * of the arguments does not matter. Matches the PostgreSQL function.
 *
 * @example
 *   getConversationId("0xA...", "0xB...") // => "convo_a1b2c3..."
 */
export function getConversationId(walletA: string, walletB: string): string {
  const [vMin, vMax] =
    walletA < walletB ? [walletA, walletB] : [walletB, walletA];
  const hash = createHash("md5").update(vMin + vMax).digest("hex");
  return `convo_${hash}`;
}
