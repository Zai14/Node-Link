// utils/MyProfileUtils/CheckUsernameExists.ts
import { supabase } from '../../backend/Supabase/Supabase';

export const checkUsernameExists = async (username: string, currentWallet: string) => {
  // Use the RPC function which does case-insensitive matching via LOWER()
  const { data, error } = await supabase
    .rpc('is_username_taken', {
      p_username: username,
      p_wallet_exclude: currentWallet,
    });

  if (error) {
    console.error('Error checking username existence:', error.message);
    return false;
  }

  return data ?? false;
};
