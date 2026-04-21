import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { FlatList, View, Keyboard } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import {
  ChatBubble,
  ChatFrameBanner,
  ChatHeader,
  ChatInput,
  MessageActionSheet,
  PollVoteModal,
  TypingIndicator,
  type ChatBubbleGroupExtras,
  type PendingAttachment,
  type PollVoteModalPoll,
} from "@/components/chat";
import { ChatPinnedReminderBar } from "@/components/chat/ChatPinnedReminderBar";
import { GroupManageModal, type GroupManagePanel } from "@/components/chat/GroupManageModal";
import { MessageSquare } from "lucide-react-native";
import { EmptyState } from "@/components/common/EmptyState";
import { Loading } from "@/components/common/Loading";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import {
  useGetConversationsQuery,
  useGetPollsQuery,
  useGetTasksQuery,
  useJoinTaskMutation,
  useUnvotePollMutation,
  useVotePollMutation,
} from "@/store/api/chatApi";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import { useChat } from "@/hooks/useChat";
import { useChatMessageData } from "@/hooks/useChatMessageData";
import { useConversationLifecycle } from "@/hooks/useConversationLifecycle";
import { setReplyingTo, clearReplyingTo, clearChatFrameBanner } from "@/store/slices/chatSlice";
import type { IMessage, TypingUserEntry } from "@/types/chat.types";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { toast } from "@/utils/appToast";
import { formatChatPreviewLine } from "@/utils/messageDisplay";

const EMPTY_TYPING_USERS: TypingUserEntry[] = [];

function toPollVoteModalPoll(raw: unknown): PollVoteModalPoll | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pollId = String(o.pollId ?? "").trim();
  if (!pollId) return null;
  const question = String(o.question ?? "");
  const optionsRaw = Array.isArray(o.options) ? o.options : [];
  const options = optionsRaw.map((opt) => {
    const ox = opt as Record<string, unknown>;
    return {
      text: String(ox.text ?? ""),
      voters: Array.isArray(ox.voters) ? (ox.voters as string[]) : [],
    };
  });
  return {
    pollId,
    question,
    options,
    isClosed: Boolean(o.isClosed),
    isMultipleChoice: Boolean(o.isMultipleChoice),
  };
}

/**
 * ChatDetailScreen — Màn hình chi tiết cuộc trò chuyện.
 * Tích hợp full realtime, media, reply, actions và typing indicators.
 */
export default function ChatDetailScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  const currentUserId = useAppSelector((state) => state.auth.user?.userId);
  const frameBanner = useAppSelector((state) => state.chat.frameBanner);
  const replyingTo = useAppSelector((state) => state.chat.replyingTo);
  const typingUsers = useAppSelector((state) =>
    conversationId
      ? (state.chat.typingUsers[conversationId] ?? EMPTY_TYPING_USERS)
      : EMPTY_TYPING_USERS,
  );

  const listRef = useRef<FlatList<IMessage>>(null);
  const [selectedMessage, setSelectedMessage] = useState<IMessage | null>(null);
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [votingIndex, setVotingIndex] = useState<number | null>(null);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [groupModalInitial, setGroupModalInitial] = useState<GroupManagePanel | undefined>(
    undefined,
  );

  const { allMessages, isLoading, latestMessageId } = useChatMessageData(conversationId);

  const pinnedMessages = useMemo(
    () =>
      allMessages
        .filter((m) => m.isPinned)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allMessages],
  );

  useConversationLifecycle({
    conversationId,
    latestMessageId,
  });

  useEffect(() => {
    dispatch(clearChatFrameBanner());
  }, [conversationId, dispatch]);

  const {
    sendMessage,
    sendMediaMessage,
    sendReplyMessage,
    recallMessage,
    deleteMessage,
    togglePinMessage,
    reactMessage,
    emitTyping,
  } = useChat();

  const [uploadMedia] = useUploadMediaMutation();

  const { data: convList } = useGetConversationsQuery();
  const conversation = useMemo(
    () => convList?.find((c) => c.conversationId === conversationId),
    [convList, conversationId],
  );

  const isGroup = conversation?.type === "group";

  const { data: tasksEnvelope } = useGetTasksQuery(conversationId!, {
    skip: !isGroup || !conversationId,
  });
  const { data: pollsEnvelope } = useGetPollsQuery(conversationId!, {
    skip: !isGroup || !conversationId,
  });

  const groupTasks = useMemo((): ChatBubbleGroupExtras["groupTasks"] => {
    const raw = tasksEnvelope?.data;
    return Array.isArray(raw) ? (raw as ChatBubbleGroupExtras["groupTasks"]) : [];
  }, [tasksEnvelope]);

  const pollsList = useMemo(() => {
    const raw = pollsEnvelope?.data;
    return Array.isArray(raw) ? raw : [];
  }, [pollsEnvelope]);

  const activePoll = useMemo(() => {
    if (!activePollId) return null;
    const found = pollsList.find((p) => String((p as { pollId?: string }).pollId) === activePollId);
    return found ? toPollVoteModalPoll(found) : null;
  }, [activePollId, pollsList]);

  const [joinTaskMut] = useJoinTaskMutation();
  const [votePollMut] = useVotePollMutation();
  const [unvotePollMut] = useUnvotePollMutation();

  const joinTask = useCallback(
    async (taskId: string) => {
      if (!conversationId) throw new Error("Thiếu hội thoại");
      await joinTaskMut({ groupId: conversationId, taskId }).unwrap();
    },
    [conversationId, joinTaskMut],
  );

  const handleTogglePollVote = useCallback(
    async (pollId: string, optionIndex: number) => {
      if (!conversationId || !currentUserId) return;
      const raw = pollsList.find((p) => String((p as { pollId?: string }).pollId) === pollId) as
        | { options?: { voters?: string[] }[] }
        | undefined;
      const had = Boolean(raw?.options?.[optionIndex]?.voters?.includes(currentUserId));
      setVotingIndex(optionIndex);
      try {
        if (had) {
          await unvotePollMut({ groupId: conversationId, pollId, optionIndex }).unwrap();
        } else {
          await votePollMut({ groupId: conversationId, pollId, optionIndex }).unwrap();
        }
      } catch {
        toast.error("Không thể cập nhật bình chọn");
      } finally {
        setVotingIndex(null);
      }
    },
    [conversationId, currentUserId, pollsList, unvotePollMut, votePollMut],
  );

  const groupExtras = useMemo((): ChatBubbleGroupExtras | undefined => {
    if (!isGroup || !conversationId || !currentUserId) return undefined;
    return {
      conversationId,
      currentUserId,
      groupTasks,
      joinTask,
      onOpenPollVote: (pollId) => setActivePollId(pollId),
    };
  }, [isGroup, conversationId, currentUserId, groupTasks, joinTask]);

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
            content: formatChatPreviewLine(replySnapshot, currentUserId ?? ""),
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
          optimisticMediaSize: attachment.size,
          optimisticMimeType: attachment.mimeType,
          clientReplyToDetails,
        });

        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch (err) {
        console.error("Upload/Send failed:", err);
        toast.error("Không thể gửi file. Vui lòng thử lại.");
      }
    },
    [conversationId, uploadMedia, sendMediaMessage, replyingTo, dispatch, currentUserId],
  );

  const handleLongPressMessage = useCallback((msg: IMessage) => {
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

  const handleTogglePinForSheet = useCallback(
    async (msg: IMessage) => {
      try {
        await togglePinMessage(msg);
      } catch {
        toast.error("Không cập nhật ghim được. Thử lại.");
      }
    },
    [togglePinMessage],
  );

  if (isLoading) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {conversation && (
        <ChatHeader
          conversation={conversation}
          currentUserId={currentUserId}
          typingUsers={typingUsers}
          memberCount={conversation.memberCount}
          onPressInfo={
            isGroup
              ? () => {
                  setGroupModalInitial(undefined);
                  setGroupManageOpen(true);
                }
              : undefined
          }
        />
      )}

      {isGroup && conversation ? (
        <GroupManageModal
          visible={groupManageOpen}
          onClose={() => {
            setGroupManageOpen(false);
            setGroupModalInitial(undefined);
          }}
          conversation={conversation}
          currentUserId={currentUserId}
          initialPanel={groupModalInitial}
        />
      ) : null}

      <ChatPinnedReminderBar
        pinnedMessages={pinnedMessages}
        tasksRaw={isGroup && tasksEnvelope?.data ? (tasksEnvelope.data as unknown[]) : []}
        isGroup={Boolean(isGroup)}
        currentUserId={currentUserId ?? ""}
        onJumpToMessage={handleJumpToMessage}
        onManagePins={
          isGroup
            ? () => {
                setGroupModalInitial("pinned");
                setGroupManageOpen(true);
              }
            : undefined
        }
      />

      {frameBanner && frameBanner.conversationId === conversationId ? (
        <ChatFrameBanner banner={frameBanner} />
      ) : null}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={allMessages}
          keyExtractor={(item) => item.messageId}
          inverted
          onScrollToIndexFailed={({ averageItemLength, index }) => {
            const offset = Math.max(0, index * (averageItemLength || 72));
            listRef.current?.scrollToOffset({ offset, animated: true });
          }}
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
              viewerUserId={currentUserId}
              isGroup={isGroup}
              prevMessage={allMessages[index + 1]}
              nextMessage={allMessages[index - 1]}
              onLongPress={handleLongPressMessage}
              onPressReplyTo={handleJumpToMessage}
              groupExtras={groupExtras}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={MessageSquare}
              title="Chưa có tin nhắn"
              description="Hãy bắt đầu cuộc trò chuyện!"
            />
          }
        />

        <View style={{ paddingBottom: insets.bottom }}>
          <TypingIndicator typingUsers={typingUsers} currentUserId={currentUserId ?? ""} />
          <ChatInput
            onSend={handleSendMessage}
            onSendMedia={handleSendMedia}
            replyingTo={replyingTo}
            currentUserId={currentUserId ?? ""}
            onClearReply={() => dispatch(clearReplyingTo())}
            onTyping={handleTyping}
          />
        </View>
      </KeyboardAvoidingView>

      <PollVoteModal
        visible={Boolean(activePollId && activePoll)}
        poll={activePoll}
        currentUserId={currentUserId ?? ""}
        votingIndex={votingIndex}
        onClose={() => setActivePollId(null)}
        onToggleOption={handleTogglePollVote}
      />

      <MessageActionSheet
        message={selectedMessage}
        isOwn={selectedMessage?.senderId === currentUserId}
        onClose={() => setSelectedMessage(null)}
        onReply={handleReply}
        onEdit={(_msg) => toast.info("Tính năng sửa tin đang hoàn thiện")}
        onRecall={recallMessage}
        onDelete={deleteMessage}
        onTogglePin={handleTogglePinForSheet}
        onReact={reactMessage}
      />
    </SafeAreaView>
  );
}
