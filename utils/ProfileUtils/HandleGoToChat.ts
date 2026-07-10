import { UserData } from '../../backend/Supabase/RegisterUser';

/**
 * Navigate to a chat detail screen using the canonical conversation ID.
 * The conversationId is typically obtained from handleConnect() which
 * calls the Supabase get_or_create_conversation RPC.
 */
export const handleSendMessage = (
    isConnected: boolean,
    userData: UserData | null,
    chatList: any[],
    addOrUpdateChat: Function,
    navigation: any,
    conversationId?: string  // canonical ID from Supabase RPC, or undefined for fallback
  ) => {
    if (!isConnected || !userData) {
      return;
    }

    // Use the canonical conversation ID from the RPC if available,
    // otherwise fall back to the legacy wallet-based pattern
    const id = conversationId || `convo_${userData.walletAddress}`;

    const avatarSource = userData.avatar === 'default' || !userData.avatar
      ? require('../../assets/images/default-user-avatar.jpg')
      : { uri: userData.avatar };
    const chatExists = chatList.some((chat: any) => chat.id === id);
    if (!chatExists) {
      addOrUpdateChat({
        id,
        name: userData.name || 'NodeLink User',
        avatar: avatarSource,
        message: 'Conversation started.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      });
    }
    navigation.navigate('Main');
    navigation.navigate('ChatDetail', {
      conversationId: id,
      name: userData.name || 'NodeLink User',
      avatar: avatarSource,
    });
  };