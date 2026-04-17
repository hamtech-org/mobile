import { Pressable, Text, View } from "react-native";

import type { Conversation } from "@/store/api/chatApi";

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export const ConversationItem = ({ conversation, onPress }: ConversationItemProps) => {
  return (
    <Pressable onPress={onPress} className="bg-card border border-border rounded-2xl px-4 py-3 gap-1 active:opacity-80">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-foreground font-semibold flex-1" numberOfLines={1}>
          {conversation.name || "Hội thoại"}
        </Text>
        <Text className="text-muted-foreground text-xs">
          {conversation.lastMessage?.createdAt ? new Date(conversation.lastMessage.createdAt).toLocaleTimeString() : ""}
        </Text>
      </View>
      <Text className="text-muted-foreground text-sm" numberOfLines={1}>
        {conversation.lastMessage?.content || "Chưa có tin nhắn"}
      </Text>
    </Pressable>
  );
};
