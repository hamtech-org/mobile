import { useCallback, useRef, useState, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, View, Alert, Keyboard } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { ChatBubble, ChatHeader, ChatInput, MessageActionSheet, TypingIndicator, type PendingAttachment } from "@/components/chat";
import { MessageSquare } from "lucide-react-native";
import { EmptyState } from "@/components/common/EmptyState";
import { Loading } from "@/components/common/Loading";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import { useChat } from "@/hooks/useChat";
import { useSocket } from "@/hooks/useSocket";
import { useChatMessageData } from "@/hooks/useChatMessageData";
import { useChatRealtimeEvents } from "@/hooks/useChatRealtimeEvents";
import { useConversationLifecycle } from "@/hooks/useConversationLifecycle";
import { useGetConversationsQuery } from "@/store/api/chatApi";
import { setReplyingTo, clearReplyingTo } from "@/store/slices/chatSlice";
import type { IMessage } from "@/types/chat.types";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";

const EMPTY_TYPING_USERS: any[] = [];

/**
 * ChatDetailScreen — Màn hình chi tiết cuộc trò chuyện.
 * Tích hợp full realtime, media, reply, actions và typing indicators.
 */
export default function ChatDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const insets = useSafeAreaInsets();

  const currentUserId = useAppSelector((state) => state.auth.user?.userId);
  const replyingTo = useAppSelector((state) => state.chat.replyingTo);
  const typingUsers = useAppSelector((state) =>
    conversationId ? (state.chat.typingUsers[conversationId] ?? EMPTY_TYPING_USERS) : EMPTY_TYPING_USERS,
  );

  const listRef = useRef<FlatList<IMessage>>(null);
  const [selectedMessage, setSelectedMessage] = useState<IMessage | null>(null);

  // 1. Data logic: Merge API + Socket messages
  const { allMessages, isLoading, isError, refetch, latestMessageId } = useChatMessageData(conversationId);

  // 2. Realtime logic: Listen to 8 socket events
  useChatRealtimeEvents({
    dispatch,
    socket,
    activeConversationId: conversationId,
  });

  // 3. Lifecycle logic: Room join/leave + Auto markAsRead
  useConversationLifecycle({
    socket,
    conversationId,
    latestMessageId,
  });

  // 4. Messaging actions
  const {
    sendMessage,
    sendMediaMessage,
    sendReplyMessage,
    editMessage,
    recallMessage,
    deleteMessage,
    togglePinMessage,
    reactMessage,
    emitTyping,
  } = useChat();

  const [uploadMedia] = useUploadMediaMutation();

  // 5. Lấy thông tin conversation từ cache (Memoized for stability)
  const { data: convList } = useGetConversationsQuery();
  const conversation = useMemo(() => convList?.find((c) => c.conversationId === conversationId), [convList, conversationId]);

  const isGroup = conversation?.type === "group";

  // --- Handlers ---

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!conversationId) return;

      const reply = replyingTo;
      if (reply) {
        dispatch(clearReplyingTo());
        void sendReplyMessage(conversationId, content, reply).catch((err) => {
          console.error("sendReplyMessage:", err);
        });
      } else {
        void sendMessage(conversationId, content).catch((err) => {
          console.error("sendMessage:", err);
        });
      }

      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [conversationId, replyingTo, sendReplyMessage, sendMessage, dispatch],
  );

  const handleSendMedia = useCallback(
    async (attachment: PendingAttachment, caption: string) => {
      if (!conversationId) return;

      const replySnapshot = replyingTo;
      if (replySnapshot) {
        dispatch(clearReplyingTo());
      }

      const mediaType = attachment.mimeType.startsWith("image/")
        ? "image"
        : attachment.mimeType.startsWith("video/")
          ? "video"
          : "file";

      const clientReplyToDetails = replySnapshot
        ? {
            messageId: replySnapshot.messageId,
            senderId: replySnapshot.senderId,
            senderDisplayName: replySnapshot.senderDisplayName ?? null,
            content: replySnapshot.isRecalled ? "Tin nhắn đã được thu hồi" : replySnapshot.content,
            type: replySnapshot.type,
          }
        : undefined;

      try {
        const file = await prepareLocalFileForUpload({
          uri: attachment.uri,
          name: attachment.name,
          mimeType: attachment.mimeType,
        });

        const uploadRes = await uploadMedia({
          file: {
            uri: file.uri,
            name: file.name,
            type: file.type,
          },
          mediaType,
        }).unwrap();

        await sendMediaMessage(conversationId, mediaType, caption, uploadRes.mediaId, replySnapshot?.messageId, {
          optimisticLocalUri: file.uri,
          optimisticMediaName: file.name,
          clientReplyToDetails,
        });

        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch (err) {
        console.error("Upload/Send failed:", err);
        Alert.alert("Lỗi", "Không thể gửi file. Vui lòng thử lại.");
      }
    },
    [conversationId, uploadMedia, sendMediaMessage, replyingTo, dispatch],
  );

  const handleLongPressMessage = useCallback((msg: IMessage) => {
    // Đóng bàn phím trước khi mở action sheet để tránh keyboard đè menu.
    Keyboard.dismiss();
    setTimeout(() => setSelectedMessage(msg), 120);
  }, []);

  const handleReply = useCallback(
    (msg: IMessage) => {
      dispatch(setReplyingTo(msg));
    },
    [dispatch],
  );

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      // Logic scroll đến tin nhắn cụ thể
      const index = allMessages.findIndex((m) => m.messageId === messageId);
      if (index !== -1) {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
    },
    [allMessages],
  );

  const handleTyping = useCallback(() => {
    if (conversationId) emitTyping(conversationId);
  }, [conversationId, emitTyping]);

  if (isLoading) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      {conversation && (
        <ChatHeader
          conversation={conversation}
          currentUserId={currentUserId}
          typingUsers={typingUsers}
          memberCount={conversation.memberCount}
        />
      )}

      {/* Message List */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={(item) => item.messageId}
          inverted
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 8,
            paddingBottom: 16,
            flexGrow: allMessages.length === 0 ? 1 : undefined,
          }}
          renderItem={({ item, index }) => (
            <ChatBubble
              message={item}
              isOwn={item.senderId === currentUserId}
              isGroup={isGroup}
              prevMessage={allMessages[index + 1]} // index + 1 vì inverted
              nextMessage={allMessages[index - 1]}
              onLongPress={handleLongPressMessage}
              onPressReplyTo={handleJumpToMessage}
            />
          )}
          ListEmptyComponent={<EmptyState icon={MessageSquare} title="Chưa có tin nhắn" description="Hãy bắt đầu cuộc trò chuyện!" />}
        />

        {/* Typing & Input */}
        <View style={{ paddingBottom: insets.bottom }}>
          <TypingIndicator typingUsers={typingUsers} currentUserId={currentUserId ?? ""} />
          <ChatInput
            onSend={handleSendMessage}
            onSendMedia={handleSendMedia}
            replyingTo={replyingTo}
            onClearReply={() => dispatch(clearReplyingTo())}
            onTyping={handleTyping}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Action Menu */}
      <MessageActionSheet
        message={selectedMessage}
        isOwn={selectedMessage?.senderId === currentUserId}
        onClose={() => setSelectedMessage(null)}
        onReply={handleReply}
        onEdit={(msg) => Alert.alert("Sửa tin nhắn", "Tính năng đang hoàn thiện")}
        onRecall={recallMessage}
        onDelete={deleteMessage}
        onTogglePin={togglePinMessage}
        onReact={reactMessage}
      />
    </SafeAreaView>
  );
}
