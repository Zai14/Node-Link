// utils/AuthenticationUtils/SupabaseAuth.ts
//
// Links wallet addresses to Supabase Auth users so RLS policies can verify
// identity. Uses deterministic email-based auth tied to the wallet:
//   email: {wallet}@wallet.nodelink.app
//   password: wallet_{sha256(wallet)}
//
// The corresponding `resolve_wallet_auth_user()` function in
// supabase_migration.sql handles the server-side creation of auth users.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { createHash } from "crypto";
import { supabase } from "../../backend/Supabase/Supabase";

const WALLET_EMAIL_SUFFIX = "@wallet.nodelink.app";

// ---------------------------------------------------------------------------
// Token refresh
// Refresh the session proactively before it expires. The Supabase client also
// auto-refreshes on demand, but this ensures we never hit an expired token.
// ---------------------------------------------------------------------------

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let refreshCount = 0;

/** How many ms before expiry to attempt a proactive refresh. */
const REFRESH_LEAD_TIME_MS = 5 * 60 * 1000; // 5 minutes

/** How often to check the session expiry (only when timer is active). */
const REFRESH_POLL_INTERVAL_MS = 60 * 1000; // every 1 minute

/**
 * Starts a proactive token refresh timer. Checks the session expiry every
 * minute and refreshes if the token will expire within the lead time.
 * Also listens for app state changes to refresh on foreground.
 */
export function startTokenRefresh(): void {
  // Clear any existing timer first
  stopTokenRefresh();

  const checkAndRefresh = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;

      const expiresAt = session.expires_at;
      if (!expiresAt) return;

      const msUntilExpiry = expiresAt * 1000 - Date.now();
      if (msUntilExpiry < REFRESH_LEAD_TIME_MS) {
        console.log(
          `Supabase Auth token expires in ${Math.round(
            msUntilExpiry / 1000
          )}s — refreshing proactively...`
        );
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn("Proactive token refresh failed:", error.message);
        } else {
          refreshCount++;
          console.log(
            `Supabase Auth token refreshed proactively (${refreshCount})`
          );
        }
      }
    } catch (err: any) {
      console.warn("Token refresh check error:", err?.message);
    }
  };

  // Run immediately on start
  checkAndRefresh();

  // Poll periodically
  refreshTimer = setInterval(checkAndRefresh, REFRESH_POLL_INTERVAL_MS);

  // Also refresh when app comes to foreground (catches long idle periods)
  const handleAppState = (nextState: AppStateStatus) => {
    if (nextState === "active") {
      checkAndRefresh();
    }
  };
  appStateSubscription = AppState.addEventListener("change", handleAppState);

  console.log("Supabase Auth token refresh timer started");
}

/**
 * Stops the proactive refresh timer.
 */
/**
 * Returns the current session status info.
 */
export async function getSessionStatus(): Promise<{
  active: boolean;
  expiresAt: number | null;
  refreshCount: number;
  walletLinked: string | null;
}> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      return { active: false, expiresAt: null, refreshCount, walletLinked: null };
    }
    return {
      active: true,
      expiresAt: session.expires_at ?? null,
      refreshCount,
      walletLinked: session.user?.user_metadata?.wallet_address ?? null,
    };
  } catch {
    return { active: false, expiresAt: null, refreshCount, walletLinked: null };
  }
}

export function stopTokenRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
}

/** Derive a deterministic email for a wallet address. */
function walletEmail(wallet: string): string {
  return `${wallet.toLowerCase()}${WALLET_EMAIL_SUFFIX}`;
}

/** Derive a deterministic password for a wallet address (SHA-256). */
function walletPassword(wallet: string): string {
  // Must match the SQL in resolve_wallet_auth_user:
  // 'wallet_' || encode(digest(p_wallet, 'sha256'), 'hex')
  const hash = createHash("sha256")
    .update(wallet.toLowerCase())
    .digest("hex");
  return `wallet_${hash}`;
}

/**
 * Signs into Supabase Auth using the wallet-derived credentials.
 * Creates the Auth user on first call (via signUp); subsequent calls
 * sign in (via signInWithPassword).
 *
 * Call this after the user connects their wallet via WalletConnect.
 */
export async function signInWithWallet(
  walletAddress: string
): Promise<{ error?: string }> {
  try {
    const email = walletEmail(walletAddress);
    const password = walletPassword(walletAddress);

    // Try signing in first (user may already exist)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      if (signInError.message?.includes("Invalid login credentials")) {
        // User doesn't exist or isn't confirmed. Call the SQL function which
        // creates/confirms the auth user directly (bypasses email confirmation).
        const { error: rpcError } = await supabase.rpc(
          "resolve_wallet_auth_user",
          { p_wallet: walletAddress.toLowerCase() }
        );

        if (rpcError) {
          console.error("❌ resolve_wallet_auth_user RPC failed:", rpcError.message);
          return { error: rpcError.message };
        }

        // Now sign in with the created credentials
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (retryError) {
          console.error("❌ Supabase Auth sign-in after RPC failed:", retryError.message);
          return { error: retryError.message };
        }
      } else {
        console.error("❌ Supabase Auth sign-in failed:", signInError.message);
        return { error: signInError.message };
      }
    }

    console.log("✅ Supabase Auth session established for wallet:", walletAddress);
    return {};
  } catch (err: any) {
    console.error("❌ Supabase Auth error:", err?.message || err);
    return { error: err?.message || "Unknown auth error" };
  }
}

/**
 * Signs out of Supabase Auth.
 * Call this during logout.
 */
export async function signOutWallet(): Promise<void> {
  // Stop the token refresh timer first
  stopTokenRefresh();

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("⚠️ Supabase Auth sign-out warning:", error.message);
    } else {
      console.log("✅ Supabase Auth session cleared");
    }
  } catch (err: any) {
    console.warn("⚠️ Supabase Auth sign-out error:", err?.message || err);
  }
}

/**
 * Checks if there's an active Supabase Auth session.
 * Returns true if the session is valid and matches the given wallet.
 */
export async function hasActiveWalletSession(
  walletAddress: string
): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;

    // Verify the session's wallet matches
    const sessionWallet = session.user?.user_metadata?.wallet_address;
    return sessionWallet?.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}
