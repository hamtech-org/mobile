import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  Alert,
  FlatList,
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
import { AISummaryModal } from "@/components/chat/AISummaryModal";
import { ChatPinnedReminderBar } from "@/components/chat/ChatPinnedReminderBar";
import { PinLimitModal } from "@/components/chat/PinLimitModal";
import {
  ChatMediaLightbox,
  type ChatMediaLightboxState,
} from "@/components/chat/ChatMediaLightbox";
import { GroupManageModal, type GroupManagePanel } from "@/components/chat/GroupManageModal";
import { GroupAddMembersModal } from "@/components/chat/GroupAddMembersModal";
import { GroupPollModal } from "@/components/chat/GroupPollModal";
import { GroupTaskModal } from "@/components/chat/GroupTaskModal";
import { ChevronDown, MessageSquare } from "lucide-react-native";
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
  useSendMessageMutation,
  chatApi,
  CHAT_MESSAGES_QUERY_LIMIT,
} from "@/store/api/chatApi";
import { useGetFriendsQuery } from "@/store/api/userApi";
import { useCallContext } from "@/contexts/CallContext";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppStore";
import { useChat } from "@/hooks/useChat";
import { useChatMessageData } from "@/hooks/useChatMessageData";
import { useMessagePinController } from "@/hooks/useMessagePinController";
import { useConversationLifecycle } from "@/hooks/useConversationLifecycle";
import { useTaskReminderScheduler, type GroupTaskLike } from "@/hooks/useTaskReminderScheduler";
import { setReplyingTo, clearReplyingTo, clearChatFrameBanner } from "@/store/slices/chatSlice";
import type { IMessage, TypingUserEntry, IMessagePage } from "@/types/chat.types";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { toast } from "@/utils/appToast";
import { apiClient } from "@/services/api";
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
  canUserSendMessageInGroup,
  resolveGroupMemberRole,
} from "@/utils/groupConversationPermissions";
import { filterGroupMembersExcludingRemoved } from "@/utils/groupMembersRealtime";
import { isTaskJoinDeadlinePassed } from "@/utils/taskJoin";
const EMPTY_TYPING_USERS: TypingUserEntry[] = [];

function messageSendErrorText(error: unknown): string {
  const code = (error as { data?: { error?: { code?: string } } })?.data?.error?.code;
  if (code === "MESSAGE_BLOCKED_BY_ME") {
    return "Bạn đang chặn người dùng này, vui lòng gỡ chặn để tiếp tục nhắn tin.";
  }
  if (code === "MESSAGE_BLOCKED_BY_OTHER") {
    return "Bạn đã bị chặn bởi người dùng này.";
  }
  return "Gửi tin nhắn thất bại. Vui lòng thử lại.";
}

interface AIGroupSummaryPayload {
  summary?: string;
  highlights?: string[];
  unreadSummary?: string;
  unreadMessageCount?: number;
}

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

function bulletizeSummaryLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("-") || line.startsWith("•") ? line : `• ${line}`))
    .join("\n");
}

function buildAiSummaryText(payload: AIGroupSummaryPayload): string {
  const summary = String(payload.summary ?? "").trim();
  const highlights = Array.isArray(payload.highlights) ? payload.highlights : [];
  const unreadSummary = String(payload.unreadSummary ?? "").trim();
  const unreadMessageCount = Number(payload.unreadMessageCount ?? 0);

  const summaryBlock = summary
    ? `Tổng hợp tin nhắn\n${bulletizeSummaryLines(summary)}`
    : "Tổng hợp tin nhắn\n• (Chưa có)";

  const highlightsBlock =
    highlights.length > 0
      ? `Điểm nổi bật\n${highlights.map((h) => `• ${String(h).trim()}`).join("\n")}`
      : "Điểm nổi bật\n• Không có";

  const unreadSummaryBlock = unreadSummary
    ? `Tin nhắn vừa bỏ lỡ (${unreadMessageCount})\n${bulletizeSummaryLines(unreadSummary)}`
    : `Tin nhắn vừa bỏ lỡ (${unreadMessageCount})\n• (Chưa có)`;

  return [summaryBlock, highlightsBlock, unreadSummaryBlock].join("\n\n");
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
  const currentUserAvatar = useAppSelector((state) => state.auth.user?.avatar ?? null);
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
  const friendStatuses = useAppSelector((state) => state.chat.friendStatuses);

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
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState("");
  const [openAiSummaryOnGroupModal, setOpenAiSummaryOnGroupModal] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const { allMessages, pinnedMessagesOrdered, isLoading, latestMessageId } =
    useChatMessageData(conversationId);

  const lastUserMessageIndex = useMemo(() => {
    return allMessages.findIndex((m) => m.type !== "system" && (m as any).position !== "center");
  }, [allMessages]);

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
    sendVoiceMessage,
    sendReplyMessage,
    recallMessage,
    deleteMessage,
    reactMessage,
    emitTyping,
    emitTypingStop,
  } = useChat();

  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
    return () => {
      if (conversationIdRef.current) {
        emitTypingStop(conversationIdRef.current);
      }
    };
  }, [conversationId, emitTypingStop]);

  const [uploadMediaMulti] = useUploadMediaMultiMutation();
  const [sendMessageMutation] = useSendMessageMutation();

  const { data: convList, isLoading: isConvListLoading } = useGetConversationsQuery();
  const conversation = useMemo(
    () => convList?.find((c) => c.conversationId === conversationId),
    [convList, conversationId],
  );

  // Tự động quay lại nếu cuộc trò chuyện không còn tồn tại (bị kick hoặc rời đi)
  useEffect(() => {
    if (convList && !isConvListLoading && conversationId) {
      const exists = convList.some((c) => c.conversationId === conversationId);
      if (!exists) {
        const timer = setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(main)");
          }
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [convList, isConvListLoading, conversationId]);

  const isGroup = conversation?.type === "group";
  const directOtherUserId =
    conversation && conversation.type !== "group" ? conversation.otherUserId?.trim() : undefined;
  const { data: friends = [] } = useGetFriendsQuery(undefined, {
    skip: !directOtherUserId,
  });
  const directFriendStatus = directOtherUserId
    ? (friendStatuses[directOtherUserId] ??
      friends.find((friend) => friend.userId === directOtherUserId)?.status)
    : undefined;
  const isDirectFriendOnline = directFriendStatus === "online";

  const { data: groupMembersRaw = [] } = useGetGroupMembersQuery(conversationId!, {
    skip: !isGroup || !conversationId,
  });

  const groupMembersForPerm = useMemo(() => {
    if (!conversationId) return [];
    return filterGroupMembersExcludingRemoved(conversationId, groupMembersRaw);
  }, [conversationId, groupMembersRaw]);

  const conversationSearchMembers = useMemo(() => {
    if (groupMembersForPerm.length > 0) {
      return groupMembersForPerm.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        avatar: m.avatar ?? null,
      }));
    }
    if (!conversation || conversation.type === "group") return [];
    const otherId = conversation.otherUserId?.trim();
    if (!otherId) return [];
    const rows: {
      userId: string;
      displayName: string | null;
      avatar?: string | null;
    }[] = [];
    const selfId = currentUserId?.trim();
    const selfAvatar = (typeof currentUserAvatar === "string" ? currentUserAvatar : "").trim();
    if (selfId) {
      rows.push({ userId: selfId, displayName: "Bạn", avatar: selfAvatar || null });
    }
    rows.push({
      userId: otherId,
      displayName: (conversation.name ?? "").trim() || null,
      avatar: conversation.avatar ?? null,
    });
    return rows;
  }, [groupMembersForPerm, conversation, currentUserId, currentUserAvatar]);

  const memberAvatarById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of groupMembersForPerm) {
      const url = m.avatar?.trim();
      if (url) map[m.userId] = url;
    }
    const otherId = conversation?.otherUserId?.trim();
    const avatar = conversation?.avatar?.trim();
    if (otherId && avatar) map[otherId] = avatar;
    const selfId = currentUserId?.trim();
    const selfAvatar = (typeof currentUserAvatar === "string" ? currentUserAvatar : "").trim();
    if (selfId && selfAvatar) map[selfId] = selfAvatar;
    return map;
  }, [
    groupMembersForPerm,
    conversation?.otherUserId,
    conversation?.avatar,
    currentUserId,
    currentUserAvatar,
  ]);

  const resolvedGroupMemberCount = useMemo(() => {
    if (!isGroup) return undefined;
    const fromList = groupMembersForPerm.length;
    if (fromList > 0) return fromList;
    return conversation?.memberCount;
  }, [isGroup, groupMembersForPerm.length, conversation?.memberCount]);

  const groupDisbanded = Boolean(isGroup && conversation?.isDeleted);
  const chatPaused = Boolean(isGroup && conversation?.chatEnabled === false);

  const runAiSummary = useCallback(
    async (showSuccessToast: boolean) => {
      if (!conversationId) return;
      setAiSummaryResult("");
      setAiSummaryLoading(true);
      try {
        const result = await apiClient.post<{
          success?: boolean;
          data?: AIGroupSummaryPayload;
        }>("/ai/group-summary", {
          conversationId,
          limit: 40,
        });
        setAiSummaryResult(buildAiSummaryText(result.data?.data ?? {}));
        if (showSuccessToast) {
          toast.success("Đã tạo tóm tắt AI");
        }
      } catch (error) {
        console.error("Failed to generate AI summary:", error);
        setAiSummaryResult(
          showSuccessToast ? "Không thể làm mới tóm tắt." : "Không thể tạo tóm tắt vào lúc này.",
        );
        if (showSuccessToast) {
          toast.error("Không thể tạo tóm tắt AI");
        }
      } finally {
        setAiSummaryLoading(false);
      }
    },
    [conversationId],
  );

  const openAiSummaryModal = useCallback(() => {
    setAiSummaryOpen(true);
    void runAiSummary(false);
  }, [runAiSummary]);

  const myRoleInGroup = useMemo(() => {
    if (!currentUserId) return undefined;
    return resolveGroupMemberRole({
      userId: currentUserId,
      members: groupMembersForPerm,
      conversationCreatorId: conversation?.creatorId,
    });
  }, [groupMembersForPerm, currentUserId, conversation?.creatorId]);

  const pinController = useMessagePinController({
    activeConversation: conversation,
    currentUserId: currentUserId ?? "",
    groupMembers: groupMembersForPerm,
    pinnedMessagesOrdered,
    allMessages,
  });

  const canSendInGroup = useMemo(() => {
    if (groupDisbanded) return false;
    if (chatPaused) return false;
    if (!isGroup || !conversation) return true;
    return canUserSendMessageInGroup({
      conversation,
      userRole: myRoleInGroup,
      userId: currentUserId ?? "",
      members: groupMembersForPerm,
    });
  }, [
    groupDisbanded,
    chatPaused,
    isGroup,
    conversation,
    myRoleInGroup,
    currentUserId,
    groupMembersForPerm,
  ]);

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

  useEffect(() => {
    setLocalParticipantsByTaskId((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;

      let changed = false;
      const next = { ...prev };
      for (const [taskId, localParticipants] of entries) {
        const serverTask = groupTasksFromApi.find(
          (t) => String((t as { taskId?: string }).taskId ?? "") === String(taskId),
        );
        if (!serverTask) {
          delete next[taskId];
          changed = true;
          continue;
        }

        const serverParticipants = Array.isArray(
          (serverTask as { participants?: unknown }).participants,
        )
          ? ((serverTask as { participants?: unknown[] }).participants ?? []).map(String)
          : null;
        if (!serverParticipants) continue;

        const serverKey = [...serverParticipants].sort().join("\0");
        const localKey = [...localParticipants.map(String)].sort().join("\0");
        if (serverKey === localKey) continue;

        if (serverParticipants.length > 0) next[taskId] = serverParticipants;
        else delete next[taskId];
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [groupTasksFromApi]);

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
    (content: string, mentions?: string[]) => {
      if (!conversationId) return;
      if (!canSendInGroup) return;

      emitTypingStop(conversationId);
      const reply = replyingTo;
      if (reply) {
        dispatch(clearReplyingTo());
        void sendReplyMessage(conversationId, content, reply, mentions).catch((err) => {
          console.error("sendReplyMessage:", err);
          toast.error(messageSendErrorText(err));
        });
      } else {
        void sendMessage(conversationId, content, mentions).catch((err) => {
          console.error("sendMessage:", err);
          toast.error(messageSendErrorText(err));
        });
      }

      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    },
    [
      conversationId,
      replyingTo,
      sendReplyMessage,
      sendMessage,
      dispatch,
      canSendInGroup,
      emitTypingStop,
    ],
  );

  const handleSendMedia = useCallback(
    async (attachments: PendingAttachment[], caption: string) => {
      if (!conversationId) {
        toast.error("Không tìm thấy hội thoại.");
        return;
      }
      if (!canSendInGroup) {
        toast.error("Bạn không có quyền gửi tin trong nhóm này.");
        return;
      }
      emitTypingStop(conversationId);
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

      // 1. Tạo clientTempId và tạo optimistic message
      const clientTempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const captionFirst = caption.trim().length > 0 ? caption.trim() : " ";

      const mediaAttachments = attachments.filter(
        (att) => att.mimeType?.startsWith("image/") || att.mimeType?.startsWith("video/"),
      );
      const otherAttachments = attachments.filter(
        (att) => !att.mimeType?.startsWith("image/") && !att.mimeType?.startsWith("video/"),
      );

      // Trực quan hóa optimistic bubble ngay lập tức dưới nền
      // Nếu gửi album (>= 2 media)
      const isAlbum = mediaAttachments.length >= 2;

      const optimisticMsg: IMessage = {
        messageId: clientTempId,
        conversationId,
        senderId: currentUserId ?? "",
        senderDisplayName: "Đang gửi...", // Sẽ được merge/replace sau
        type: isAlbum
          ? "album"
          : attachments[0].mimeType?.startsWith("video/")
            ? "video"
            : attachments[0].mimeType?.startsWith("image/")
              ? "image"
              : "file",
        content: captionFirst,
        mediaUrl: attachments[0].uri,
        mediaType: attachments[0].mimeType,
        mediaSize: attachments[0].size,
        mediaOriginalName: attachments[0].name,
        thumbnailUrl: attachments[0].uri,
        medias: isAlbum
          ? mediaAttachments.map((att) => ({
              mediaId: `opt-item-${Math.random().toString(36).slice(2, 9)}`,
              type: att.mimeType?.startsWith("video/") ? "video" : "image",
              mimeType: att.mimeType || "image/jpeg",
              url: att.uri,
              thumbnailUrl: att.uri,
              size: att.size,
              originalName: att.name,
            }))
          : null,
        replyTo: replyToId || null,
        replyToDetails: clientReplyToDetails || null,
        isPinned: false,
        isEdited: false,
        isRecalled: false,
        reactions: {},
        status: "sending",
        createdAt: new Date().toISOString(),
        clientTempId,
      };

      // Cho optimistic message chui vào cache
      dispatch(
        (chatApi.util as any).updateQueryData(
          "getMessages",
          { conversationId, limit: CHAT_MESSAGES_QUERY_LIMIT },
          (draft: IMessage[]) => {
            draft.unshift(optimisticMsg);
          },
        ),
      );
      dispatch(
        (chatApi.util as any).updateQueryData(
          "getMessagesPaginated",
          { conversationId },
          (draft: IMessagePage) => {
            if (draft && Array.isArray(draft.items)) {
              draft.items.push(optimisticMsg);
            }
          },
        ),
      );

      // Chạy luồng gửi ngầm bất đồng bộ dưới nền
      (async () => {
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

          const results = uploadResults;

          if (results.length >= 2) {
            const mediaResults = results.filter((r) => r.type === "image" || r.type === "video");
            const otherResults = results.filter((r) => r.type !== "image" && r.type !== "video");

            if (mediaResults.length >= 2) {
              const mediaIds = mediaResults.map((r) => r.mediaId);
              // Gửi album với clientTempId để merge
              await sendMessageMutation({
                conversationId,
                type: "album",
                content: captionFirst,
                mediaIds,
                replyTo: replyToId,
                clientTempId,
              }).unwrap();

              // Gửi các tệp còn lại đơn lẻ
              for (const other of otherResults) {
                await sendMessageMutation({
                  conversationId,
                  type: messageTypeFromUploadResult(other),
                  content: " ",
                  mediaId: other.mediaId,
                }).unwrap();
              }
            } else {
              // Gửi rời rạc
              for (let i = 0; i < results.length; i++) {
                const result = results[i]!;
                const attachment = attachments[i];
                const prepared = preparedFiles[i];
                const displayName = attachment?.name?.trim() || prepared?.name;
                const displayMime = result.mimeType?.trim() || attachment?.mimeType;

                await sendMessageMutation({
                  conversationId,
                  type: messageTypeFromUploadResult(result),
                  content: i === 0 ? captionFirst : " ",
                  mediaId: result.mediaId,
                  replyTo: i === 0 ? replyToId : undefined,
                  clientTempId: i === 0 ? clientTempId : undefined,
                  optimisticLocalUri: prepared?.uri,
                  optimisticMediaName: displayName,
                  optimisticMediaSize: result.size ?? attachment?.size,
                  optimisticMimeType: displayMime,
                  clientReplyToDetails: i === 0 ? clientReplyToDetails : undefined,
                }).unwrap();
              }
            }
          } else {
            // results.length === 1
            const result = results[0]!;
            const attachment = attachments[0];
            const prepared = preparedFiles[0];
            const displayName = attachment?.name?.trim() || prepared?.name;
            const displayMime = result.mimeType?.trim() || attachment?.mimeType;

            await sendMessageMutation({
              conversationId,
              type: messageTypeFromUploadResult(result),
              content: captionFirst,
              mediaId: result.mediaId,
              replyTo: replyToId,
              clientTempId,
              optimisticLocalUri: prepared?.uri,
              optimisticMediaName: displayName,
              optimisticMediaSize: result.size ?? attachment?.size,
              optimisticMimeType: displayMime,
              clientReplyToDetails: clientReplyToDetails,
            }).unwrap();
          }
        } catch (err: any) {
          console.error("Background Upload/Send failed:", err);
          const blockedText = messageSendErrorText(err);
          if (blockedText !== "Gửi tin nhắn thất bại. Vui lòng thử lại.") {
            toast.error(blockedText);
          } else {
            const apiMsg =
              err &&
              typeof err === "object" &&
              "data" in err &&
              (err as { data?: { message?: string; error?: { message?: string } } }).data
                ? String(
                    (err as { data?: { message?: string; error?: { message?: string } } }).data
                      ?.error?.message ??
                      (err as { data?: { message?: string } }).data?.message ??
                      "",
                  ).trim()
                : "";
            toast.error(apiMsg || "Gửi tệp thất bại. Vui lòng thử lại.");
          }

          // Cập nhật trạng thái thành failed cho optimisticMsg
          dispatch(
            (chatApi.util as any).updateQueryData(
              "getMessages",
              { conversationId, limit: CHAT_MESSAGES_QUERY_LIMIT },
              (draft: IMessage[]) => {
                const opt = draft.find((m) => m.messageId === clientTempId);
                if (opt) opt.status = "failed";
              },
            ),
          );
          dispatch(
            (chatApi.util as any).updateQueryData(
              "getMessagesPaginated",
              { conversationId },
              (draft: IMessagePage) => {
                if (draft && Array.isArray(draft.items)) {
                  const opt = draft.items.find((m) => m.messageId === clientTempId);
                  if (opt) opt.status = "failed";
                }
              },
            ),
          );
        }
      })();
    },
    [
      conversationId,
      canSendInGroup,
      uploadMediaMulti,
      sendMessageMutation,
      replyingTo,
      dispatch,
      currentUserId,
      emitTypingStop,
    ],
  );

  const handleSendVoice = useCallback(
    async (uri: string, duration: number) => {
      if (!conversationId) {
        toast.error("Không tìm thấy hội thoại.");
        throw new Error("no_conversation");
      }
      if (!canSendInGroup) {
        toast.error("Bạn không có quyền gửi tin trong nhóm này.");
        throw new Error("no_permission");
      }
      emitTypingStop(conversationId);

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
        const filename = uri.split("/").pop() || `voice-${Date.now()}.m4a`;
        const match = /\.(\w+)$/.exec(filename);
        const mimeType = match ? `audio/${match[1]}` : `audio/m4a`;

        const prepared = await prepareLocalFileForUpload({
          uri,
          name: filename,
          mimeType,
        });

        const uploadResults = await uploadMediaMulti({
          files: [
            {
              uri: prepared.uri,
              name: prepared.name,
              type: prepared.type,
            },
          ],
        }).unwrap();

        const result = uploadResults?.[0];
        if (!result?.mediaId) {
          throw new Error("upload_missing_media_id");
        }

        await sendVoiceMessage(conversationId, result.mediaId, duration, replyToId, {
          optimisticLocalUri: prepared.uri,
          clientReplyToDetails,
        });

        listRef.current?.scrollToOffset({ offset: 0, animated: true });
      } catch (err) {
        console.error("Gửi tin nhắn thoại thất bại:", err);
        toast.error("Gửi tin nhắn thoại thất bại. Vui lòng thử lại.");
        throw err;
      }
    },
    [
      conversationId,
      canSendInGroup,
      uploadMediaMulti,
      sendVoiceMessage,
      replyingTo,
      dispatch,
      currentUserId,
      emitTypingStop,
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

  const handleTyping = useCallback(
    (text?: string) => {
      if (conversationId) {
        if (text != null && text.trim() === "") {
          emitTypingStop(conversationId);
        } else {
          emitTyping(conversationId);
        }
      }
    },
    [conversationId, emitTyping, emitTypingStop],
  );

  const handleTogglePinForSheet = useCallback(
    async (msg: IMessage) => {
      await pinController.handleTogglePinMsg(msg);
    },
    [pinController],
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
          isOnline={isDirectFriendOnline}
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
        pinnedMessages={pinnedMessagesOrdered}
        currentUserId={currentUserId ?? ""}
        onJumpToMessage={handleJumpToMessage}
        onTogglePin={handleTogglePinForSheet}
      />

      <PinLimitModal
        visible={pinController.pinLimitModalMsg !== null}
        currentPinned={pinnedMessagesOrdered}
        pendingPin={pinController.pinLimitModalMsg}
        replaceIndex={pinController.pinReplaceIndex}
        onReplaceIndexChange={pinController.setPinReplaceIndex}
        isSubmitting={pinController.pinLimitSubmitting}
        currentUserId={currentUserId ?? ""}
        onClose={() => pinController.setPinLimitModalMsg(null)}
        onConfirm={() => void pinController.handleConfirmPinReplace()}
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
              isLatestUserMessage={index === lastUserMessageIndex}
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
            <View style={{ transform: [{ scaleY: -1 }, { scaleX: -1 }] }} className="flex-1">
              <EmptyState
                icon={MessageSquare}
                title="Chưa có tin nhắn"
                description="Hãy bắt đầu cuộc trò chuyện!"
              />
            </View>
          }
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            // Inverted FlatList: offset 0 = bottom (latest). Scrolled up = offset > threshold.
            const offset = e.nativeEvent.contentOffset.y;
            setIsScrolledUp(offset > 300);
          }}
          scrollEventThrottle={100}
        />

        {/* Floating scroll-to-bottom button */}
        {isScrolledUp && (
          <Pressable
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
            style={scrollBtnStyles.fab}
            accessibilityLabel="Cuộn xuống tin mới nhất"
          >
            <ChevronDown size={22} color="#666" />
          </Pressable>
        )}

        <View
          className="border-t border-border/40 bg-background/95 dark:bg-background"
          style={{ paddingBottom: 0 }}
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
          ) : chatPaused ? (
            <View className="border-t border-border/30 bg-muted/30 px-4 py-5">
              <Text className="text-center text-[15px] font-semibold text-foreground">
                Trò chuyện tạm dừng
              </Text>
              <Text className="mt-1 text-center text-sm text-muted-foreground">
                Trò chuyện đã bị tắt bởi quản trị viên Cộng đồng.
              </Text>
            </View>
          ) : canSendInGroup ? (
            <ChatInput
              onSend={handleSendMessage}
              onSendMedia={handleSendMedia}
              onSendVoice={handleSendVoice}
              replyingTo={replyingTo}
              currentUserId={currentUserId ?? ""}
              activeConversationId={conversationId ?? null}
              conversationName={conversation?.name ?? undefined}
              onClearReply={() => dispatch(clearReplyingTo())}
              onTyping={handleTyping}
              isGroup={isGroup}
              groupMembers={isGroup ? groupMembersForPerm : undefined}
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
              onOpenAiSummary={isGroup ? openAiSummaryModal : undefined}
            />
          ) : (
            <GroupMemberSendRestrictedBar />
          )}
        </View>
      </KeyboardAvoidingView>

      {isGroup && conversationId ? (
        <>
          <AISummaryModal
            visible={aiSummaryOpen}
            onClose={() => !aiSummaryLoading && setAiSummaryOpen(false)}
            conversationName={conversation?.name ?? "Nhóm chat"}
            loading={aiSummaryLoading}
            result={aiSummaryResult}
            onRerun={() => void runAiSummary(true)}
          />

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
        conversationId={conversationId}
        conversationTitle={conversation?.name ?? undefined}
        conversationMembers={conversationSearchMembers}
        memberAvatarById={memberAvatarById}
        onSelectMessage={handleJumpToMessage}
      />
    </SafeAreaView>
  );
}

const scrollBtnStyles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 80,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
