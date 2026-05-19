import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, FlatList, Keyboard, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import {
  ChatBubble,
  ChatFrameBanner,
  ChatHeader,
  ChatInput,
  GroupMemberSendRestrictedBar,
  ChatInConversationSearchModal,
  ConversationPersonalSettingsModal,
  MessageActionSheet,
  PollVoteModal,
  TypingIndicator,
  type ChatBubbleGroupExtras,
  type PendingAttachment,
  type PollVoteModalPoll,
} from "@/components/chat";
import { ChatPinnedReminderBar } from "@/components/chat/ChatPinnedReminderBar";
import {
  ChatMediaLightbox,
  type ChatMediaLightboxState,
} from "@/components/chat/ChatMediaLightbox";
import { GroupManageModal, type GroupManagePanel } from "@/components/chat/GroupManageModal";
import { GroupAddMembersModal } from "@/components/chat/GroupAddMembersModal";
import { GroupPollModal } from "@/components/chat/GroupPollModal";
import { GroupTaskModal } from "@/components/chat/GroupTaskModal";
import { MessageSquare } from "lucide-react-native";
import { EmptyState } from "@/components/common/EmptyState";
import { Loading } from "@/components/common/Loading";
import { useUploadMediaMultiMutation } from "@/store/api/mediaApi";
import { messageTypeFromUploadResult } from "@/constants/chat-page.constants";
import {
  useDeleteTaskMutation,
  useGetConversationsQuery,
  useGetGroupMembersQuery,
  useGetPollsQuery,
  useGetTasksQuery,
  useJoinTaskMutation,
  useUnvotePollMutation,
  useVotePollMutation,
  useClosePollMutation,
  useAddPollOptionMutation,
} from "@/store/api/chatApi";
import { useCallContext } from "@/contexts/CallContext";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import { useChat } from "@/hooks/useChat";
import { useChatMessageData } from "@/hooks/useChatMessageData";
import { useConversationLifecycle } from "@/hooks/useConversationLifecycle";
import { useTaskReminderScheduler, type GroupTaskLike } from "@/hooks/useTaskReminderScheduler";
import { setReplyingTo, clearReplyingTo, clearChatFrameBanner } from "@/store/slices/chatSlice";
import type { IMessage, TypingUserEntry } from "@/types/chat.types";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { toast } from "@/utils/appToast";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import {
  chatMediaDownloadUrl,
  getChatMediaLightboxStateFromMessage,
  resolveChatFileBubbleMeta,
} from "@/utils/chatMediaDisplay";
import { openOrShareChatFile } from "@/utils/chatMediaDownload";
import {
  canUserCreatePollInGroup,
  canUserCreateTaskInGroup,
  canUserPinMessageInGroup,
  canUserSendMessageInGroup,
  resolveGroupMemberRole,
} from "@/utils/groupConversationPermissions";
import { filterGroupMembersExcludingRemoved } from "@/utils/groupMembersRealtime";
import { isTaskJoinDeadlinePassed } from "@/utils/taskJoin";
import { MAX_PINNED_PER_CONVERSATION } from "@/constants/chatPin";

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
    isPinned: Boolean(o.isPinned),
    creatorId: typeof o.creatorId === "string" ? o.creatorId : undefined,
  };
}

function findPollCreatedSystemMessage(messages: IMessage[], pollId: string): IMessage | null {
  const id = String(pollId).trim();
  if (!id) return null;
  for (const m of messages) {
    if (m.type !== "system") continue;
    const raw = String(m.content ?? "").trim();
    if (!raw.startsWith("{")) continue;
    try {
      const obj = JSON.parse(raw) as { kind?: string; poll?: { pollId?: string } };
      if (obj?.kind === "poll_created" && String(obj?.poll?.pollId ?? "").trim() === id) {
        return m;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
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
  const currentUserName = useAppSelector((state) => state.auth.user?.displayName ?? null);
  const frameBanner = useAppSelector((state) => state.chat.frameBanner);
  const activeGroupCall = useAppSelector((state) => state.call.activeGroupCall);
  const callStatus = useAppSelector((state) => state.call.status);
  const callScope = useAppSelector((state) => state.call.callScope);
  const callConversationId = useAppSelector((state) => state.call.conversationId);
  const callChannelName = useAppSelector((state) => state.call.channelName);
  const replyingTo = useAppSelector((state) => state.chat.replyingTo);
  const typingUsers = useAppSelector((state) =>
    conversationId
      ? (state.chat.typingUsers[conversationId] ?? EMPTY_TYPING_USERS)
      : EMPTY_TYPING_USERS,
  );

  const listRef = useRef<FlatList<IMessage>>(null);
  const jumpHighlightClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [jumpHighlightMessageId, setJumpHighlightMessageId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<IMessage | null>(null);
  const [mediaLightbox, setMediaLightbox] = useState<ChatMediaLightboxState>(null);
  const [activePollId, setActivePollId] = useState<string | null>(null);
  const [votingIndex, setVotingIndex] = useState<number | null>(null);
  const [groupManageOpen, setGroupManageOpen] = useState(false);
  const [openGroupTaskEditorId, setOpenGroupTaskEditorId] = useState<string | null>(null);
  const [groupModalInitial, setGroupModalInitial] = useState<GroupManagePanel | undefined>(
    undefined,
  );
  const [personalSettingsOpen, setPersonalSettingsOpen] = useState(false);
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [groupPollModalOpen, setGroupPollModalOpen] = useState(false);
  const [groupTaskModalOpen, setGroupTaskModalOpen] = useState(false);
  const [openAiSummaryOnGroupModal, setOpenAiSummaryOnGroupModal] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);

  const { allMessages, isLoading, latestMessageId } = useChatMessageData(conversationId);

  const pinnedMessages = useMemo(
    () =>
      allMessages
        .filter((m) => m.isPinned && !m.isRecalled && !m.isDeleted)
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

  useEffect(() => {
    setJumpHighlightMessageId(null);
    if (jumpHighlightClearRef.current) {
      clearTimeout(jumpHighlightClearRef.current);
      jumpHighlightClearRef.current = null;
    }
  }, [conversationId]);

  useEffect(() => {
    return () => {
      if (jumpHighlightClearRef.current) {
        clearTimeout(jumpHighlightClearRef.current);
        jumpHighlightClearRef.current = null;
      }
    };
  }, []);

  const { initiateCall, initiateGroupCall, joinActiveGroupCall } = useCallContext();

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

  const [uploadMediaMulti] = useUploadMediaMultiMutation();

  const { data: convList } = useGetConversationsQuery();
  const conversation = useMemo(
    () => convList?.find((c) => c.conversationId === conversationId),
    [convList, conversationId],
  );

  const isGroup = conversation?.type === "group";

  const { data: groupMembersRaw = [] } = useGetGroupMembersQuery(conversationId!, {
    skip: !isGroup || !conversationId,
  });

  const groupMembersForPerm = useMemo(() => {
    if (!conversationId) return [];
    return filterGroupMembersExcludingRemoved(conversationId, groupMembersRaw);
  }, [conversationId, groupMembersRaw]);

  const resolvedGroupMemberCount = useMemo(() => {
    if (!isGroup) return undefined;
    const fromList = groupMembersForPerm.length;
    if (fromList > 0) return fromList;
    return conversation?.memberCount;
  }, [isGroup, groupMembersForPerm.length, conversation?.memberCount]);

  const groupDisbanded = Boolean(isGroup && conversation?.isDeleted);

  const myRoleInGroup = useMemo(() => {
    if (!currentUserId) return undefined;
    return resolveGroupMemberRole({
      userId: currentUserId,
      members: groupMembersForPerm,
      conversationCreatorId: conversation?.creatorId,
    });
  }, [groupMembersForPerm, currentUserId, conversation?.creatorId]);

  const canSendInGroup = useMemo(() => {
    if (groupDisbanded) return false;
    if (!isGroup || !conversation) return true;
    return canUserSendMessageInGroup({
      conversation,
      userRole: myRoleInGroup,
      userId: currentUserId ?? "",
      members: groupMembersForPerm,
    });
  }, [groupDisbanded, isGroup, conversation, myRoleInGroup, currentUserId, groupMembersForPerm]);

  const canCreatePollInGroup = useMemo(() => {
    if (!isGroup || !conversation) return false;
    return canUserCreatePollInGroup({
      conversation,
      userRole: myRoleInGroup,
      userId: currentUserId ?? "",
      members: groupMembersForPerm,
    });
  }, [isGroup, conversation, myRoleInGroup, currentUserId, groupMembersForPerm]);

  const canCreateTaskInGroup = useMemo(() => {
    if (!isGroup || !conversation) return false;
    return canUserCreateTaskInGroup({
      conversation,
      userRole: myRoleInGroup,
      userId: currentUserId ?? "",
      members: groupMembersForPerm,
    });
  }, [isGroup, conversation, myRoleInGroup, currentUserId, groupMembersForPerm]);

  const { data: tasksEnvelope } = useGetTasksQuery(conversationId!, {
    skip: !isGroup || !conversationId,
  });
  const { data: pollsEnvelope } = useGetPollsQuery(conversationId!, {
    skip: !isGroup || !conversationId,
  });

  const groupTasksFromApi = useMemo((): ChatBubbleGroupExtras["groupTasks"] => {
    const raw = tasksEnvelope?.data;
    return Array.isArray(raw) ? (raw as ChatBubbleGroupExtras["groupTasks"]) : [];
  }, [tasksEnvelope]);

  /** Override participants locally để UI update ngay sau join. */
  const [localParticipantsByTaskId, setLocalParticipantsByTaskId] = useState<
    Record<string, string[]>
  >({});

  const groupTasks = useMemo((): ChatBubbleGroupExtras["groupTasks"] => {
    if (groupTasksFromApi.length === 0) return groupTasksFromApi;
    const hasAnyOverride = Object.keys(localParticipantsByTaskId).length > 0;
    if (!hasAnyOverride) return groupTasksFromApi;

    return groupTasksFromApi.map((t) => {
      const id = String((t as { taskId?: string }).taskId ?? "");
      if (!id) return t;
      const override = localParticipantsByTaskId[id];
      if (!override) return t;
      return { ...(t as object), participants: override } as (typeof groupTasksFromApi)[number];
    });
  }, [groupTasksFromApi, localParticipantsByTaskId]);

  const tasksForReminderScheduler = useMemo((): GroupTaskLike[] => {
    return (groupTasks as GroupTaskLike[]).filter((t) => String(t?.taskId ?? "").trim() !== "");
  }, [groupTasks]);

  useTaskReminderScheduler({
    conversationId: isGroup && conversationId ? conversationId : null,
    tasks: tasksForReminderScheduler,
    members: groupMembersForPerm.map((m) => ({
      userId: m.userId,
      displayName: m.displayName ?? null,
    })),
    currentUserId: currentUserId ?? "",
  });

  const pollsList = useMemo(() => {
    const raw = pollsEnvelope?.data;
    return Array.isArray(raw) ? raw : [];
  }, [pollsEnvelope]);

  const groupPollsForChat = useMemo((): PollVoteModalPoll[] => {
    return pollsList
      .map((p) => toPollVoteModalPoll(p))
      .filter((x): x is PollVoteModalPoll => x != null);
  }, [pollsList]);

  const activePoll = useMemo(() => {
    if (!activePollId) return null;
    const found = pollsList.find((p) => String((p as { pollId?: string }).pollId) === activePollId);
    const base = found ? toPollVoteModalPoll(found) : null;
    if (!base) return null;
    const pinMsg = findPollCreatedSystemMessage(allMessages, activePollId);
    const pinnedFromMessage = Boolean(pinMsg?.isPinned);
    return { ...base, isPinned: pinnedFromMessage || Boolean(base.isPinned) };
  }, [activePollId, pollsList, allMessages]);

  const [joinTaskMut] = useJoinTaskMutation();
  const [deleteTaskMut] = useDeleteTaskMutation();
  const [votePollMut] = useVotePollMutation();
  const [unvotePollMut] = useUnvotePollMutation();
  const [closePollMut] = useClosePollMutation();
  const [addPollOptionMut] = useAddPollOptionMutation();

  const consumeOpenGroupTaskEditor = useCallback(() => {
    setOpenGroupTaskEditorId(null);
  }, []);

  const handleEditGroupTask = useCallback(
    (taskId: string) => {
      const id = String(taskId).trim();
      if (!id) return;
      const taskRow = groupTasksFromApi.find((t) => String(t?.taskId ?? "") === id);
      const creatorId = String((taskRow as { creatorId?: string })?.creatorId ?? "").trim();
      if (!creatorId || creatorId !== String(currentUserId ?? "")) {
        toast.error("Chỉ người tạo mới chỉnh sửa được");
        return;
      }
      setGroupModalInitial("tasks");
      setOpenGroupTaskEditorId(id);
      setGroupManageOpen(true);
    },
    [groupTasksFromApi, currentUserId],
  );

  const handleDeleteGroupTask = useCallback(
    (taskId: string) => {
      if (!conversationId) return;
      const id = String(taskId).trim();
      if (!id) return;
      const taskRow = groupTasksFromApi.find((t) => String(t?.taskId ?? "") === id);
      const creatorId = String((taskRow as { creatorId?: string })?.creatorId ?? "").trim();
      if (!creatorId || creatorId !== String(currentUserId ?? "")) {
        toast.error("Chỉ người tạo mới được hủy công việc này");
        return;
      }
      Alert.alert(
        "Hủy công việc",
        "Bạn có chắc muốn hủy công việc này? Thành viên sẽ không còn thấy thẻ trong chat.",
        [
          { text: "Không", style: "cancel" },
          {
            text: "Hủy việc",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteTaskMut({ groupId: conversationId, taskId: id }).unwrap();
                  toast.success("Đã hủy công việc");
                } catch (err: unknown) {
                  const st = (err as { status?: number })?.status;
                  toast.error(
                    st === 403
                      ? "Chỉ người tạo mới được hủy công việc này"
                      : "Không thể hủy công việc",
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [conversationId, deleteTaskMut, groupTasksFromApi, currentUserId],
  );

  const joinTask = useCallback(
    async (taskId: string) => {
      if (!conversationId) throw new Error("Thiếu hội thoại");
      await joinTaskMut({ groupId: conversationId, taskId }).unwrap();
    },
    [conversationId, joinTaskMut],
  );

  const onTaskJoined = useCallback(
    (taskId: string) => {
      if (!conversationId || !currentUserId) return;
      const id = String(taskId);
      if (!id) return;

      const rawTask = groupTasksFromApi.find(
        (t) => String((t as { taskId?: string }).taskId) === id,
      ) as { title?: string; participants?: string[] } | undefined;
      const existing = localParticipantsByTaskId[id] ?? rawTask?.participants ?? [];
      const joinedNow = !existing.includes(currentUserId);
      if (!joinedNow) return;

      const next = Array.from(new Set([...existing, currentUserId]));
      setLocalParticipantsByTaskId((prev) => ({ ...prev, [id]: next }));
      /** Tin system `task_joined` chỉ từ server (`joinTask` → `createAndBroadcastSystemMessage`). Không dispatch/socket ở đây — tránh đúp trong khung chat + banner. */
    },
    [conversationId, currentUserId, groupTasksFromApi, localParticipantsByTaskId],
  );

  const handleTaskJoinedFromBulletin = useCallback(
    async (taskId: string) => {
      if (!conversationId || !currentUserId) return;
      const id = String(taskId).trim();
      if (!id) return;
      const rawTask = groupTasksFromApi.find(
        (t) => String((t as { taskId?: string }).taskId) === id,
      ) as { dueDate?: string; participants?: string[] } | undefined;
      if (rawTask?.dueDate && isTaskJoinDeadlinePassed(String(rawTask.dueDate))) {
        toast.error("Đã quá hạn, không thể xác nhận tham gia");
        return;
      }
      const existing = localParticipantsByTaskId[id] ?? rawTask?.participants ?? [];
      if (existing.includes(currentUserId)) return;
      try {
        await joinTask(id);
        onTaskJoined(id);
      } catch {
        toast.error("Không thể tham gia công việc");
      }
    },
    [
      conversationId,
      currentUserId,
      groupTasksFromApi,
      joinTask,
      localParticipantsByTaskId,
      onTaskJoined,
    ],
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

  const handleClosePoll = useCallback(
    async (pollId: string) => {
      const id = String(pollId).trim();
      if (!conversationId || !id) return;
      const pollRow = groupPollsForChat.find((p) => p.pollId === id);
      const pollCreatorId = String(pollRow?.creatorId ?? "").trim();
      if (!pollCreatorId || pollCreatorId !== String(currentUserId ?? "")) {
        toast.error("Chỉ người tạo mới được khóa bình chọn");
        return;
      }
      try {
        await closePollMut({ groupId: conversationId, pollId: id }).unwrap();
        toast.success("Đã đóng bình chọn");
        setActivePollId(null);
      } catch (err: unknown) {
        const st = (err as { status?: number })?.status;
        toast.error(
          st === 403 ? "Chỉ người tạo mới được khóa bình chọn" : "Không đóng được bình chọn",
        );
      }
    },
    [conversationId, closePollMut, groupPollsForChat, currentUserId],
  );

  const handleAddPollOption = useCallback(
    async (pollId: string, text: string) => {
      const id = String(pollId).trim();
      const t = text.trim();
      if (!conversationId || !id || !t) return;
      try {
        await addPollOptionMut({ groupId: conversationId, pollId: id, text: t }).unwrap();
        toast.success("Đã thêm lựa chọn");
      } catch {
        toast.error("Không thêm được lựa chọn");
      }
    },
    [conversationId, addPollOptionMut],
  );

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!conversationId) return;
      if (!canSendInGroup) return;

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
    [conversationId, replyingTo, sendReplyMessage, sendMessage, dispatch, canSendInGroup],
  );

  const handleSendMedia = useCallback(
    async (attachments: PendingAttachment[], caption: string) => {
      if (!conversationId) {
        toast.error("Không tìm thấy hội thoại.");
        throw new Error("no_conversation");
      }
      if (!canSendInGroup) {
        toast.error("Bạn không có quyền gửi tin trong nhóm này.");
        throw new Error("no_permission");
      }
      if (attachments.length === 0) return;

      const replySnapshot = replyingTo;
      if (replySnapshot) {
        dispatch(clearReplyingTo());
      }

      const replyToId =
        replySnapshot?.messageId && !replySnapshot.messageId.startsWith("optimistic-")
          ? replySnapshot.messageId
          : undefined;

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
        const preparedFiles = await Promise.all(
          attachments.map((attachment) =>
            prepareLocalFileForUpload({
              uri: attachment.uri,
              name: attachment.name,
              mimeType: attachment.mimeType,
            }),
          ),
        );

        const uploadResults = await uploadMediaMulti({
          files: preparedFiles.map((f) => ({
            uri: f.uri,
            name: f.name,
            type: f.type,
          })),
        }).unwrap();

        if (!uploadResults?.length) {
          throw new Error("upload_missing_results");
        }

        const captionFirst = caption.trim().length > 0 ? caption.trim() : " ";

        for (let i = 0; i < uploadResults.length; i++) {
          const result = uploadResults[i]!;
          const attachment = attachments[i];
          const prepared = preparedFiles[i];
          if (!result?.mediaId) {
            throw new Error("upload_missing_media_id");
          }

          const displayName = attachment?.name?.trim() || prepared?.name;
          const displayMime = result.mimeType?.trim() || attachment?.mimeType;

          await sendMediaMessage(
            conversationId,
            messageTypeFromUploadResult(result),
            i === 0 ? captionFirst : " ",
            result.mediaId,
            i === 0 ? replyToId : undefined,
            {
              optimisticLocalUri: prepared?.uri,
              optimisticMediaName: displayName,
              optimisticMediaSize: result.size ?? attachment?.size,
              optimisticMimeType: displayMime,
              clientReplyToDetails: i === 0 ? clientReplyToDetails : undefined,
            },
          );
        }

        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch (err) {
        console.error("Upload/Send failed:", err);
        const apiMsg =
          err &&
          typeof err === "object" &&
          "data" in err &&
          (err as { data?: { message?: string; error?: { message?: string } } }).data
            ? String(
                (err as { data?: { message?: string; error?: { message?: string } } }).data?.error
                  ?.message ??
                  (err as { data?: { message?: string } }).data?.message ??
                  "",
              ).trim()
            : "";
        toast.error(apiMsg || "Gửi tệp thất bại. Vui lòng thử lại.");
        throw err;
      }
    },
    [
      conversationId,
      canSendInGroup,
      uploadMediaMulti,
      sendMediaMessage,
      replyingTo,
      dispatch,
      currentUserId,
    ],
  );

  const handleLongPressMessage = useCallback((msg: IMessage) => {
    Keyboard?.dismiss?.();
    setTimeout(() => setSelectedMessage(msg), 120);
  }, []);

  const handlePreviewMediaFromSheet = useCallback((msg: IMessage) => {
    const state = getChatMediaLightboxStateFromMessage(msg);
    if (state) setMediaLightbox(state);
  }, []);

  const handleOpenFileFromSheet = useCallback(async (msg: IMessage) => {
    const url = chatMediaDownloadUrl(msg);
    if (!url) {
      toast.error("Không có file để mở.");
      return;
    }
    const { fileName } = resolveChatFileBubbleMeta(msg);
    try {
      const ok = await openOrShareChatFile(url, fileName, msg.mediaType);
      if (!ok) toast.error("Không mở được file.");
    } catch {
      toast.error("Không mở được file.");
    }
  }, []);

  const handleReply = useCallback(
    (msg: IMessage) => {
      dispatch(setReplyingTo(msg));
    },
    [dispatch],
  );

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      const mid = String(messageId ?? "").trim();
      if (!mid) return;

      if (jumpHighlightClearRef.current) {
        clearTimeout(jumpHighlightClearRef.current);
        jumpHighlightClearRef.current = null;
      }
      setJumpHighlightMessageId(mid);

      const tryScroll = (remaining: number) => {
        const index = allMessages.findIndex((m) => m.messageId === mid);
        if (index !== -1) {
          try {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
          } catch {
            listRef.current?.scrollToIndex({ index, animated: true });
          }
          return;
        }
        if (remaining <= 0) {
          setJumpHighlightMessageId(null);
          toast.info("Chưa thấy tin trong danh sách. Kéo lên để tải thêm tin cũ rồi thử lại.");
          return;
        }
        setTimeout(() => tryScroll(remaining - 1), 120);
      };

      requestAnimationFrame(() => tryScroll(10));

      jumpHighlightClearRef.current = setTimeout(() => {
        setJumpHighlightMessageId(null);
        jumpHighlightClearRef.current = null;
      }, 2300);
    },
    [allMessages],
  );

  const handleJumpToTaskCard = useCallback(
    (taskId: string) => {
      const tid = String(taskId ?? "").trim();
      if (!tid || !conversationId) return;
      let targetMessageId = `local-task-card:${conversationId}:${tid}`;
      for (const m of allMessages) {
        if (m.type !== "system") continue;
        const raw = String(m.content ?? "").trim();
        if (!raw.startsWith("{")) continue;
        try {
          const p = JSON.parse(raw) as { kind?: string; task?: { taskId?: string } };
          if (p?.kind === "task_assigned") {
            const mtid = String(p?.task?.taskId ?? "").trim();
            if (mtid === tid) {
              targetMessageId = m.messageId;
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }
      handleJumpToMessage(targetMessageId);
    },
    [allMessages, conversationId, handleJumpToMessage],
  );

  const handleOpenGroupTaskFromSystem = useCallback((taskId: string) => {
    const id = String(taskId).trim();
    if (!id) return;
    setGroupModalInitial("tasks");
    setOpenGroupTaskEditorId(id);
    setGroupManageOpen(true);
  }, []);

  const groupExtras = useMemo((): ChatBubbleGroupExtras | undefined => {
    if (!isGroup || !conversationId || !currentUserId) return undefined;
    return {
      conversationId,
      currentUserId,
      groupMembers: groupMembersForPerm.map((m) => ({
        userId: m.userId,
        displayName: String(m.displayName ?? m.userId ?? "").trim() || m.userId,
      })),
      groupTasks,
      groupPolls: groupPollsForChat,
      joinTask,
      onTaskJoined,
      onOpenPollVote: (pollId) => setActivePollId(pollId),
      onJumpToTaskCard: handleJumpToTaskCard,
      onOpenGroupTaskSheet: handleOpenGroupTaskFromSystem,
      onEditGroupTask: handleEditGroupTask,
      onDeleteGroupTask: handleDeleteGroupTask,
    };
  }, [
    isGroup,
    conversationId,
    currentUserId,
    groupMembersForPerm,
    groupTasks,
    groupPollsForChat,
    joinTask,
    onTaskJoined,
    handleJumpToTaskCard,
    handleOpenGroupTaskFromSystem,
    handleEditGroupTask,
    handleDeleteGroupTask,
  ]);

  const handleTyping = useCallback(() => {
    if (conversationId) emitTyping(conversationId);
  }, [conversationId, emitTyping]);

  const handleTogglePinForSheet = useCallback(
    async (msg: IMessage) => {
      try {
        if (
          conversation?.type === "group" &&
          !canUserPinMessageInGroup({
            conversation,
            userRole: myRoleInGroup,
          })
        ) {
          toast.error(
            msg.isPinned
              ? "Nhóm không cho phép thành viên bỏ/ghim tin nhắn."
              : "Nhóm không cho phép thành viên ghim tin nhắn.",
          );
          return;
        }
        if (!msg.isPinned) {
          const pinCount = allMessages.filter(
            (m) =>
              m.conversationId === msg.conversationId &&
              m.isPinned &&
              !m.isRecalled &&
              !m.isDeleted,
          ).length;
          if (pinCount >= MAX_PINNED_PER_CONVERSATION) {
            toast.error(
              `Đã đủ ${MAX_PINNED_PER_CONVERSATION} tin ghim. Bỏ ghim một tin cũ để ghim tin mới.`,
            );
            return;
          }
        }
        await togglePinMessage(msg);
      } catch {
        toast.error("Không cập nhật ghim được. Thử lại.");
      }
    },
    [allMessages, conversation, myRoleInGroup, togglePinMessage],
  );

  const handleTogglePinPoll = useCallback(
    (pollId: string) => {
      const id = String(pollId).trim();
      if (!id) return;
      const m = findPollCreatedSystemMessage(allMessages, id);
      if (!m) {
        toast.error("Không tìm thấy tin tạo bình chọn để ghim.");
        return;
      }
      void handleTogglePinForSheet(m);
    },
    [allMessages, handleTogglePinForSheet],
  );

  const handlePressAudioCall = useCallback(() => {
    if (!conversationId) return;
    if (conversation?.type === "group") {
      initiateGroupCall("audio", conversationId);
    } else if (conversation?.otherUserId) {
      initiateCall(conversation.otherUserId, "audio", conversationId);
    } else {
      Alert.alert("Lỗi", "Không xác định được người nhận cuộc gọi.");
    }
  }, [conversation, conversationId, initiateCall, initiateGroupCall]);

  const handlePressVideoCall = useCallback(() => {
    if (!conversationId) return;
    if (conversation?.type === "group") {
      initiateGroupCall("video", conversationId);
    } else if (conversation?.otherUserId) {
      initiateCall(conversation.otherUserId, "video", conversationId);
    } else {
      Alert.alert("Lỗi", "Không xác định được người nhận cuộc gọi.");
    }
  }, [conversation, conversationId, initiateCall, initiateGroupCall]);

  const inThisGroupCallFlow =
    Boolean(isGroup) &&
    Boolean(conversationId) &&
    activeGroupCall?.conversationId === conversationId &&
    callScope === "group" &&
    callConversationId === conversationId &&
    ["incoming-ringing", "outgoing-ringing", "connecting", "connected"].includes(callStatus) &&
    (!activeGroupCall.channelName ||
      !callChannelName ||
      activeGroupCall.channelName === callChannelName);
  const showJoinGroupBanner =
    Boolean(isGroup) &&
    Boolean(conversationId) &&
    activeGroupCall?.conversationId === conversationId &&
    !inThisGroupCallFlow;

  const joinGroupCallLabel = useMemo(() => {
    if (!showJoinGroupBanner) return undefined;
    return activeGroupCall?.type === "video" ? "Tham gia video" : "Tham gia thoại";
  }, [showJoinGroupBanner, activeGroupCall?.type]);

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
          memberCount={resolvedGroupMemberCount}
          onPressSearch={() => setInChatSearchOpen(true)}
          onPressAddMember={isGroup ? () => setAddMembersOpen(true) : undefined}
          onPressEditGroup={
            isGroup
              ? () => {
                  setOpenAiSummaryOnGroupModal(false);
                  setGroupModalInitial("rename");
                  setOpenGroupTaskEditorId(null);
                  setGroupManageOpen(true);
                }
              : undefined
          }
          onPressInfo={
            isGroup
              ? () => {
                  setOpenAiSummaryOnGroupModal(false);
                  setGroupModalInitial(undefined);
                  setOpenGroupTaskEditorId(null);
                  setGroupManageOpen(true);
                }
              : () => setPersonalSettingsOpen(true)
          }
          onPressCall={handlePressAudioCall}
          onPressVideoCall={showJoinGroupBanner ? joinActiveGroupCall : handlePressVideoCall}
          videoCtaVariant={showJoinGroupBanner ? "join" : "icon"}
          videoCtaLabel={joinGroupCallLabel}
        />
      )}

      {isGroup && conversation ? (
        <GroupManageModal
          visible={groupManageOpen}
          onClose={() => {
            setGroupManageOpen(false);
            setGroupModalInitial(undefined);
            setOpenGroupTaskEditorId(null);
            setOpenAiSummaryOnGroupModal(false);
          }}
          openAiSummaryWhenVisible={openAiSummaryOnGroupModal}
          conversation={conversation}
          currentUserId={currentUserId}
          initialPanel={groupModalInitial}
          initialTaskIdForEditor={openGroupTaskEditorId}
          onConsumedInitialTaskEditor={consumeOpenGroupTaskEditor}
          onJumpToMessage={handleJumpToMessage}
          onOpenPollVote={(pollId) => setActivePollId(pollId)}
          onClosePoll={handleClosePoll}
          onAddPollOption={handleAddPollOption}
          onTaskJoined={handleTaskJoinedFromBulletin}
          onEditTaskFromBulletin={(task) => {
            const taskId = String((task as { taskId?: string }).taskId ?? "").trim();
            if (taskId) handleEditGroupTask(taskId);
          }}
          onDeleteTaskFromBulletin={handleDeleteGroupTask}
        />
      ) : null}

      {isGroup && conversation ? (
        <GroupAddMembersModal
          visible={addMembersOpen}
          onClose={() => setAddMembersOpen(false)}
          groupId={conversationId!}
          conversation={conversation}
        />
      ) : null}

      {conversation && !isGroup ? (
        <ConversationPersonalSettingsModal
          visible={personalSettingsOpen}
          conversation={conversation}
          onClose={() => setPersonalSettingsOpen(false)}
        />
      ) : null}

      <ChatPinnedReminderBar
        pinnedMessages={pinnedMessages}
        currentUserId={currentUserId ?? ""}
        onJumpToMessage={handleJumpToMessage}
        onTogglePin={handleTogglePinForSheet}
      />

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
            paddingHorizontal: 16,
            paddingVertical: 16,
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
              isJumpHighlighted={jumpHighlightMessageId === item.messageId}
              groupExtras={groupExtras}
              onMediaLightbox={setMediaLightbox}
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

        <View
          className="border-t border-border/40 bg-background/95 dark:bg-background"
          style={{ paddingBottom: insets.bottom }}
        >
          {isGroup && frameBanner && frameBanner.conversationId === conversationId ? (
            <ChatFrameBanner
              banner={frameBanner}
              onOpenPoll={(pollId) => setActivePollId(pollId)}
            />
          ) : null}
          <TypingIndicator typingUsers={typingUsers} currentUserId={currentUserId ?? ""} />
          {groupDisbanded ? (
            <View className="border-t border-border/30 bg-muted/30 px-4 py-5">
              <Text className="text-center text-[15px] font-semibold text-foreground">
                Nhóm đã được giải tán
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                Không thể gửi tin nhắn mới trong cuộc trò chuyện này.
              </Text>
            </View>
          ) : canSendInGroup ? (
            <ChatInput
              onSend={handleSendMessage}
              onSendMedia={handleSendMedia}
              replyingTo={replyingTo}
              currentUserId={currentUserId ?? ""}
              activeConversationId={conversationId ?? null}
              conversationName={conversation?.name ?? undefined}
              onClearReply={() => dispatch(clearReplyingTo())}
              onTyping={handleTyping}
              isGroup={isGroup}
              onOpenPoll={
                isGroup && canCreatePollInGroup
                  ? () => setGroupPollModalOpen(true)
                  : isGroup
                    ? () => toast.error("Nhóm không cho phép thành viên tạo bình chọn.")
                    : undefined
              }
              onOpenTask={
                isGroup && canCreateTaskInGroup
                  ? () => setGroupTaskModalOpen(true)
                  : isGroup
                    ? () => toast.error("Nhóm không cho phép thành viên tạo công việc / nhắc hẹn.")
                    : undefined
              }
              onOpenAiSummary={
                isGroup
                  ? () => {
                      setOpenAiSummaryOnGroupModal(true);
                      setGroupModalInitial(undefined);
                      setGroupManageOpen(true);
                    }
                  : undefined
              }
            />
          ) : (
            <GroupMemberSendRestrictedBar />
          )}
        </View>
      </KeyboardAvoidingView>

      {isGroup && conversationId ? (
        <>
          <GroupPollModal
            visible={groupPollModalOpen}
            onClose={() => setGroupPollModalOpen(false)}
            groupId={conversationId}
            canCreatePollUi={canCreatePollInGroup}
          />
          <GroupTaskModal
            visible={groupTaskModalOpen}
            onClose={() => setGroupTaskModalOpen(false)}
            groupId={conversationId}
            members={groupMembersForPerm.map((m) => ({
              userId: m.userId,
              displayName: m.displayName,
              avatar: m.avatar,
            }))}
            currentUserId={currentUserId}
          />
        </>
      ) : null}

      <PollVoteModal
        visible={Boolean(activePollId && activePoll)}
        poll={activePoll}
        currentUserId={currentUserId ?? ""}
        votingIndex={votingIndex}
        onClose={() => setActivePollId(null)}
        onToggleOption={handleTogglePollVote}
        onClosePoll={isGroup ? handleClosePoll : undefined}
        onTogglePinPoll={isGroup ? handleTogglePinPoll : undefined}
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
        onPreviewMedia={handlePreviewMediaFromSheet}
        onOpenFile={handleOpenFileFromSheet}
      />

      <ChatMediaLightbox state={mediaLightbox} onClose={() => setMediaLightbox(null)} />

      <ChatInConversationSearchModal
        visible={inChatSearchOpen}
        onClose={() => setInChatSearchOpen(false)}
        messages={allMessages}
        currentUserId={currentUserId}
        onSelectMessage={handleJumpToMessage}
      />
    </SafeAreaView>
  );
}
