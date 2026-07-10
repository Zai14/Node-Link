// utils\ProfileUtils\HandleConnect.ts
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { deriveSharedKeyWithUser } from "../../backend/E2E-Encryption/SharedKey";
import { SessionKeyStore } from "../../backend/Local database/AsyncStorage/KeyStorage/SessionKeyStore";
import { supabase } from "../../backend/Supabase/Supabase";
import { getConversationId } from "../ChatUtils/getConversationId";

export interface ConnectionResult {
  success: boolean;
  conversationId?: string;
  error?: string;
}

/**
 * Establishes a secure session by retrieving or deriving a shared key
 * with another user, registers the conversation in Supabase via RPC,
 * and stores everything in memory and persistent storage.
 *
 * @param myWallet The current user's wallet address
 * @param recipientAddress Wallet address of the recipient
 * @returns ConnectionResult with success status and canonical conversation ID
 */
export async function handleConnect(
  myWallet: string,
  recipientAddress: string
): Promise<ConnectionResult> {
  console.log(`Initiating connection with ${recipientAddress}...`);

  const storageKey = `shared_key_${recipientAddress}`;

  try {
    // --- Step 1: Derive / load the shared encryption key ---
    let sharedKey = await AsyncStorage.getItem(storageKey);
    console.log(`Shared Key with ${recipientAddress} =`, sharedKey ? "exists" : "missing");

    if (!sharedKey) {
      console.log(
        `Shared Key not found for ${recipientAddress}, deriving a new one...`
      );
      sharedKey = await deriveSharedKeyWithUser(recipientAddress);
      if (!sharedKey) throw new Error("Key derivation failed");

      await AsyncStorage.setItem(storageKey, sharedKey);
      console.log(`Saved newly derived shared key to AsyncStorage.`);
    } else {
      console.log(`Loaded shared key from AsyncStorage.`);
    }

    // --- Step 2: Register conversation in Supabase via RPC ---
    // This creates a deterministic conversation ID based on both wallets.
    let canonicalId: string;
    try {
      const { data, error } = await supabase
        .rpc('get_or_create_conversation', {
          p_wallet_a: myWallet,
          p_wallet_b: recipientAddress,
        });

      if (error) {
        console.warn("⚠️ Supabase RPC failed, falling back to local ID:", error.message);
        canonicalId = getConversationId(myWallet, recipientAddress);
      } else {
        canonicalId = data as string;
        console.log(`✅ Conversation registered in Supabase with ID: ${canonicalId}`);
      }
    } catch (rpcError) {
      console.warn("⚠️ Supabase RPC error, falling back to local ID:", rpcError);
      canonicalId = getConversationId(myWallet, recipientAddress);
    }

    // --- Step 3: Store the canonical conversation ID for future reference ---
    const convoIdStorageKey = `conversation_id_${recipientAddress}`;
    await AsyncStorage.setItem(convoIdStorageKey, canonicalId);
    console.log(`Stored canonical conversation ID: ${canonicalId}`);

    // --- Step 4: Save shared key to in-memory session store ---
    SessionKeyStore.set(recipientAddress, sharedKey);
    console.log(`Shared key cached in memory.`);

    return {
      success: true,
      conversationId: canonicalId,
    };
  } catch (err) {
    console.error(`❌ Connection failed with ${recipientAddress}:`, err);
    Alert.alert(
      "Could not establish Shared Key",
      "The user's public key is missing or invalid."
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
