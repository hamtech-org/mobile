import { useSendTextMessageMutation } from "@/store/api/chatApi";

export const useChat = () => {
  const [sendTextMessage, sendTextMessageState] = useSendTextMessageMutation();

  const sendMessage = async (conversationId: string, content: string): Promise<void> => {
    await sendTextMessage({ conversationId, content }).unwrap();
  };

  return {
    sendMessage,
    isSending: sendTextMessageState.isLoading,
  };
};
