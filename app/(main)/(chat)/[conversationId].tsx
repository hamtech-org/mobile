import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { EmptyState } from "@/components/common/EmptyState";
import { Loading } from "@/components/common/Loading";
import { useAppSelector } from "@/hooks/useAppStore";
import { useChat } from "@/hooks/useChat";
import { useSocket } from "@/hooks/useSocket";
import { useGetConversationsQuery, useGetMessagesQuery, type ChatMessage } from "@/store/api/chatApi";

export default function ChatDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const userId = useAppSelector((state) => state.auth.user?.userId);
  const socket = useSocket();
  const { sendMessage, isSending } = useChat();
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const { data, isLoading, isError, refetch } = useGetMessagesQuery({ conversationId, limit: 40 }, { skip: !conversationId });

  // Lấy thông tin conversation từ cache RTK Query (không gọi API thêm)
  const { conversation } = useGetConversationsQuery(undefined, {
    selectFromResult: ({ data: convList }) => ({
      conversation: convList?.find((c) => c.conversationId === conversationId),
    }),
  });

  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const insets = useSafeAreaInsets();
  const isGroup = conversation?.type === "group";

  // Reset realtime messages khi chuyển conversation
  useFocusEffect(
    useCallback(() => {
      setRealtimeMessages([]);
    }, [conversationId]),
  );

  // Socket.io: join room + lắng nghe tin nhắn mới
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("conversation:join", conversationId);

    const onMessageNew = (message: ChatMessage) => {
      if (message.conversationId !== conversationId) return;
      setRealtimeMessages((prev) => {
        if (prev.some((item) => item.messageId === message.messageId)) return prev;
        return [message, ...prev];
      });
    };

    socket.on("message:new", onMessageNew);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.emit("conversation:leave", conversationId);
    };
  }, [conversationId, socket]);

  // Merge API messages + realtime messages (dedup by messageId)
  const messages = useMemo(() => {
    const base = data ?? [];
    const map = new Map<string, ChatMessage>();
    [...realtimeMessages, ...base].forEach((item) => map.set(item.messageId, item));
    return Array.from(map.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [data, realtimeMessages]);

  const handleSend = async (content: string) => {
    if (!conversationId) return;
    await sendMessage(conversationId, content);
  };

  // --- Guards ---
  if (!conversationId) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-destructive">Thiếu conversationId.</Text>
      </View>
    );
  }

  if (isLoading) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  if (isError) {
    return (
      <View className="flex-1 bg-background">
        {conversation ? <ChatHeader conversation={conversation} /> : null}
        <EmptyState
          icon="cloud-offline-outline"
          title="Không tải được tin nhắn"
          description="Kiểm tra kết nối mạng và thử lại."
          action={{ label: "Thử lại", onPress: () => void refetch() }}
        />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      {conversation ? (
        <ChatHeader conversation={conversation} />
      ) : (
        <View className="px-4 py-3 border-b border-border/40">
          <Text className="text-foreground text-lg font-bold">Hội thoại</Text>
        </View>
      )}

      {/*
        KeyboardAvoidingView từ react-native-keyboard-controller:
        Xử lý đúng với Edge-to-Edge Android 15+ và iOS
        behavior="padding" hoạt động tốt trên cả hai nền tảng
      */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {/* Message list */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.messageId}
          contentContainerStyle={{
            paddingHorizontal: 12,
            paddingTop: 8,
            paddingBottom: 8,
            flexGrow: messages.length === 0 ? 1 : undefined,
          }}
          inverted
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <ChatBubble message={item} isOwn={Boolean(userId && item.senderId === userId)} isGroup={isGroup} />}
          ListEmptyComponent={
            <EmptyState icon="chatbubble-ellipses-outline" title="Chưa có tin nhắn" description="Hãy bắt đầu cuộc trò chuyện!" />
          }
        />

        {/* Input bar — padding bottom = safe area để tránh home bar */}
        <View style={{ paddingBottom: insets.bottom }}>
          <ChatInput onSend={handleSend} sending={isSending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
