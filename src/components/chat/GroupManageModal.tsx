import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import {
  Pin,
  Pencil,
  LogOut,
  Link2,
  ImageIcon,
  FileText,
  Clock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Camera,
  BellOff,
  Bell,
  Settings,
  Sparkles,
  Trash2,
  UserCog,
  User,
  UserPlus,
  UserMinus,
  Users,
  Plus,
  Lock,
  Copy,
  MessageSquare,
  RefreshCw,
  Share2,
  Ban,
  KeyRound,
  HelpCircle,
  MoreHorizontal,
  X,
} from "lucide-react-native";
import { GroupAddMembersModal } from "@/components/chat/GroupAddMembersModal";
import {
  ChatMediaLightbox,
  type ChatMediaLightboxState,
} from "@/components/chat/ChatMediaLightbox";
import {
  chatImageDisplayUrl,
  chatMediaDownloadFilename,
  chatVideoPlayUrl,
  resolveChatFileBubbleMeta,
} from "@/utils/chatMediaDisplay";
import { openOrShareChatFile } from "@/utils/chatMediaDownload";

import { BulletinPinnedMessageCard } from "@/components/chat/BulletinPinnedMessageCard";
import { ChatFileTypeBadge } from "@/components/chat/ChatFileTypeBadge";
import { BulletinTaskCard } from "@/components/chat/BulletinTaskCard";
import { Avatar } from "@/components/common/Avatar";
import { MAX_PINNED_PER_CONVERSATION } from "@/constants/chatPin";
import { MIN_GROUP_MEMBERS } from "@/constants/group";
import { env } from "@/config/env";
import { useAppSelector } from "@/hooks/useAppStore";
import type {
  IConversation,
  IGroupMember,
  IGroupMemberPermissions,
  IGroupSettings,
  IMessage,
  MemberRole,
} from "@/types/chat.types";
import {
  useRejectGroupRequestMutation,
  useApproveGroupRequestMutation,
  useUpdateGroupSettingsMutation,
  useUpdateGroupMutation,
  useRemoveMemberMutation,
  usePatchConversationPreferencesMutation,
  useLeaveGroupMutation,
  useGetMessagesQuery,
  useGetGroupSettingsQuery,
  useSendMessageMutation,
  useGetGroupRequestsQuery,
  useGetGroupMembersQuery,
  useDeleteGroupMutation,
  useChangeMemberRoleMutation,
  useTransferGroupOwnerMutation,
  useGetPollsQuery,
  useGetTasksQuery,
  useDeleteTaskMutation,
} from "@/store/api/chatApi";
import { CHAT_MESSAGES_QUERY_LIMIT } from "@/store/api/endpoints/messageApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { useSendFriendRequestMutation } from "@/store/api/userApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { toast } from "@/utils/appToast";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { apiClient } from "@/services/api";
import {
  buildPatchForMutePayload,
  describeMuteSuccess,
  type MuteNotificationsApplyPayload,
} from "@/utils/muteNotifications";

import { GroupTaskModal } from "./GroupTaskModal";
import { GroupPollModal } from "./GroupPollModal";
import { MuteNotificationsModal } from "./MuteNotificationsModal";
import {
  canUserChangeGroupProfileInGroup,
  canUserCreatePollInGroup,
  canUserCreateTaskInGroup,
  countGroupAdmins,
  isGroupAdminSlotsFull,
  MAX_GROUP_ADMINS,
  normalizeGroupMembersList,
  resolveGroupMemberRole,
} from "@/utils/groupConversationPermissions";
import { getJoinGroupUrl as joinUrlFromSuffix } from "@/utils/joinGroupUrl";
import { filterGroupMembersExcludingRemoved } from "@/utils/groupMembersRealtime";
import { useGroupJoinLinkModalOptional } from "@/contexts/GroupJoinLinkModalContext";

export type GroupManagePanel =
  | "home"
  | "rename"
  | "add"
  | "members"
  | "requests"
  | "settings"
  /** Ghim + bình chọn (tab giống web ConversationInfoPanel). */
  | "bulletinFeed"
  | "media"
  | "transferOwner"
  /** @deprecated Dùng bulletinFeed + tab; giữ để initialPanel cũ vẫn mở đúng tab. */
  | "pinned"
  | "polls"
  | "tasks"
  | "personal";

type BulletinNotesTab = "all" | "pinned" | "polls";

type Panel = GroupManagePanel;

interface GroupManageModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: IConversation;
  currentUserId?: string;
  /** Khi mở modal, nhảy thẳng tới tab (vd. từ thanh ghim → Chỉnh sửa). */
  initialPanel?: Panel;
  /** Mở sẵn form sửa task (vd. từ thẻ task trong chat). */
  initialTaskIdForEditor?: string | null;
  /** Gọi sau khi đã xử lý `initialTaskIdForEditor` (mở editor hoặc bỏ qua). */
  onConsumedInitialTaskEditor?: () => void;
  /** Đóng modal nhóm rồi cuộn tới tin trong luồng chat (giống web onJumpToMessage). */
  onJumpToMessage?: (messageId: string) => void;
  /** Mở PollVoteModal trên màn chat (giống web onOpenPollVote). */
  onOpenPollVote?: (pollId: string) => void;
  /** Giống web BulletinCardRow — đóng poll từ bảng tin. */
  onClosePoll?: (pollId: string) => void | Promise<void>;
  /** Giống web — thêm lựa chọn (prompt trên web → modal nhập trên mobile). */
  onAddPollOption?: (pollId: string, text: string) => void | Promise<void>;
  /** Mở modal AI tóm tắt ngay khi modal hiển thị (từ shortcut composer). */
  openAiSummaryWhenVisible?: boolean;
  /** Giống web BulletinCardRow — tham gia task từ danh sách nhắc hẹn. */
  onTaskJoined?: (taskId: string) => void | Promise<void>;
  onEditTaskFromBulletin?: (task: Record<string, unknown>) => void;
  onDeleteTaskFromBulletin?: (taskId: string) => void | Promise<void>;
  taskActionBusy?: boolean;
}

const Z = {
  bg: "#FFFFFF",
  subBg: "#F3F4F6",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  primary: "#0068FF",
  red: "#DC2626",
  line: "#E5E7EB",
};

function roleLabel(role: MemberRole): string {
  if (role === "owner") return "Trưởng nhóm";
  if (role === "admin") return "Phó nhóm";
  return "Thành viên";
}

function joinRequestSubtitle(status?: string): string {
  if (status === "invited") return "Được mời vào nhóm";
  return "Yêu cầu tham gia";
}

function memberRowDisplayName(m: IGroupMember, selfId?: string): string {
  if (selfId && m.userId === selfId) return "Bạn";
  return (m.displayName ?? "").trim() || m.userId;
}

function pollSummary(raw: unknown): { id: string; title: string; closed: boolean } {
  if (!raw || typeof raw !== "object") return { id: "", title: "", closed: false };
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.pollId ?? ""),
    title: String(o.question ?? "Bình chọn"),
    closed: Boolean(o.isClosed),
  };
}

function taskSummary(raw: unknown): { id: string; title: string; status: string; due?: string } {
  if (!raw || typeof raw !== "object") return { id: "", title: "", status: "" };
  const o = raw as Record<string, unknown>;
  const due = o.dueDate;
  return {
    id: String(o.taskId ?? ""),
    title: String(o.title ?? "Công việc"),
    status: String(o.status ?? ""),
    due: typeof due === "string" && due.trim() ? due : undefined,
  };
}

/** Giống web `formatBulletinFooterTime` — 28/02/2026 lúc 16:24 */
function formatBulletinFooterTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} lúc ${time}`;
}

function resolveCreatorLabel(
  creatorId: string | undefined | null,
  creatorDisplayName: string | null | undefined,
  currentUserId: string | undefined,
  memberNameById: Map<string, string>,
): string {
  const fromApi = creatorDisplayName?.trim();
  if (fromApi) return fromApi;
  if (creatorId && currentUserId && creatorId === currentUserId) return "Bạn";
  if (creatorId) {
    const fromMembers = memberNameById.get(creatorId)?.trim();
    if (fromMembers) return fromMembers;
  }
  if (creatorId) return "Thành viên";
  return "Không rõ";
}

function pollOptionsPreview(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as Record<string, unknown>;
  const options = Array.isArray(o.options) ? o.options : [];
  return options
    .slice(0, 5)
    .map((x) => {
      const opt = x as Record<string, unknown>;
      return String(opt.text ?? "").trim();
    })
    .filter(Boolean)
    .join(" · ");
}

export function GroupManageModal({
  visible,
  onClose,
  conversation,
  currentUserId,
  initialPanel,
  initialTaskIdForEditor,
  onConsumedInitialTaskEditor,
  onJumpToMessage,
  onOpenPollVote,
  onClosePoll,
  onAddPollOption,
  openAiSummaryWhenVisible = false,
  onTaskJoined,
  onEditTaskFromBulletin,
  onDeleteTaskFromBulletin,
  taskActionBusy = false,
}: GroupManageModalProps): ReactElement {
  const insets = useSafeAreaInsets();
  const groupId = conversation.conversationId;
  const authUserId = useAppSelector((s) => s.auth.user?.userId);
  const effectiveUserId = (currentUserId ?? authUserId)?.trim() || undefined;

  const [panel, setPanel] = useState<Panel>("home");
  /** Tab trong màn «Quản lý thành viên» — khớp web MemberManagementModal (list | pending). */
  const [memberManageTab, setMemberManageTab] = useState<"list" | "pending">("list");
  const [membersLeadersOnly, setMembersLeadersOnly] = useState(false);
  const [pickOwnerForLeave, setPickOwnerForLeave] = useState(false);
  const [editName, setEditName] = useState(conversation.name ?? "");
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [addPollOptionTargetId, setAddPollOptionTargetId] = useState<string | null>(null);
  const [addPollOptionDraft, setAddPollOptionDraft] = useState("");
  const [addPollOptionBusy, setAddPollOptionBusy] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskData, setEditingTaskData] = useState<any>(null);
  const [muteNotifOpen, setMuteNotifOpen] = useState(false);
  const [muteNotifMode, setMuteNotifMode] = useState<"create" | "edit">("create");
  const [muteNotifSubmitting, setMuteNotifSubmitting] = useState(false);
  const [mediaTab, setMediaTab] = useState<"media" | "file" | "link">("media");
  const [galleryLightbox, setGalleryLightbox] = useState<ChatMediaLightboxState>(null);
  const [bulletinExpanded, setBulletinExpanded] = useState(true);
  const [bulletinNotesTab, setBulletinNotesTab] = useState<BulletinNotesTab>("all");
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState("");
  const [bulletinAddOpen, setBulletinAddOpen] = useState(false);
  const [promotePickerOpen, setPromotePickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      const init = initialPanel ?? "home";
      if (init === "pinned") {
        setPanel("bulletinFeed");
        setBulletinNotesTab("pinned");
        setMemberManageTab("list");
      } else if (init === "polls") {
        setPanel("bulletinFeed");
        setBulletinNotesTab("polls");
        setMemberManageTab("list");
      } else if (init === "bulletinFeed") {
        setPanel("bulletinFeed");
        setBulletinNotesTab("all");
        setMemberManageTab("list");
      } else if (init === "requests") {
        setPanel("members");
        setMemberManageTab("pending");
      } else {
        setPanel(init);
        setBulletinNotesTab("all");
        setMemberManageTab("list");
      }
      setEditName(conversation.name ?? "");
      setPickOwnerForLeave(false);
      setPollModalOpen(false);
      setTaskModalOpen(false);
      setEditingTaskData(null);
      setMuteNotifOpen(false);
      setMuteNotifSubmitting(false);
      setMediaTab("media");
      setBulletinExpanded(true);
      setBulletinAddOpen(false);
      setAiSummaryOpen(false);
      setAiSummaryLoading(false);
      setAiSummaryResult("");
    }
  }, [visible, conversation.name, conversation.conversationId, initialPanel]);

  const groupBoardTick = useAppSelector((s) =>
    visible ? (s.chat.groupBoardRefreshTickByConversationId[groupId] ?? 0) : 0,
  );

  const {
    data: membersRaw = [],
    isFetching,
    refetch,
  } = useGetGroupMembersQuery(groupId, {
    skip: !visible,
    refetchOnMountOrArgChange: true,
  });

  const members = useMemo(
    () => filterGroupMembersExcludingRemoved(groupId, membersRaw),
    [groupId, membersRaw],
  );

  const { data: messages = [] } = useGetMessagesQuery(
    { conversationId: groupId, limit: CHAT_MESSAGES_QUERY_LIMIT },
    { skip: !visible },
  );

  const {
    data: settings,
    refetch: refetchSettings,
    isFetching: settingsFetching,
  } = useGetGroupSettingsQuery(groupId, {
    skip: !visible,
  });

  const canFetchJoinRequests =
    visible &&
    !!effectiveUserId &&
    members.some((m) => m.userId === effectiveUserId && (m.role === "owner" || m.role === "admin"));

  const { data: joinRequests = [], refetch: refetchRequests } = useGetGroupRequestsQuery(groupId, {
    skip: !canFetchJoinRequests,
    refetchOnMountOrArgChange: true,
  });

  const adminSlotsFull = useMemo(() => isGroupAdminSlotsFull(members), [members]);

  const [updateGroup, { isLoading: savingName }] = useUpdateGroupMutation();
  const [removeMember, { isLoading: removing }] = useRemoveMemberMutation();
  const [changeRole, { isLoading: changingRole }] = useChangeMemberRoleMutation();
  const [transferOwner, { isLoading: transferringOwner }] = useTransferGroupOwnerMutation();
  const [deleteGroup, { isLoading: deleting }] = useDeleteGroupMutation();
  const [leaveGroup, { isLoading: leaving }] = useLeaveGroupMutation();
  const [patchPrefs, { isLoading: patchingPrefs }] = usePatchConversationPreferencesMutation();
  const [updateSettings, { isLoading: savingSettings }] = useUpdateGroupSettingsMutation();
  const [sendMessage] = useSendMessageMutation();
  const joinLinkModal = useGroupJoinLinkModalOptional();
  const [approveReq] = useApproveGroupRequestMutation();
  const [rejectReq] = useRejectGroupRequestMutation();
  const [sendFriendReq] = useSendFriendRequestMutation();
  const [uploadMedia, { isLoading: uploadingAvatar }] = useUploadMediaMutation();
  const [deleteTaskMut] = useDeleteTaskMutation();

  const {
    data: pollsEnvelope,
    isFetching: pollsFetching,
    refetch: refetchPolls,
  } = useGetPollsQuery(groupId, {
    skip: !visible,
  });

  const {
    data: tasksEnvelope,
    isFetching: tasksFetching,
    refetch: refetchTasks,
  } = useGetTasksQuery(groupId, {
    skip: !visible,
  });

  const myMember = useMemo(
    () => (effectiveUserId ? members.find((m) => m.userId === effectiveUserId) : undefined),
    [members, effectiveUserId],
  );
  const myRole = useMemo(
    () =>
      resolveGroupMemberRole({
        userId: effectiveUserId,
        members,
      }),
    [effectiveUserId, members],
  );
  const effectiveGroupSettings = settings ?? conversation.groupSettings;
  const permConversation = useMemo(
    () => ({
      type: "group" as const,
      groupSettings: effectiveGroupSettings,
    }),
    [effectiveGroupSettings],
  );
  const canCreatePollUi = canUserCreatePollInGroup({
    conversation: permConversation,
    userId: effectiveUserId,
    members,
  });
  const canCreateTaskUi = canUserCreateTaskInGroup({
    conversation: permConversation,
    userId: effectiveUserId,
    members,
  });
  const isOwner = myRole === "owner";
  const canModerateMembers = myRole === "owner" || myRole === "admin";
  const canKickMembers = isOwner;
  const canEditGroupSettings = isOwner;

  /** Khớp backend: owner/admin luôn được; member cần `changeNameAvatar` (áp dụng cho cả tên và ảnh nhóm). */
  const canEditGroupProfile = useMemo(
    () =>
      canUserChangeGroupProfileInGroup({
        conversation: permConversation,
        userRole: myRole,
        userId: effectiveUserId,
        members,
      }),
    [permConversation, myRole, effectiveUserId, members],
  );

  const othersForOwnerHandoff = useMemo(
    () => members.filter((m) => m.userId !== effectiveUserId),
    [members, effectiveUserId],
  );

  const joinSuffix = settings?.joinLinkSuffix;
  const joinUrl = joinUrlFromSuffix(joinSuffix);
  const allowJoinLink = settings?.adminSettings?.allowJoinLink;

  const openJoinLinkScreen = useCallback(() => {
    if (!joinSuffix || !joinUrl) return;
    joinLinkModal?.openGroupJoinLinkModal({
      suffix: joinSuffix,
      url: joinUrl,
      groupName: conversation.name ?? "Nhóm chat",
      groupAvatar: conversation.avatar,
      conversationId: groupId,
    });
  }, [conversation.avatar, conversation.name, groupId, joinLinkModal, joinSuffix, joinUrl]);

  const openShareJoinLinkPicker = useCallback(() => {
    if (!joinSuffix || !joinUrl) return;
    joinLinkModal?.openShareGroupJoinLinkPicker({
      suffix: joinSuffix,
      url: joinUrl,
      groupName: conversation.name ?? "Nhóm chat",
      groupAvatar: conversation.avatar,
      conversationId: groupId,
    });
  }, [conversation.avatar, conversation.name, groupId, joinLinkModal, joinSuffix, joinUrl]);

  const isMuted = conversation.isMuted ?? false;
  const isPinnedToTop = conversation.isPinnedToTop ?? false;

  const mediaMessages = useMemo(
    () =>
      messages.filter(
        (m) =>
          !m.isRecalled &&
          !m.isDeleted &&
          (m.type === "image" || m.type === "video" || m.type === "file"),
      ),
    [messages],
  );

  const linkGalleryRows = useMemo(() => {
    const out: { key: string; message: IMessage; url: string }[] = [];
    for (const m of messages) {
      if (m.type !== "text" || m.isRecalled || m.isDeleted) continue;
      const raw = (m.content ?? "").trim();
      const match = raw.match(/https?:\/\/[^\s<]+/i);
      if (!match?.[0]) continue;
      out.push({ key: m.messageId, message: m, url: match[0] });
    }
    return out;
  }, [messages]);

  const pinnedList = useMemo(
    () =>
      messages
        .filter((m) => m.isPinned && !m.isRecalled && !m.isDeleted)
        .slice()
        .sort((a, b) => {
          const am = new Date(a.createdAt).getTime();
          const bm = new Date(b.createdAt).getTime();
          return (Number.isFinite(bm) ? bm : 0) - (Number.isFinite(am) ? am : 0);
        }),
    [messages],
  );

  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) {
      if (!row.userId) continue;
      const label = row.displayName?.trim();
      if (label) m.set(row.userId, label);
    }
    return m;
  }, [members]);

  const kickGloballyDisabled = members.length <= MIN_GROUP_MEMBERS;

  const pollsList = useMemo(() => {
    const raw = pollsEnvelope?.data;
    return Array.isArray(raw) ? raw : [];
  }, [pollsEnvelope]);

  const pollsSorted = useMemo(() => {
    const list = pollsList.slice();
    list.sort((a, b) => {
      const ax = a as Record<string, unknown>;
      const bx = b as Record<string, unknown>;
      const at = Date.parse(String(ax.createdAt ?? "")) || 0;
      const bt = Date.parse(String(bx.createdAt ?? "")) || 0;
      if (bt !== at) return bt - at;
      return String(ax.pollId ?? "").localeCompare(String(bx.pollId ?? ""));
    });
    return list;
  }, [pollsList]);

  const tasksList = useMemo(() => {
    const raw = tasksEnvelope?.data;
    return Array.isArray(raw) ? raw : [];
  }, [tasksEnvelope]);

  const tasksSorted = useMemo(() => {
    const list = tasksList.slice();
    list.sort((a, b) => {
      const ax = a as Record<string, unknown>;
      const bx = b as Record<string, unknown>;
      const at = Date.parse(String(ax.createdAt ?? "")) || 0;
      const bt = Date.parse(String(bx.createdAt ?? "")) || 0;
      if (bt !== at) return bt - at;
      return String(ax.taskId ?? "").localeCompare(String(bx.taskId ?? ""));
    });
    return list;
  }, [tasksList]);

  const memberAvatarById = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of members) {
      if (!row.userId || !row.avatar?.trim()) continue;
      m.set(row.userId, row.avatar.trim());
    }
    return m;
  }, [members]);

  useEffect(() => {
    if (!visible || !initialTaskIdForEditor?.trim()) return;
    if (tasksFetching && tasksList.length === 0) return;
    const id = initialTaskIdForEditor.trim();
    const raw = tasksList.find((x) => String((x as Record<string, unknown>).taskId ?? "") === id);
    if (raw) {
      setEditingTaskData(raw);
      setTaskModalOpen(true);
    }
    onConsumedInitialTaskEditor?.();
  }, [visible, initialTaskIdForEditor, tasksList, tasksFetching, onConsumedInitialTaskEditor]);

  const jumpToPinnedMessage = useCallback(
    (messageId: string) => {
      if (!onJumpToMessage) {
        toast.info("Không thể mở tin từ đây.");
        return;
      }
      onClose();
      setTimeout(() => onJumpToMessage(messageId), 220);
    },
    [onClose, onJumpToMessage],
  );

  const openPollFromBulletin = useCallback(
    (pollId: string) => {
      const id = String(pollId).trim();
      if (!id) return;
      if (!onOpenPollVote) {
        toast.info("Không thể mở bình chọn từ đây.");
        return;
      }
      onClose();
      setTimeout(() => onOpenPollVote(id), 220);
    },
    [onClose, onOpenPollVote],
  );

  const submitAddPollOptionFromSheet = useCallback(async () => {
    const pid = addPollOptionTargetId;
    const text = addPollOptionDraft.trim();
    if (!pid || !text || !onAddPollOption) return;
    setAddPollOptionBusy(true);
    try {
      await onAddPollOption(pid, text);
      setAddPollOptionTargetId(null);
      setAddPollOptionDraft("");
    } finally {
      setAddPollOptionBusy(false);
    }
  }, [addPollOptionTargetId, addPollOptionDraft, onAddPollOption]);

  const navigateOut = useCallback(() => {
    onClose();
    router.replace("/(main)/(chat)");
  }, [onClose]);

  const handleBack = useCallback(() => {
    if (promotePickerOpen) {
      setPromotePickerOpen(false);
      return;
    }
    if (pickOwnerForLeave) {
      setPickOwnerForLeave(false);
      return;
    }
    if (taskModalOpen) {
      setTaskModalOpen(false);
      return;
    }
    if (panel !== "home") {
      if (panel === "members") setMembersLeadersOnly(false);
      setBulletinAddOpen(false);
      setPanel("home");
      return;
    }
    onClose();
  }, [onClose, panel, pickOwnerForLeave, promotePickerOpen, taskModalOpen]);

  const handleSaveName = useCallback(async () => {
    if (!canEditGroupProfile) {
      toast.error("Bạn không có quyền đổi tên nhóm");
      return;
    }
    const name = editName.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên nhóm");
      return;
    }
    try {
      await updateGroup({ groupId, name }).unwrap();
      toast.success("Cập nhật nhóm thành công");
      setPanel("home");
    } catch {
      toast.error("Không thể đổi tên nhóm");
    }
  }, [canEditGroupProfile, editName, groupId, updateGroup]);

  const pickAvatar = useCallback(async () => {
    if (!canEditGroupProfile) {
      toast.error("Bạn không có quyền đổi ảnh đại diện nhóm");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Cần quyền thư viện ảnh để đổi ảnh nhóm");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const file = await prepareLocalFileForUpload({
        uri: asset.uri,
        name: asset.fileName ?? "group-avatar.jpg",
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      const uploadRes = await uploadMedia({
        file: { uri: file.uri, name: file.name, type: file.type },
        mediaType: "image",
      }).unwrap();
      const url = uploadRes.url?.trim();
      if (!url) throw new Error("no url");
      await updateGroup({ groupId, avatar: url }).unwrap();
      toast.success("Đã cập nhật ảnh đại diện nhóm");
    } catch {
      toast.error("Không thể cập nhật ảnh nhóm");
    }
  }, [canEditGroupProfile, groupId, updateGroup, uploadMedia]);

  const confirmRemove = useCallback(
    (m: IGroupMember) => {
      if (members.length <= MIN_GROUP_MEMBERS) {
        toast.warning(
          `Nhóm phải còn tối thiểu ${MIN_GROUP_MEMBERS} người — không thể xóa thêm (hiện ${members.length} người).`,
        );
        return;
      }
      Alert.alert("Mời khỏi nhóm", `Mời "${m.displayName}" ra khỏi nhóm?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Mời ra khỏi nhóm",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeMember({ groupId, userId: m.userId }).unwrap();
                void refetch();
                toast.success("Đã mời thành viên ra khỏi nhóm");
              } catch (e: unknown) {
                const msg =
                  e && typeof e === "object" && "data" in e
                    ? String((e as { data?: { message?: string } }).data?.message ?? "")
                    : "";
                toast.error(msg || "Không thể mời thành viên ra khỏi nhóm");
              }
            })();
          },
        },
      ]);
    },
    [groupId, members.length, removeMember, refetch],
  );

  const confirmDemote = useCallback(
    (m: IGroupMember) => {
      Alert.alert("Hạ phó nhóm", `Hạ "${m.displayName}" xuống thành viên?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Hạ xuống thành viên",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await changeRole({ groupId, userId: m.userId, role: "member" }).unwrap();
                void refetch();
                toast.success("Đã hạ phó nhóm xuống thành viên");
              } catch {
                toast.error("Không thể đổi vai trò");
              }
            })();
          },
        },
      ]);
    },
    [changeRole, groupId, refetch],
  );

  const confirmPromote = useCallback(
    (m: IGroupMember) => {
      if (adminSlotsFull) {
        toast.error(
          `Nhóm chỉ có tối đa ${MAX_GROUP_ADMINS} phó nhóm. Hãy hạ một phó nhóm trước khi bổ nhiệm thêm.`,
        );
        return;
      }
      Alert.alert("Bổ nhiệm phó nhóm", `Bổ nhiệm "${m.displayName}" làm phó nhóm?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Bổ nhiệm",
          onPress: () => {
            void (async () => {
              try {
                await changeRole({ groupId, userId: m.userId, role: "admin" }).unwrap();
                void refetch();
                toast.success("Đã bổ nhiệm phó nhóm");
              } catch {
                toast.error("Không thể đổi vai trò");
              }
            })();
          },
        },
      ]);
    },
    [adminSlotsFull, changeRole, groupId, refetch],
  );

  const openMemberRowMenu = useCallback(
    (m: IGroupMember) => {
      const isSelfAdmin = m.role === "admin" && m.userId === effectiveUserId;
      const canDemote = m.role === "admin" && (canKickMembers || isSelfAdmin);
      if (!canDemote) return;
      const name = memberRowDisplayName(m, effectiveUserId);
      Alert.alert(name, undefined, [
        {
          text: "Hạ phó nhóm xuống thành viên",
          onPress: () => confirmDemote(m),
        },
        { text: "Hủy", style: "cancel" },
      ]);
    },
    [canKickMembers, confirmDemote, effectiveUserId],
  );

  const runLeave = useCallback(
    async (newOwnerUserId?: string) => {
      try {
        await leaveGroup({ groupId, newOwnerUserId }).unwrap();
        toast.success("Đã rời nhóm");
        navigateOut();
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "data" in e
            ? String((e as { data?: { message?: string } }).data?.message ?? "")
            : "";
        toast.error(msg || "Không thể rời nhóm");
      }
    },
    [groupId, leaveGroup, navigateOut],
  );

  const handleLeavePress = useCallback(() => {
    if (isOwner) {
      if (othersForOwnerHandoff.length === 0) {
        toast.warning("Bạn là thành viên duy nhất. Hãy giải tán nhóm thay vì rời nhóm");
        return;
      }
      setPickOwnerForLeave(true);
      return;
    }
    Alert.alert("Rời nhóm", "Bạn sẽ không còn nhận tin nhắn từ nhóm này.", [
      { text: "Hủy", style: "cancel" },
      { text: "Rời nhóm", style: "destructive", onPress: () => void runLeave() },
    ]);
  }, [isOwner, othersForOwnerHandoff.length, runLeave]);

  const handleDeleteGroup = useCallback(() => {
    Alert.alert("Giải tán nhóm", "Mọi thành viên sẽ bị xóa khỏi nhóm.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Giải tán",
        style: "destructive",
        onPress: () => {
          Alert.alert("Xác nhận lần nữa", "Hành động này không thể hoàn tác.", [
            { text: "Hủy", style: "cancel" },
            {
              text: "Giải tán nhóm",
              style: "destructive",
              onPress: () => {
                void (async () => {
                  try {
                    await deleteGroup(groupId).unwrap();
                    toast.success("Đã giải tán nhóm");
                    navigateOut();
                  } catch {
                    toast.error("Không thể giải tán nhóm");
                  }
                })();
              },
            },
          ]);
        },
      },
    ]);
  }, [deleteGroup, groupId, navigateOut]);

  const toggleMuted = useCallback(
    async (next: boolean) => {
      try {
        await patchPrefs({ conversationId: groupId, isMuted: next }).unwrap();
        toast.success(next ? "Đã tắt thông báo" : "Đã bật thông báo");
      } catch {
        toast.error("Không thể cập nhật thông báo");
      }
    },
    [groupId, patchPrefs],
  );

  const togglePinnedConv = useCallback(
    async (next: boolean) => {
      try {
        await patchPrefs({ conversationId: groupId, isPinnedToTop: next }).unwrap();
        toast.success(next ? "Đã ghim hội thoại" : "Đã bỏ ghim hội thoại");
      } catch {
        toast.error("Không thể ghim hội thoại");
      }
    },
    [groupId, patchPrefs],
  );

  const applyMuteFromModal = useCallback(
    async (payload: MuteNotificationsApplyPayload) => {
      setMuteNotifSubmitting(true);
      try {
        await patchPrefs(buildPatchForMutePayload(groupId, payload)).unwrap();
        toast.success(describeMuteSuccess(payload));
        setMuteNotifOpen(false);
      } catch {
        toast.error("Không thể cập nhật thông báo");
        throw new Error("mute_failed");
      } finally {
        setMuteNotifSubmitting(false);
      }
    },
    [groupId, patchPrefs],
  );

  const clearMuteSchedule = useCallback(async () => {
    try {
      await patchPrefs(buildPatchForMutePayload(groupId, { kind: "clearScheduledMute" })).unwrap();
      toast.success(describeMuteSuccess({ kind: "clearScheduledMute" }));
    } catch {
      toast.error("Không thể xóa hẹn tắt tạm");
    }
  }, [groupId, patchPrefs]);

  const buildAiSummaryText = useCallback((summary: string, highlights: string[]) => {
    const summaryBlock = summary
      ? `Tóm tắt\n${summary
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => (l.startsWith("-") || l.startsWith("•") ? l : `• ${l}`))
          .join("\n")}`
      : "Tóm tắt\n• (Chưa có)";
    const highlightsBlock =
      highlights.length > 0
        ? `Điểm nổi bật\n${highlights.map((h) => `• ${String(h).trim()}`).join("\n")}`
        : "Điểm nổi bật\n• (Không có)";
    return [summaryBlock, highlightsBlock].join("\n\n");
  }, []);

  const runAiSummary = useCallback(
    async (showSuccessToast: boolean) => {
      setAiSummaryResult("");
      setAiSummaryLoading(true);
      try {
        const result = await apiClient.post<{
          success?: boolean;
          data?: { summary?: string; highlights?: string[] };
        }>("/ai/group-summary", {
          conversationId: groupId,
          limit: 40,
        });
        const payload = result.data?.data;
        const summary = String(payload?.summary ?? "").trim();
        const highlights = Array.isArray(payload?.highlights)
          ? (payload.highlights as string[])
          : [];
        setAiSummaryResult(buildAiSummaryText(summary, highlights));
        if (showSuccessToast) {
          toast.success("Đã tạo tóm tắt AI");
        }
      } catch (e) {
        console.error("AI summary:", e);
        setAiSummaryResult("Không thể tạo tóm tắt vào lúc này.");
      } finally {
        setAiSummaryLoading(false);
      }
    },
    [buildAiSummaryText, groupId],
  );

  const openAiSummaryModal = useCallback(async () => {
    setAiSummaryOpen(true);
    await runAiSummary(false);
  }, [runAiSummary]);

  useEffect(() => {
    if (!visible || !openAiSummaryWhenVisible) return;
    setAiSummaryOpen(true);
    void runAiSummary(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi mở modal với cờ từ composer
  }, [visible, openAiSummaryWhenVisible]);

  useEffect(() => {
    if (!visible || groupBoardTick === 0) return;
    void refetch();
    void refetchSettings();
    void refetchPolls();
    void refetchTasks();
  }, [groupBoardTick, visible, refetch, refetchSettings, refetchPolls, refetchTasks]);

  const handleRerunAiSummary = useCallback(async () => {
    await runAiSummary(true);
  }, [runAiSummary]);

  const patchSettingMember = useCallback(
    async (key: keyof IGroupSettings["memberPermissions"], value: boolean) => {
      try {
        await updateSettings({ groupId, memberPermissions: { [key]: value } }).unwrap();
        void refetchSettings();
      } catch {
        toast.error("Không lưu được cài đặt");
      }
    },
    [groupId, refetchSettings, updateSettings],
  );

  const patchSettingAdmin = useCallback(
    async (key: keyof IGroupSettings["adminSettings"], value: boolean) => {
      try {
        const needLink = key === "allowJoinLink" && value === true && !joinSuffix;
        await updateSettings({
          groupId,
          adminSettings: { [key]: value },
          regenerateJoinLink: needLink ? true : undefined,
        }).unwrap();
        void refetchSettings();
      } catch {
        toast.error("Không lưu được cài đặt");
      }
    },
    [groupId, joinSuffix, refetchSettings, updateSettings],
  );

  const regenerateGroupJoinLink = useCallback(async () => {
    if (!canEditGroupSettings) return;
    try {
      await updateSettings({ groupId, regenerateJoinLink: true }).unwrap();
      void refetchSettings();
      toast.success("Đã tạo link mới");
    } catch {
      toast.error("Không lưu được cài đặt");
    }
  }, [canEditGroupSettings, groupId, refetchSettings, updateSettings]);

  const transferOwnerTo = useCallback(
    async (userId: string) => {
      if (!effectiveUserId) return;
      const submit = (currentOwnerNewRole: Extract<MemberRole, "admin" | "member">) => {
        void (async () => {
          try {
            await transferOwner({ groupId, newOwnerUserId: userId, currentOwnerNewRole }).unwrap();
            setPanel("home");
            void refetch();
            toast.success("Trưởng nhóm mới đã được cập nhật");
          } catch {
            toast.error("Không thể chuyển quyền. Thử lại hoặc kiểm tra quyền trên máy chủ");
          }
        })();
      };
      const buttons: {
        text: string;
        style?: "cancel" | "destructive" | "default";
        onPress?: () => void;
      }[] = [
        { text: "Hủy", style: "cancel" },
        { text: "Thành viên", style: "destructive", onPress: () => submit("member") },
      ];
      if (!adminSlotsFull) {
        buttons.push({ text: "Phó nhóm", onPress: () => submit("admin") });
      }
      Alert.alert(
        "Chuyển quyền trưởng nhóm",
        adminSlotsFull
          ? `Bạn sẽ mất quyền trưởng nhóm. Nhóm đã đủ ${MAX_GROUP_ADMINS} phó nhóm — bạn chỉ có thể trở thành thành viên.`
          : "Bạn sẽ mất quyền trưởng nhóm. Chọn vai trò của bạn sau khi chuyển.",
        buttons,
      );
    },
    [adminSlotsFull, effectiveUserId, groupId, refetch, transferOwner],
  );

  const busy =
    savingName ||
    removing ||
    changingRole ||
    transferringOwner ||
    leaving ||
    deleting ||
    patchingPrefs ||
    savingSettings ||
    uploadingAvatar;

  const headerTitle =
    panel === "home"
      ? "Thông tin nhóm"
      : panel === "rename"
        ? "Thông tin nhóm"
        : panel === "add"
          ? "Thêm thành viên"
          : panel === "members"
            ? membersLeadersOnly
              ? "Trưởng & phó nhóm"
              : "Quản lý thành viên"
            : panel === "settings"
              ? "Quản lý nhóm"
              : panel === "media"
                ? mediaTab === "media"
                  ? "Ảnh / Video"
                  : mediaTab === "file"
                    ? "File"
                    : "Link"
                : panel === "bulletinFeed"
                  ? "Tin ghim & Bình chọn"
                  : panel === "tasks"
                    ? "Danh sách nhắc hẹn"
                    : panel === "personal"
                      ? "Cài đặt cá nhân"
                      : "Chuyển quyền";

  const renderHome = () => (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.homeScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Pressable
          onPress={() => void pickAvatar()}
          disabled={busy || !canEditGroupProfile}
          style={[styles.avatarWrap, !canEditGroupProfile && { opacity: 0.85 }]}
        >
          <View style={styles.heroAvatarFrame}>
            <Avatar
              uri={conversation.avatar || undefined}
              name={conversation.name || undefined}
              size="lg"
              isGroup
            />
          </View>
          {canEditGroupProfile ? (
            <View style={styles.camBadge}>
              <Camera size={16} color="#fff" strokeWidth={2} />
            </View>
          ) : null}
        </Pressable>
        <View style={styles.nameRow}>
          <Text style={styles.groupTitle} numberOfLines={1}>
            {conversation.name ?? "Nhóm"}
          </Text>
          <Pressable
            onPress={() => {
              if (!canEditGroupProfile) {
                toast.error("Bạn không có quyền đổi tên hoặc ảnh nhóm");
                return;
              }
              setPanel("rename");
            }}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Pencil size={14} color={Z.sub} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={styles.memberCountText}>
          {members.length > 0 ? members.length : (conversation.memberCount ?? 0)} thành viên
        </Text>

        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickCell}
            onPress={() => {
              if (isMuted) {
                void toggleMuted(false);
              } else {
                setMuteNotifMode("create");
                setMuteNotifOpen(true);
              }
            }}
            disabled={busy}
          >
            <View style={styles.quickIcon}>
              {isMuted ? (
                <BellOff size={16} color={Z.sub} strokeWidth={1.75} />
              ) : (
                <Bell size={16} color={Z.sub} strokeWidth={1.75} />
              )}
            </View>
            <Text style={styles.quickLabel}>
              {isMuted ? <>Bật thông{"\n"}báo</> : <>Tắt thông{"\n"}báo</>}
            </Text>
          </Pressable>
          <Pressable
            style={styles.quickCell}
            onPress={() => void togglePinnedConv(!isPinnedToTop)}
            disabled={busy}
          >
            <View style={styles.quickIcon}>
              <Pin
                size={16}
                color={isPinnedToTop ? Z.primary : Z.sub}
                strokeWidth={isPinnedToTop ? 2.2 : 1.75}
              />
            </View>
            <Text style={styles.quickLabel}>
              {isPinnedToTop ? <>Bỏ ghim{"\n"}hội thoại</> : <>Ghim hội{"\n"}thoại</>}
            </Text>
          </Pressable>
          <Pressable style={styles.quickCell} onPress={() => setPanel("add")} disabled={busy}>
            <View style={styles.quickIcon}>
              <UserPlus size={16} color={Z.sub} strokeWidth={1.75} />
            </View>
            <Text style={styles.quickLabel}>Thêm thành{"\n"}viên</Text>
          </Pressable>
          <Pressable style={styles.quickCell} onPress={() => setPanel("settings")} disabled={busy}>
            <View style={styles.quickIcon}>
              <Settings size={16} color={Z.sub} strokeWidth={1.75} />
            </View>
            <Text style={styles.quickLabel}>Quản lý{"\n"}nhóm</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.aiBlock}>
        <Pressable
          style={styles.aiButton}
          onPress={() => void openAiSummaryModal()}
          disabled={busy}
          android_ripple={{ color: "rgba(255,255,255,0.2)" }}
        >
          <Sparkles size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.aiButtonText}>AI tóm tắt toàn bộ tin nhắn</Text>
        </Pressable>
        <Text style={styles.aiHint}>Báo cáo siêu tốc những nội dung bị trôi.</Text>
      </View>

      <View style={styles.memberMgmtCard}>
        <Pressable
          style={styles.memberMgmtHeader}
          onPress={() => {
            setMembersLeadersOnly(false);
            setMemberManageTab("list");
            setPanel("members");
          }}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          <Text style={styles.memberMgmtTitle}>Quản lý thành viên</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {canModerateMembers && joinRequests.length > 0 ? (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>
                  {joinRequests.length > 99 ? "99+" : joinRequests.length}
                </Text>
              </View>
            ) : null}
            <ChevronRight size={16} color={Z.sub} />
          </View>
        </Pressable>
      </View>

      <View style={[styles.bulletinOuter, styles.homeSectionSpaced]}>
        <Pressable
          style={styles.bulletinHeader}
          onPress={() => setBulletinExpanded((v) => !v)}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          <Text style={styles.bulletinHeaderTitle}>Bảng tin nhóm</Text>
          <View
            style={{
              transform: [{ rotate: bulletinExpanded ? "0deg" : "-90deg" }],
            }}
          >
            <ChevronDown size={16} color={Z.sub} strokeWidth={2} />
          </View>
        </Pressable>
        {bulletinExpanded ? (
          <View style={styles.bulletinBody}>
            <Pressable
              style={styles.bulletinSubRow}
              onPress={() => setPanel("tasks")}
              android_ripple={{ color: "rgba(0,0,0,0.04)" }}
            >
              <Clock size={16} color={Z.sub} strokeWidth={1.75} style={{ opacity: 0.7 }} />
              <Text style={styles.bulletinSubLabel}>Danh sách nhắc hẹn</Text>
            </Pressable>
            <Pressable
              style={styles.bulletinSubRow}
              onPress={() => {
                setBulletinNotesTab("all");
                setPanel("bulletinFeed");
              }}
              android_ripple={{ color: "rgba(0,0,0,0.04)" }}
            >
              <FileText size={16} color={Z.sub} strokeWidth={1.75} style={{ opacity: 0.7 }} />
              <Text style={styles.bulletinSubLabel}>Tin ghim & Bình chọn</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.homeNavGroup}>
        <HomeNavRow
          label="Ảnh/Video"
          onPress={() => {
            setMediaTab("media");
            setPanel("media");
          }}
        />
        <HomeNavRow
          label="File"
          onPress={() => {
            setMediaTab("file");
            setPanel("media");
          }}
        />
        <HomeNavRow
          label="Link"
          isLast
          onPress={() => {
            setMediaTab("link");
            setPanel("media");
          }}
        />
      </View>

      <View style={styles.homeActionsWrap}>
        {isOwner ? (
          <Pressable
            style={({ pressed }) => [
              styles.homeBtnTransfer,
              pressed ? { opacity: 0.9 } : null,
              busy ? { opacity: 0.5 } : null,
            ]}
            onPress={() => setPanel("transferOwner")}
            disabled={busy}
          >
            {transferringOwner ? (
              <ActivityIndicator color={Z.primary} />
            ) : (
              <Text style={styles.homeBtnTransferText}>Chuyển quyền trưởng nhóm</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.homeBtnLeave,
            pressed ? { opacity: 0.9 } : null,
            busy ? { opacity: 0.5 } : null,
          ]}
          onPress={handleLeavePress}
          disabled={busy}
        >
          {leaving ? (
            <ActivityIndicator color={Z.red} />
          ) : (
            <Text style={styles.homeBtnLeaveText}>Rời nhóm</Text>
          )}
        </Pressable>
        {isOwner ? (
          <Pressable
            style={({ pressed }) => [
              styles.homeBtnDisband,
              pressed ? { opacity: 0.92 } : null,
              busy ? { opacity: 0.5 } : null,
            ]}
            onPress={handleDeleteGroup}
            disabled={busy}
          >
            {deleting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.homeBtnDisbandText}>Giải tán nhóm</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={{ height: 28 }} />
    </ScrollView>
  );

  const renderRename = () => (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.panelPad}
    >
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Pressable
          onPress={() => void pickAvatar()}
          disabled={busy || !canEditGroupProfile}
          style={[styles.avatarWrap, (!canEditGroupProfile || busy) && { opacity: 0.75 }]}
        >
          <View style={styles.heroAvatarFrame}>
            <Avatar
              uri={conversation.avatar || undefined}
              name={conversation.name || undefined}
              size="lg"
              isGroup
            />
          </View>
          {canEditGroupProfile ? (
            <View style={styles.camBadge}>
              <Camera size={16} color="#fff" strokeWidth={2} />
            </View>
          ) : null}
        </Pressable>
        <Text style={[styles.help, { textAlign: "center", marginTop: 10, paddingHorizontal: 8 }]}>
          {canEditGroupProfile
            ? "Chạm ảnh để đổi ảnh đại diện nhóm"
            : "Nhóm không cho phép thành viên đổi tên hoặc ảnh đại diện. Chỉ trưởng nhóm có thể chỉnh sửa."}
        </Text>
      </View>
      <Text style={styles.fieldLabel}>Tên nhóm</Text>
      <TextInput
        value={editName}
        onChangeText={setEditName}
        placeholder="Tên nhóm"
        placeholderTextColor={Z.sub}
        style={styles.input}
        editable={!busy && canEditGroupProfile}
      />
      <Pressable style={styles.primaryBtn} onPress={() => void handleSaveName()} disabled={busy}>
        {savingName ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Lưu</Text>
        )}
      </Pressable>
    </ScrollView>
  );

  const normalizedMembers = useMemo(
    () =>
      normalizeGroupMembersList(members, {
        leaderId: conversation.leaderId,
        creatorId: conversation.creatorId,
      }),
    [members, conversation.leaderId, conversation.creatorId],
  );

  const adminCount = useMemo(() => countGroupAdmins(normalizedMembers), [normalizedMembers]);

  const promotableMembers = useMemo(
    () => normalizedMembers.filter((m) => m.role === "member"),
    [normalizedMembers],
  );

  const membersForList = useMemo(() => {
    if (!membersLeadersOnly) return normalizedMembers;
    return normalizedMembers.filter((m) => m.role === "owner" || m.role === "admin");
  }, [normalizedMembers, membersLeadersOnly]);

  const openPromoteFlow = useCallback(() => {
    if (!canKickMembers) return;
    if (adminSlotsFull) {
      toast.error(
        `Nhóm chỉ có tối đa ${MAX_GROUP_ADMINS} phó nhóm. Hãy hạ một phó nhóm trước khi bổ nhiệm thêm.`,
      );
      return;
    }
    if (membersLeadersOnly) {
      setMembersLeadersOnly(false);
      setMemberManageTab("list");
      return;
    }
    if (promotableMembers.length === 0) {
      toast.info("Không còn thành viên thường để bổ nhiệm phó nhóm");
      return;
    }
    setPromotePickerOpen(true);
  }, [adminSlotsFull, canKickMembers, membersLeadersOnly, promotableMembers.length]);

  const renderMembers = () => (
    <View style={{ flex: 1 }}>
      {canModerateMembers && !membersLeadersOnly ? (
        <View style={styles.mmTabsRow}>
          <Pressable
            onPress={() => setMemberManageTab("list")}
            style={[
              styles.mmTab,
              memberManageTab === "list" ? styles.mmTabActive : styles.mmTabIdle,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: memberManageTab === "list" }}
          >
            <Users
              size={15}
              color={memberManageTab === "list" ? "#fff" : Z.sub}
              strokeWidth={2.25}
            />
            <Text
              style={[
                styles.mmTabText,
                memberManageTab === "list" ? styles.mmTabTextActive : styles.mmTabTextIdle,
              ]}
            >
              Thành viên ({normalizedMembers.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMemberManageTab("pending")}
            style={[
              styles.mmTab,
              memberManageTab === "pending" ? styles.mmTabActive : styles.mmTabIdle,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: memberManageTab === "pending" }}
          >
            <UserPlus
              size={15}
              color={memberManageTab === "pending" ? "#fff" : Z.sub}
              strokeWidth={2.25}
            />
            <Text
              style={[
                styles.mmTabText,
                memberManageTab === "pending" ? styles.mmTabTextActive : styles.mmTabTextIdle,
              ]}
            >
              Chờ duyệt
            </Text>
            {joinRequests.length > 0 ? (
              <View style={styles.mmPendingCountBadge}>
                <Text style={styles.mmPendingCountBadgeText}>
                  {joinRequests.length > 99 ? "99+" : joinRequests.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}
      {isFetching ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={Z.primary} />
      ) : memberManageTab === "list" || !canModerateMembers || membersLeadersOnly ? (
        <FlatList
          data={membersForList}
          keyExtractor={(m) => m.userId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
          ListHeaderComponent={
            canKickMembers && !membersLeadersOnly ? (
              <Text style={styles.mmAdminQuota}>
                Phó nhóm: {adminCount}/{MAX_GROUP_ADMINS}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.help, { textAlign: "center", marginTop: 24 }]}>
              {membersLeadersOnly ? "Chưa có phó nhóm." : "Chưa có thành viên."}
            </Text>
          }
          renderItem={({ item: m }) => {
            const isSelfAdmin = m.role === "admin" && m.userId === effectiveUserId;
            const canKickThis =
              !membersLeadersOnly &&
              canKickMembers &&
              Boolean(effectiveUserId) &&
              m.userId !== effectiveUserId &&
              m.role !== "owner";
            const canDemote = (canKickMembers || isSelfAdmin) && m.role === "admin";
            const canPromote =
              !membersLeadersOnly && canKickMembers && m.role === "member" && !adminSlotsFull;
            return (
              <View style={styles.mmMemberRow}>
                <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={styles.mmMemberName} numberOfLines={1}>
                    {memberRowDisplayName(m, effectiveUserId)}
                  </Text>
                  {m.role === "owner" ? (
                    <View style={styles.mmRolePillOwner}>
                      <Text style={styles.mmRolePillOwnerText}>Trưởng nhóm</Text>
                    </View>
                  ) : m.role === "admin" ? (
                    <View style={styles.mmRolePillAdmin}>
                      <Text style={styles.mmRolePillAdminText}>Phó nhóm</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.mmMemberActions}>
                  {canPromote ? (
                    <Pressable
                      style={styles.mmIconActionPromote}
                      disabled={changingRole}
                      onPress={() => confirmPromote(m)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Bổ nhiệm phó nhóm"
                    >
                      <UserPlus size={16} color={Z.primary} strokeWidth={2.25} />
                    </Pressable>
                  ) : null}
                  {canKickThis ? (
                    <Pressable
                      style={styles.mmIconActionKick}
                      disabled={removing}
                      onPress={() => {
                        if (kickGloballyDisabled) {
                          toast.warning(
                            `Nhóm phải còn tối thiểu ${MIN_GROUP_MEMBERS} người — không thể mời thêm ai ra (hiện ${members.length} người).`,
                          );
                          return;
                        }
                        confirmRemove(m);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Mời khỏi nhóm"
                    >
                      <UserMinus size={16} color={Z.red} strokeWidth={2.25} />
                    </Pressable>
                  ) : null}
                  {canDemote ? (
                    <Pressable
                      style={styles.mmMoreBtn}
                      onPress={() => openMemberRowMenu(m)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Tùy chọn vai trò"
                    >
                      <MoreHorizontal size={20} color={Z.sub} strokeWidth={2} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={joinRequests}
          keyExtractor={(r) => r.userId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={[styles.help, { textAlign: "center", marginTop: 24 }]}>
              Không có yêu cầu chờ.
            </Text>
          }
          renderItem={({ item: r }) => (
            <View style={styles.mmPendingCard}>
              <Avatar uri={r.avatar || undefined} name={r.name} size="sm" />
              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <Text style={styles.mmMemberName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.subSmall}>{joinRequestSubtitle(r.status)}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                {r.isFriend !== true ? (
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        try {
                          await sendFriendReq({ userId: r.userId }).unwrap();
                          void refetchRequests();
                          toast.success("Đã kết bạn");
                        } catch (e: unknown) {
                          const st =
                            e && typeof e === "object" && "status" in e
                              ? (e as { status?: number }).status
                              : undefined;
                          toast.error(st === 409 ? "Đã kết bạn" : "Không thể kết bạn");
                        }
                      })();
                    }}
                  >
                    <Text style={styles.requestFriendLink}>Kết bạn</Text>
                  </Pressable>
                ) : null}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        try {
                          await approveReq({ groupId, userId: r.userId }).unwrap();
                          void refetchRequests();
                          void refetch();
                          toast.success("Đã duyệt yêu cầu");
                        } catch {
                          toast.error("Không duyệt được");
                        }
                      })();
                    }}
                    style={styles.miniBtn}
                  >
                    <Text style={styles.miniBtnTextOk}>Duyệt</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void (async () => {
                        try {
                          await rejectReq({ groupId, userId: r.userId }).unwrap();
                          void refetchRequests();
                          toast.success("Đã từ chối yêu cầu");
                        } catch {
                          toast.error("Không từ chối được");
                        }
                      })();
                    }}
                    style={styles.miniBtn}
                  >
                    <Text style={styles.miniBtnTextNo}>Từ chối</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  const renderSettings = () => {
    const settingsBusy = savingSettings || settingsFetching;
    if (settingsFetching && !settings) {
      return (
        <View style={styles.panelPad}>
          <ActivityIndicator color={Z.primary} />
          <Text style={[styles.help, { textAlign: "center", marginTop: 12 }]}>
            Đang tải cài đặt…
          </Text>
        </View>
      );
    }
    if (!settings) {
      return (
        <View style={styles.panelPad}>
          <Text style={[styles.help, { textAlign: "center", color: Z.red }]}>
            Không tải được cài đặt nhóm.
          </Text>
        </View>
      );
    }
    const mp = settings.memberPermissions;
    const ad = settings.adminSettings;
    const settingsLocked = settingsBusy || !canEditGroupSettings;

    const memberRows: {
      key: keyof IGroupMemberPermissions;
      label: string;
      hint?: string;
    }[] = [
      { key: "changeNameAvatar", label: "Thay đổi tên & ảnh đại diện của nhóm" },
      {
        key: "pinMessages",
        label: "Ghim tin nhắn, bình chọn lên đầu hội thoại",
        hint: `Tối đa ${MAX_PINNED_PER_CONVERSATION} tin ghim mỗi cuộc trò chuyện.`,
      },
      { key: "createNotesReminders", label: "Tạo mới ghi chú, nhắc hẹn" },
      { key: "createPolls", label: "Tạo mới bình chọn" },
      { key: "sendMessages", label: "Gửi tin nhắn" },
    ];

    const shareJoinLink = async () => {
      if (!joinUrl) {
        toast.info("Dùng Sao chép để gửi link");
        return;
      }
      try {
        await Share.share(
          Platform.OS === "ios"
            ? { url: joinUrl, title: "Tham gia nhóm" }
            : { message: joinUrl, title: "Tham gia nhóm" },
        );
      } catch {
        toast.info("Dùng Sao chép để gửi link");
      }
    };

    const gmBottomPad = 16 + Math.max(insets.bottom, 8);

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.gmScrollContent, { paddingBottom: gmBottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {canEditGroupSettings ? (
          <View style={styles.gmAdminBanner}>
            <Lock size={18} color="#64748B" strokeWidth={2} />
            <Text style={styles.gmAdminBannerText}>Tính năng chỉ dành cho quản trị viên</Text>
          </View>
        ) : null}

        <Text style={styles.gmSectionTitle}>Cho phép các thành viên trong nhóm:</Text>
        <View style={styles.gmMemberCard}>
          {memberRows.map((row, idx) => (
            <MemberPermissionRow
              key={row.key}
              label={row.label}
              hint={row.hint}
              checked={mp[row.key]}
              disabled={settingsLocked}
              isLast={idx === memberRows.length - 1}
              onToggle={(v) => void patchSettingMember(row.key, v)}
            />
          ))}
        </View>

        <View style={styles.gmAdminToggles}>
          <GroupAdminToggleRow
            label="Cho phép thành viên mới đọc tin nhắn gần nhất"
            value={ad.newMembersReadRecent}
            onValueChange={(v) => void patchSettingAdmin("newMembersReadRecent", v)}
            disabled={settingsLocked}
          />
          <GroupAdminToggleRow
            label="Cho phép dùng link tham gia nhóm"
            value={ad.allowJoinLink}
            onValueChange={(v) => void patchSettingAdmin("allowJoinLink", v)}
            disabled={settingsLocked}
          />
        </View>

        {ad.allowJoinLink ? (
          <View style={styles.gmJoinLinkWrap}>
            <Pressable
              style={styles.gmJoinUrlCol}
              onPress={openJoinLinkScreen}
              disabled={!joinSuffix}
            >
              <Text
                style={styles.gmJoinUrlText}
                numberOfLines={1}
                ellipsizeMode="tail"
                accessibilityLabel={joinUrl ? `Link tham gia: ${joinUrl}` : undefined}
              >
                {joinUrl || "—"}
              </Text>
            </Pressable>
            <View style={styles.gmJoinActionsRow}>
              <Pressable
                accessibilityLabel="Xem link & QR"
                disabled={!joinSuffix}
                onPress={openJoinLinkScreen}
                style={({ pressed }) => [styles.gmJoinIconBtn, pressed ? { opacity: 0.75 } : null]}
              >
                <Link2 size={18} color={Z.primary} strokeWidth={2} />
              </Pressable>
              <Pressable
                accessibilityLabel="Sao chép"
                disabled={!joinSuffix}
                onPress={() => {
                  if (!joinUrl) return;
                  void (async () => {
                    await Clipboard.setStringAsync(joinUrl);
                    toast.success("Đã sao chép link");
                  })();
                }}
                style={({ pressed }) => [styles.gmJoinIconBtn, pressed ? { opacity: 0.75 } : null]}
              >
                <Copy size={18} color={Z.primary} strokeWidth={2} />
              </Pressable>
              <Pressable
                accessibilityLabel="Chia sẻ"
                disabled={!joinSuffix}
                onPress={openShareJoinLinkPicker}
                style={({ pressed }) => [styles.gmJoinIconBtn, pressed ? { opacity: 0.75 } : null]}
              >
                <Share2 size={18} color={Z.primary} strokeWidth={2} />
              </Pressable>
              <Pressable
                accessibilityLabel="Làm mới link"
                disabled={settingsLocked}
                onPress={() => void regenerateGroupJoinLink()}
                style={({ pressed }) => [styles.gmJoinIconBtn, pressed ? { opacity: 0.75 } : null]}
              >
                <RefreshCw size={18} color={Z.primary} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.gmPlaceholderBlock}>
          <Pressable
            onPress={() => {
              setMembersLeadersOnly(true);
              setMemberManageTab("list");
              setPanel("members");
            }}
            style={({ pressed }) => [
              { width: "100%" },
              styles.gmPlaceholderHit,
              pressed ? styles.gmPlaceholderPressed : null,
            ]}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          >
            <View style={styles.gmPlaceholderRowInner}>
              <KeyRound size={20} color="#64748B" strokeWidth={2} />
              <Text style={styles.gmPlaceholderLabel}>Trưởng & phó nhóm</Text>
            </View>
          </Pressable>
        </View>

        {!canEditGroupSettings ? (
          <Text style={styles.gmReadOnlyFooter}>
            Bạn chỉ xem được cài đặt. Chỉ trưởng nhóm mới chỉnh được cài đặt.
          </Text>
        ) : null}
      </ScrollView>
    );
  };

  const renderPinnedMessageCards = (emptyHint: string) => {
    if (pinnedList.length === 0) {
      return (
        <Text
          style={[styles.help, { textAlign: "center", paddingVertical: 28, paddingHorizontal: 16 }]}
        >
          {emptyHint}
        </Text>
      );
    }
    return pinnedList.map((m) => (
      <BulletinPinnedMessageCard
        key={m.messageId}
        msg={m}
        when={formatBulletinFooterTime(m.createdAt)}
        viewerUserId={effectiveUserId ?? ""}
        onPress={() => jumpToPinnedMessage(m.messageId)}
        disabled={!onJumpToMessage}
      />
    ));
  };

  const renderPollCards = (emptyHint: string) => {
    if (pollsSorted.length === 0) {
      return (
        <Text
          style={[styles.help, { textAlign: "center", paddingVertical: 28, paddingHorizontal: 16 }]}
        >
          {emptyHint}
        </Text>
      );
    }
    return pollsSorted.map((raw, idx) => {
      const o = raw as Record<string, unknown>;
      const p = pollSummary(raw);
      const key = p.id || `poll-${idx}`;
      const preview = pollOptionsPreview(raw);
      const creatorId = typeof o.creatorId === "string" ? o.creatorId : "";
      const creatorMember = members.find((m) => m.userId === creatorId);
      const creator = resolveCreatorLabel(
        creatorId || null,
        o.creatorDisplayName != null ? String(o.creatorDisplayName) : null,
        effectiveUserId,
        memberNameById,
      );
      const when = formatBulletinFooterTime(
        typeof o.createdAt === "string" ? o.createdAt : undefined,
      );
      const pollOpen = !p.closed && Boolean(onOpenPollVote);
      const openVote = () => openPollFromBulletin(p.id);
      const showPollAdminRow = Boolean(onAddPollOption || onClosePoll);
      return (
        <View key={key} style={{ marginBottom: 12 }}>
          <View style={styles.bulletinPollCard}>
            <Pressable
              onPress={() => {
                if (pollOpen) openVote();
              }}
              disabled={!pollOpen || !onOpenPollVote || !p.id}
              style={({ pressed }) => [
                pressed && pollOpen && onOpenPollVote ? { opacity: 0.92 } : null,
              ]}
            >
              <View style={styles.bulletinPollHeaderRow}>
                <Avatar uri={creatorMember?.avatar ?? undefined} name={creator} size="md" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.bulletinPollCreatorName} numberOfLines={1}>
                    {creator}
                  </Text>
                  <View style={styles.bulletinPollKindRow}>
                    <MessageSquare size={14} color="#2563eb" strokeWidth={2} />
                    <Text style={styles.bulletinPollKindLabel}>Bình chọn</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.bulletinPollTitleBlock} numberOfLines={4}>
                {p.title}
              </Text>
              {preview ? (
                <Text style={styles.bulletinPollPreview} numberOfLines={3}>
                  {preview}
                </Text>
              ) : null}
              <View style={styles.bulletinPollFooterRow}>
                <Text style={styles.bulletinPollMeta}>{when || "—"}</Text>
                {pollOpen ? (
                  <>
                    <Text style={styles.bulletinPollFooterSep}>|</Text>
                    <Pressable onPress={openVote} hitSlop={6}>
                      <Text style={styles.bulletinPollVoteLink}>Bỏ phiếu</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </Pressable>
            {showPollAdminRow ? (
              <View style={styles.bulletinPollAdminRow}>
                {onAddPollOption ? (
                  <Pressable
                    onPress={() => {
                      setAddPollOptionTargetId(p.id);
                      setAddPollOptionDraft("");
                    }}
                    style={styles.bulletinPollAdminBtn}
                  >
                    <Text style={styles.bulletinPollAdminBtnText}>+ Option</Text>
                  </Pressable>
                ) : null}
                {onClosePoll ? (
                  <Pressable
                    onPress={() => void onClosePoll(p.id)}
                    style={styles.bulletinPollAdminBtn}
                  >
                    <Text style={styles.bulletinPollAdminBtnText}>Đóng</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      );
    });
  };

  /** Thẻ nhắc hẹn — đồng bộ web `BulletinTaskCard`. */
  const renderTaskCards = (emptyHint: string) => {
    if (tasksSorted.length === 0) {
      return (
        <Text
          style={[styles.help, { textAlign: "center", paddingVertical: 28, paddingHorizontal: 16 }]}
        >
          {emptyHint}
        </Text>
      );
    }
    return tasksSorted.map((raw, idx) => {
      const o = raw as Record<string, unknown>;
      const t = taskSummary(raw);
      const key = t.id || `task-${idx}`;
      const creatorId = typeof o.creatorId === "string" ? o.creatorId : "";
      const creator = resolveCreatorLabel(
        creatorId || null,
        o.creatorDisplayName != null ? String(o.creatorDisplayName) : null,
        effectiveUserId,
        memberNameById,
      );
      const avatarUrl = creatorId ? memberAvatarById.get(creatorId) : undefined;
      const when = formatBulletinFooterTime(
        typeof o.createdAt === "string" ? o.createdAt : undefined,
      );
      return (
        <BulletinTaskCard
          key={key}
          raw={raw}
          creator={creator}
          avatarUrl={avatarUrl}
          when={when}
          effectiveUserId={effectiveUserId}
          onTaskJoined={onTaskJoined}
          onEditTaskFromBulletin={onEditTaskFromBulletin}
          onDeleteTaskFromBulletin={onDeleteTaskFromBulletin}
          taskActionBusy={taskActionBusy}
        />
      );
    });
  };

  const renderBulletinFeed = () => {
    const tabDefs: { id: BulletinNotesTab; label: string }[] = [
      { id: "all", label: "Tất cả" },
      { id: "pinned", label: "Tin ghim" },
      { id: "polls", label: "Bình chọn" },
    ];

    const showPollsLoading =
      bulletinNotesTab !== "pinned" && pollsFetching && pollsSorted.length === 0;
    const showAllLoading =
      bulletinNotesTab === "all" &&
      pollsFetching &&
      pinnedList.length === 0 &&
      pollsSorted.length === 0;

    let body: ReactNode = null;
    if (bulletinNotesTab === "all") {
      if (showAllLoading) {
        body = (
          <Text style={[styles.help, { textAlign: "center", paddingVertical: 20 }]}>
            Đang tải...
          </Text>
        );
      } else if (pinnedList.length === 0 && pollsSorted.length === 0) {
        body = (
          <Text
            style={[
              styles.help,
              { textAlign: "center", paddingVertical: 28, paddingHorizontal: 16 },
            ]}
          >
            Chưa có tin ghim hay bình chọn.
          </Text>
        );
      } else {
        body = (
          <View style={{ paddingBottom: 8 }}>
            {pinnedList.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.bulletinSectionCap}>TIN GHIM</Text>
                {renderPinnedMessageCards("")}
              </View>
            ) : null}
            {pollsSorted.length > 0 ? (
              <View>
                <Text style={styles.bulletinSectionCap}>BÌNH CHỌN</Text>
                {renderPollCards("")}
              </View>
            ) : null}
          </View>
        );
      }
    } else if (bulletinNotesTab === "pinned") {
      body = renderPinnedMessageCards("Chưa có tin ghim trong hội thoại.");
    } else {
      if (showPollsLoading) {
        body = (
          <Text style={[styles.help, { textAlign: "center", paddingVertical: 20 }]}>
            Đang tải bình chọn...
          </Text>
        );
      } else {
        body = renderPollCards("Chưa có bình chọn.");
      }
    }

    return (
      <View style={{ flex: 1 }}>
        <View style={styles.bulletinTabBar}>
          {tabDefs.map((t) => {
            const on = bulletinNotesTab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setBulletinNotesTab(t.id)}
                style={styles.bulletinTabBtn}
              >
                <Text
                  style={[styles.bulletinTabLabel, on ? styles.bulletinTabLabelActive : null]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
                {on ? <View style={styles.bulletinTabUnderline} /> : <View style={{ height: 2 }} />}
              </Pressable>
            );
          })}
        </View>
        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
        >
          {body}
        </ScrollView>
      </View>
    );
  };

  const renderTasks = () => {
    const showLoading = tasksFetching && tasksSorted.length === 0;
    return (
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
      >
        {showLoading ? (
          <Text style={[styles.help, { textAlign: "center", paddingVertical: 20 }]}>
            Đang tải...
          </Text>
        ) : (
          renderTaskCards("Chưa có nhắc hẹn hay công việc.")
        )}
      </ScrollView>
    );
  };

  const renderMedia = () => {
    const w = Dimensions.get("window").width;
    const gap = 6;
    const pad = 12;
    const cell = (w - pad * 2 - gap * 2) / 3;

    const gridMessages = mediaMessages.filter((m) => m.type === "image" || m.type === "video");

    if (mediaTab === "file") {
      const fileMessages = mediaMessages.filter((m) => m.type === "file");
      return (
        <FlatList
          data={fileMessages}
          keyExtractor={(m) => m.messageId}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 24,
            paddingHorizontal: 16,
            gap: 8,
          }}
          ListEmptyComponent={
            <Text
              style={[styles.help, { textAlign: "center", marginTop: 24, paddingHorizontal: 16 }]}
            >
              Chưa có file được chia sẻ.
            </Text>
          }
          renderItem={({ item: m }) => {
            const { fileName, mimeType } = resolveChatFileBubbleMeta(m);
            const who =
              memberNameById.get(m.senderId) ?? m.senderDisplayName?.trim() ?? "Thành viên";
            const when = formatBulletinFooterTime(m.createdAt);
            return (
              <Pressable
                style={styles.mediaFileRow}
                onPress={() => {
                  if (!m.mediaUrl) return;
                  void openOrShareChatFile(
                    m.mediaUrl,
                    chatMediaDownloadFilename(m, "file"),
                    m.mediaType,
                  );
                }}
              >
                <ChatFileTypeBadge fileName={fileName} mimeType={mimeType} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.mediaFileName} numberOfLines={1}>
                    {fileName}
                  </Text>
                  <Text style={styles.mediaFileMeta} numberOfLines={1}>
                    {who} · {when || "—"}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      );
    }

    if (mediaTab === "link") {
      return (
        <FlatList
          data={linkGalleryRows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          ListEmptyComponent={
            <Text
              style={[styles.help, { textAlign: "center", marginTop: 24, paddingHorizontal: 16 }]}
            >
              Chưa có link trong tin nhắn gần đây.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.searchRow}
              onPress={() => {
                const href = /^https?:\/\//i.test(item.url) ? item.url : `https://${item.url}`;
                void Linking.openURL(href);
              }}
              onLongPress={async () => {
                await Clipboard.setStringAsync(item.url);
                toast.success("Đã sao chép link");
              }}
            >
              <Text style={styles.menuLabel} numberOfLines={2}>
                {item.url}
              </Text>
              <Text style={styles.subSmall} numberOfLines={2}>
                {formatChatPreviewLine(item.message, effectiveUserId ?? "")}
              </Text>
            </Pressable>
          )}
        />
      );
    }

    return (
      <FlatList
        data={gridMessages}
        keyExtractor={(m) => m.messageId}
        numColumns={3}
        columnWrapperStyle={{ gap, paddingHorizontal: pad, marginBottom: gap }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        ListEmptyComponent={
          <Text
            style={[styles.help, { textAlign: "center", marginTop: 24, paddingHorizontal: 16 }]}
          >
            Chưa có ảnh hoặc video.
          </Text>
        }
        renderItem={({ item: m }) => {
          const imageUri = m.type === "image" ? chatImageDisplayUrl(m) : null;
          const videoUri = m.type === "video" ? chatVideoPlayUrl(m) : null;
          const thumbUri = imageUri || videoUri;
          return (
            <Pressable
              style={{ width: cell }}
              onPress={() => {
                if (m.type === "image" && imageUri) {
                  setGalleryLightbox({
                    kind: "image",
                    uri: imageUri,
                    filename: chatMediaDownloadFilename(m, "image"),
                  });
                  return;
                }
                if (m.type === "video" && videoUri) {
                  setGalleryLightbox({
                    kind: "video",
                    uri: videoUri,
                    filename: chatMediaDownloadFilename(m, "video"),
                  });
                }
              }}
            >
              {thumbUri && (m.type === "image" || m.type === "video") ? (
                <Image
                  source={{ uri: thumbUri }}
                  style={{ width: cell, height: cell, borderRadius: 8 }}
                />
              ) : (
                <View
                  style={[
                    styles.thumbPlaceholder,
                    {
                      width: cell,
                      height: cell,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: Z.sub,
                      fontSize: 11,
                      textAlign: "center",
                      paddingHorizontal: 4,
                    }}
                    numberOfLines={2}
                  >
                    •
                  </Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    );
  };

  const renderTransfer = () => (
    <FlatList
      data={othersForOwnerHandoff}
      keyExtractor={(m) => m.userId}
      ListEmptyComponent={<Text style={styles.help}>Không có thành viên khác.</Text>}
      renderItem={({ item: m }) => (
        <Pressable style={styles.memberRow} onPress={() => void transferOwnerTo(m.userId)}>
          <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
          <Text style={[styles.menuLabel, { flex: 1, marginLeft: 12 }]}>{m.displayName}</Text>
          <Text style={{ color: Z.primary, fontWeight: "600" }}>Chọn</Text>
        </Pressable>
      )}
    />
  );

  const muteUntilLabel = (() => {
    const u = conversation.notificationsMutedUntil;
    if (!u) return "Chưa đặt lịch tắt tạm";
    const d = new Date(u);
    return Number.isNaN(d.getTime()) ? "Đã hẹn tắt tạm" : `Hẹn tắt đến: ${d.toLocaleString()}`;
  })();

  const scheduledUntilIsoFromConv = useMemo(() => {
    const u = conversation.notificationsMutedUntil;
    if (!u) return null;
    const t = new Date(u).getTime();
    return Number.isFinite(t) && t > Date.now() ? u : null;
  }, [conversation.notificationsMutedUntil]);

  const renderPersonal = () => {
    return (
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text style={[styles.help, { paddingHorizontal: 16, paddingTop: 8 }]}>
          Áp dụng cho tài khoản của bạn trong hội thoại này.
        </Text>
        <ToggleRow
          label="Ghim trò chuyện lên đầu"
          value={isPinnedToTop}
          disabled={busy}
          onValueChange={(v) => void togglePinnedConv(v)}
        />
        <View style={styles.menuRow}>
          <Clock size={22} color={Z.text} strokeWidth={1.75} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.menuLabel}>Tắt thông báo tạm</Text>
            <Text style={styles.subSmall}>{muteUntilLabel}</Text>
          </View>
        </View>
        {isMuted ? (
          <MenuBlock
            onPress={() => void toggleMuted(false)}
            icon={<Bell size={22} color={Z.primary} strokeWidth={1.75} />}
            label="Bật thông báo"
          />
        ) : (
          <MenuBlock
            onPress={() => {
              setMuteNotifMode("create");
              setMuteNotifOpen(true);
            }}
            icon={<BellOff size={22} color={Z.text} strokeWidth={1.75} />}
            label="Tắt thông báo…"
          />
        )}
        {scheduledUntilIsoFromConv ? (
          <MenuBlock
            onPress={() => {
              setMuteNotifMode("edit");
              setMuteNotifOpen(true);
            }}
            icon={<Clock size={22} color={Z.text} strokeWidth={1.75} />}
            label="Chỉnh sửa mốc tắt tạm"
          />
        ) : null}
        <MenuBlock
          onPress={() => void clearMuteSchedule()}
          icon={<Bell size={22} color={Z.text} strokeWidth={1.75} />}
          label="Bỏ hẹn tắt tạm"
        />
      </ScrollView>
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={handleBack}
      >
        <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
          {panel !== "add" ? (
            <View style={styles.topBar}>
              <View style={styles.topBarSide}>
                <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
                  <ChevronLeft size={28} color={Z.text} strokeWidth={1.75} />
                </Pressable>
              </View>
              <Text style={styles.topTitleCenter} numberOfLines={1}>
                {headerTitle}
              </Text>
              <View style={[styles.topBarSide, { alignItems: "flex-end" }]}>
                {panel === "tasks" && canCreateTaskUi ? (
                  <Pressable
                    onPress={() => {
                      setEditingTaskData(null);
                      setTaskModalOpen(true);
                    }}
                    disabled={busy}
                    style={styles.backBtn}
                    hitSlop={12}
                    accessibilityLabel="Tạo công việc hoặc nhắc hẹn"
                  >
                    <Plus size={26} color={Z.primary} strokeWidth={2.25} />
                  </Pressable>
                ) : panel === "members" && canKickMembers ? (
                  <Pressable
                    onPress={openPromoteFlow}
                    disabled={busy || changingRole || adminSlotsFull}
                    style={({ pressed }) => [
                      styles.mmPromoteHeaderBtn,
                      pressed ? { opacity: 0.85 } : null,
                      adminSlotsFull ? { opacity: 0.45 } : null,
                    ]}
                    hitSlop={8}
                    accessibilityLabel="Bổ nhiệm phó nhóm"
                  >
                    <Text style={styles.mmPromoteHeaderBtnText} numberOfLines={1}>
                      + Bổ nhiệm
                    </Text>
                  </Pressable>
                ) : panel === "bulletinFeed" && canCreatePollUi ? (
                  <View>
                    <Pressable
                      onPress={() => setBulletinAddOpen((v) => !v)}
                      disabled={busy}
                      style={styles.backBtn}
                      hitSlop={12}
                      accessibilityLabel="Thêm bình chọn"
                    >
                      <Plus size={26} color={Z.primary} strokeWidth={2.25} />
                    </Pressable>
                    {bulletinAddOpen ? (
                      <View
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 40,
                          minWidth: 168,
                          backgroundColor: Z.bg,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: Z.border,
                          paddingVertical: 4,
                          zIndex: 20,
                          elevation: 8,
                          shadowColor: "#000",
                          shadowOpacity: 0.12,
                          shadowRadius: 8,
                          shadowOffset: { width: 0, height: 4 },
                        }}
                      >
                        <Pressable
                          onPress={() => {
                            setBulletinAddOpen(false);
                            setPollModalOpen(true);
                          }}
                          style={{ paddingHorizontal: 14, paddingVertical: 10 }}
                        >
                          <Text style={styles.menuLabel}>Tạo bình chọn</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {panel !== "add" ? (
            <View style={styles.body}>
              {panel === "home" && renderHome()}
              {panel === "rename" && renderRename()}
              {panel === "members" && renderMembers()}
              {panel === "settings" && renderSettings()}
              {panel === "bulletinFeed" && renderBulletinFeed()}
              {panel === "media" && renderMedia()}
              {panel === "transferOwner" && renderTransfer()}
              {panel === "tasks" && renderTasks()}
              {panel === "personal" && renderPersonal()}
            </View>
          ) : (
            <View style={[styles.body, { backgroundColor: "rgba(0,0,0,0.04)" }]} />
          )}
        </SafeAreaView>

        <GroupAddMembersModal
          visible={visible && panel === "add"}
          onClose={() => setPanel("home")}
          groupId={groupId}
          conversation={conversation}
          onAdded={() => void refetch()}
        />

        <Modal visible={promotePickerOpen} transparent animationType="slide">
          <Pressable style={styles.overlay} onPress={() => setPromotePickerOpen(false)}>
            <Pressable style={styles.promotePickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.promotePickerHead}>
                <Text style={styles.sheetTitle}>Chọn thành viên</Text>
                <Pressable
                  onPress={() => setPromotePickerOpen(false)}
                  hitSlop={12}
                  accessibilityLabel="Đóng"
                >
                  <X size={22} color={Z.sub} strokeWidth={2} />
                </Pressable>
              </View>
              <FlatList
                data={promotableMembers}
                keyExtractor={(m) => m.userId}
                style={{ maxHeight: 360 }}
                ListEmptyComponent={
                  <Text style={[styles.help, { textAlign: "center", paddingVertical: 28 }]}>
                    Không còn thành viên thường để bổ nhiệm
                  </Text>
                }
                renderItem={({ item: m }) => (
                  <Pressable
                    style={styles.promotePickerRow}
                    onPress={() => {
                      setPromotePickerOpen(false);
                      confirmPromote(m);
                    }}
                  >
                    <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                    <Text style={[styles.menuLabel, { flex: 1, marginLeft: 12 }]} numberOfLines={1}>
                      {memberRowDisplayName(m, effectiveUserId)}
                    </Text>
                    <Text style={styles.promotePickerAction}>Bổ nhiệm</Text>
                  </Pressable>
                )}
              />
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={pickOwnerForLeave} transparent animationType="fade">
          <Pressable style={styles.overlay} onPress={() => setPickOwnerForLeave(false)}>
            <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.sheetTitle}>Chọn trưởng nhóm mới</Text>
              <FlatList
                data={othersForOwnerHandoff}
                keyExtractor={(m) => m.userId}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.memberRow}
                    onPress={() => {
                      setPickOwnerForLeave(false);
                      void runLeave(item.userId);
                    }}
                  >
                    <Avatar uri={item.avatar || undefined} name={item.displayName} size="sm" />
                    <Text style={[styles.menuLabel, { flex: 1, marginLeft: 12 }]}>
                      {item.displayName}
                    </Text>
                    <Text style={{ color: Z.primary, fontWeight: "600" }}>Chọn</Text>
                  </Pressable>
                )}
              />
              <Pressable style={styles.sheetCancel} onPress={() => setPickOwnerForLeave(false)}>
                <Text style={{ color: Z.sub, fontWeight: "600" }}>Hủy</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </Modal>

      <MuteNotificationsModal
        visible={muteNotifOpen}
        mode={muteNotifMode}
        scheduledUntilIso={muteNotifMode === "edit" ? scheduledUntilIsoFromConv : null}
        isSubmitting={muteNotifSubmitting}
        onClose={() => !muteNotifSubmitting && setMuteNotifOpen(false)}
        onConfirm={async (p) => {
          await applyMuteFromModal(p);
        }}
      />

      <GroupTaskModal
        visible={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTaskData(null);
        }}
        groupId={groupId}
        currentUserId={effectiveUserId}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          avatar: m.avatar,
          role: roleLabel(m.role),
        }))}
        existingTask={editingTaskData}
        onDelete={
          editingTaskData
            ? async () => {
                try {
                  await deleteTaskMut({
                    groupId,
                    taskId: editingTaskData.taskId,
                  }).unwrap();
                  toast.success("Đã hủy công việc");
                  setTaskModalOpen(false);
                  setEditingTaskData(null);
                } catch {
                  toast.error("Không thể hủy công việc");
                }
              }
            : undefined
        }
      />

      <GroupPollModal
        visible={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        groupId={groupId}
        canCreatePollUi={canCreatePollUi}
      />

      <Modal
        visible={aiSummaryOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !aiSummaryLoading && setAiSummaryOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => !aiSummaryLoading && setAiSummaryOpen(false)}
        >
          <Pressable style={styles.aiSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.aiSheetHeader}>
              <View style={styles.aiSheetIconWrap}>
                <Sparkles size={18} color="#fff" strokeWidth={2} />
              </View>
              <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                <Text style={styles.aiSheetTitle}>AI Tóm tắt tin nhắn nhóm</Text>
                <Text style={styles.aiSheetSub} numberOfLines={1}>
                  {conversation.name ?? ""}
                </Text>
              </View>
              <Pressable
                hitSlop={12}
                onPress={() => !aiSummaryLoading && setAiSummaryOpen(false)}
                disabled={aiSummaryLoading}
              >
                <Text style={{ fontSize: 22, color: Z.sub, fontWeight: "300" }}>×</Text>
              </Pressable>
            </View>
            <ScrollView
              style={{ maxHeight: Dimensions.get("window").height * 0.62 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {aiSummaryLoading ? (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <ActivityIndicator size="large" color={Z.primary} />
                  <Text style={[styles.menuLabel, { marginTop: 16 }]}>AI đang phân tích...</Text>
                  <Text
                    style={[
                      styles.subSmall,
                      { marginTop: 8, textAlign: "center", paddingHorizontal: 12 },
                    ]}
                  >
                    Đang đọc và tóm tắt lịch sử trò chuyện gần đây
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 14, lineHeight: 22, color: Z.text }}>
                    {aiSummaryResult}
                  </Text>
                  <Pressable
                    style={[styles.primaryBtn, { marginTop: 16 }]}
                    onPress={() => void handleRerunAiSummary()}
                    disabled={aiSummaryLoading}
                  >
                    <Text style={styles.primaryBtnText}>Phân tích lại</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(addPollOptionTargetId)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!addPollOptionBusy) setAddPollOptionTargetId(null);
        }}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => {
            if (!addPollOptionBusy) setAddPollOptionTargetId(null);
          }}
        >
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Thêm lựa chọn</Text>
            <TextInput
              value={addPollOptionDraft}
              onChangeText={setAddPollOptionDraft}
              placeholder="Nhập lựa chọn mới"
              placeholderTextColor={Z.sub}
              editable={!addPollOptionBusy}
              style={{
                marginHorizontal: 16,
                marginTop: 8,
                borderWidth: 1,
                borderColor: Z.line,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                color: Z.text,
                backgroundColor: Z.bg,
              }}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 12,
              }}
            >
              <Pressable
                onPress={() => {
                  if (!addPollOptionBusy) setAddPollOptionTargetId(null);
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 8 }}
              >
                <Text style={{ fontWeight: "600", color: Z.sub }}>Hủy</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitAddPollOptionFromSheet()}
                disabled={addPollOptionBusy || !addPollOptionDraft.trim()}
                style={{
                  backgroundColor: Z.primary,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  opacity: addPollOptionBusy || !addPollOptionDraft.trim() ? 0.5 : 1,
                }}
              >
                {addPollOptionBusy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Thêm</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ChatMediaLightbox state={galleryLightbox} onClose={() => setGalleryLightbox(null)} />
    </>
  );
}

/** Hàng điều hướng màn Thông tin nhóm — khớp web ConversationInfoPanel (chỉ label + chevron). */
function HomeNavRow({
  label,
  onPress,
  isLast,
}: {
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable
      style={[styles.homeNavRow, isLast ? styles.homeNavRowLast : null]}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
    >
      <Text style={styles.homeNavRowLabel}>{label}</Text>
      <ChevronRight size={16} color={Z.sub} />
    </Pressable>
  );
}

function MenuBlock({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuRow} onPress={onPress}>
      {icon}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub ? <Text style={styles.subSmall}>{sub}</Text> : null}
      </View>
      <ChevronRight size={18} color={Z.sub} />
    </Pressable>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  sub?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 8, minWidth: 0 }}>
        <Text style={styles.menuLabel}>{label}</Text>
        {sub ? <Text style={styles.subSmall}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
        thumbColor={value ? Z.primary : "#f4f4f5"}
      />
    </View>
  );
}

/** Một hàng quản trị: nhãn (+ gợi ý Help) | switch — khớp web GroupManagementModal ToggleRow. */
function GroupAdminToggleRow({
  label,
  sub,
  value,
  disabled,
  onValueChange,
  help,
}: {
  label: string;
  sub?: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (v: boolean) => void;
  /** Tooltip web → chạm icon mở Alert. */
  help?: string;
}) {
  return (
    <View style={styles.toggleRowGroup}>
      <View style={styles.toggleRowGroupLabel}>
        <View style={styles.toggleRowGroupLabelInner}>
          <Text style={styles.gmAdminToggleLabel}>{label}</Text>
          {help ? (
            <Pressable
              onPress={() => Alert.alert("Gợi ý", help)}
              hitSlop={10}
              accessibilityLabel="Gợi ý"
              accessibilityRole="button"
            >
              <HelpCircle size={16} color="#94A3B8" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
        {sub ? <Text style={styles.gmAdminToggleSub}>{sub}</Text> : null}
      </View>
      <View style={styles.toggleRowGroupSwitch}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: "#D1D5DB", true: "#93C5FD" }}
          thumbColor={value ? Z.primary : "#f4f4f5"}
        />
      </View>
    </View>
  );
}

function MemberPermissionRow({
  label,
  hint,
  checked,
  disabled,
  isLast,
  onToggle,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  isLast: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onToggle(!checked)}
      disabled={disabled}
      style={({ pressed }) => [
        { width: "100%" },
        styles.gmMemberRowHit,
        !disabled && pressed ? styles.gmMemberRowPressed : null,
        disabled ? styles.gmMemberRowDisabled : null,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      android_ripple={{ color: "rgba(0,104,255,0.06)" }}
    >
      <View style={[styles.gmMemberRowInner, isLast ? styles.gmMemberRowInnerLast : null]}>
        <View style={styles.gmMemberTextCol}>
          <Text style={styles.gmMemberLabel}>{label}</Text>
          {hint ? <Text style={styles.gmMemberHint}>{hint}</Text> : null}
        </View>
        <View style={styles.gmMemberControlCol}>
          <View style={[styles.gmCheckbox, checked ? styles.gmCheckboxOn : null]}>
            {checked ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Z.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  backBtn: { padding: 8 },
  topBarSide: { width: 44, justifyContent: "center" },
  topTitleCenter: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: Z.text,
    textAlign: "center",
  },
  body: { flex: 1, backgroundColor: Z.bg },
  scroll: { flex: 1, backgroundColor: Z.subBg },
  homeScrollContent: { paddingBottom: 48 },
  hero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  heroAvatarFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  avatarWrap: { position: "relative" },
  camBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: Z.primary,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 24,
    gap: 8,
  },
  groupTitle: { fontSize: 18, fontWeight: "700", color: Z.text, flexShrink: 1 },
  memberCountText: {
    fontSize: 14,
    color: Z.sub,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "center",
    opacity: 0.8,
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 16,
    paddingBottom: 4,
    width: "100%",
  },
  quickCell: { flex: 1, alignItems: "center", paddingVertical: 2, minWidth: 0 },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Z.subBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 10,
    color: Z.sub,
    textAlign: "center",
    lineHeight: 13,
    fontWeight: "500",
  },
  aiBlock: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: "rgba(37, 99, 235, 0.05)",
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#0068ff",
    ...Platform.select({
      ios: {
        shadowColor: "#8c52ff",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  aiButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  aiHint: {
    fontSize: 11,
    color: Z.sub,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "500",
  },
  memberMgmtCard: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  memberMgmtHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  memberMgmtTitle: { fontSize: 14, fontWeight: "700", color: Z.text, flex: 1, marginRight: 8 },
  requestBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  requestBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  homeSectionSpaced: { marginTop: 8 },
  bulletinOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  bulletinHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  bulletinHeaderTitle: { flex: 1, fontSize: 14, fontWeight: "700", color: Z.text },
  bulletinBody: { paddingBottom: 8 },
  bulletinSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bulletinSubLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Z.sub,
  },
  homeNavGroup: {
    marginTop: 8,
    backgroundColor: Z.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  homeNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  homeNavRowLast: { borderBottomWidth: 0 },
  homeNavRowLabel: { fontSize: 14, fontWeight: "700", color: Z.text },
  homeActionsWrap: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
    backgroundColor: Z.bg,
  },
  homeBtnTransfer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 104, 255, 0.25)",
  },
  homeBtnTransferText: {
    fontSize: 14,
    fontWeight: "700",
    color: Z.primary,
  },
  homeBtnLeave: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  homeBtnLeaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: Z.red,
  },
  homeBtnDisband: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#EF4444",
  },
  homeBtnDisbandText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  bulletinRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
  },
  bulletinRowLabel: { fontSize: 14, fontWeight: "600", color: Z.text },
  bulletinSplitRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  bulletinSplitBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  bulletinSplitBtnText: { fontSize: 13, fontWeight: "700", color: Z.primary },
  aiSheet: {
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: Z.bg,
    maxHeight: "88%",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  aiSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: "#F5F3FF",
  },
  aiSheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Z.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiSheetTitle: { fontSize: 16, fontWeight: "700", color: Z.text },
  aiSheetSub: { fontSize: 11, color: Z.sub, marginTop: 2, fontWeight: "600" },
  thumbPlaceholder: { backgroundColor: Z.subBg, alignItems: "center", justifyContent: "center" },
  mediaFileRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Z.line,
    backgroundColor: Z.bg,
    marginBottom: 8,
  },
  mediaFileName: {
    fontSize: 13,
    fontWeight: "600",
    color: Z.text,
    lineHeight: 18,
  },
  mediaFileMeta: {
    marginTop: 4,
    fontSize: 11,
    color: Z.sub,
    lineHeight: 14,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  menuLabel: { fontSize: 15, color: Z.text, fontWeight: "500" },
  subSmall: { fontSize: 13, color: Z.sub, marginTop: 2 },
  divider: { height: 8, backgroundColor: Z.subBg },
  linkBlock: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  linkSub: { fontSize: 12, color: Z.sub, marginTop: 4 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  toggleRowGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    gap: 12,
  },
  toggleRowGroupLabel: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  toggleRowGroupLabelInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    alignSelf: "stretch",
  },
  toggleRowGroupSwitch: {
    width: 52,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  destructRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  destructText: { fontSize: 15, fontWeight: "600", color: Z.red },
  panelPad: { padding: 16 },
  fieldLabel: { fontSize: 13, color: Z.sub, marginBottom: 8, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: Z.text,
    backgroundColor: "#FAFAFA",
  },
  primaryBtn: {
    backgroundColor: Z.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  help: { fontSize: 13, color: Z.sub, marginBottom: 10 },
  gmScrollContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  gmAdminBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  gmAdminBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
    lineHeight: 19,
  },
  gmSectionTitle: {
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  gmMemberCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    backgroundColor: Z.bg,
    overflow: "hidden",
  },
  gmMemberRowHit: {
    width: "100%",
    overflow: "hidden",
  },
  gmMemberRowPressed: {
    backgroundColor: "#F8FAFC",
  },
  gmMemberRowDisabled: {
    opacity: 0.82,
  },
  gmMemberRowInner: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  gmMemberRowInnerLast: {
    borderBottomWidth: 0,
  },
  gmMemberTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
    paddingTop: 2,
  },
  gmMemberControlCol: {
    width: 52,
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  gmMemberLabel: {
    fontSize: 14,
    color: Z.text,
    fontWeight: "500",
    lineHeight: 20,
  },
  gmMemberHint: {
    fontSize: 12,
    color: Z.sub,
    marginTop: 4,
    lineHeight: 17,
  },
  gmCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Z.bg,
  },
  gmCheckboxOn: {
    backgroundColor: Z.primary,
    borderColor: Z.primary,
  },
  gmAdminToggles: {
    marginTop: 8,
    marginBottom: 4,
  },
  gmAdminToggleLabel: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    color: Z.text,
    fontWeight: "500",
    lineHeight: 20,
  },
  gmAdminToggleSub: {
    fontSize: 12,
    color: Z.sub,
    marginTop: 4,
    lineHeight: 17,
  },
  gmJoinLinkWrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#BFDBFE",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  gmJoinUrlCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  gmJoinUrlText: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: "#0068FF",
    lineHeight: 18,
  },
  gmJoinActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  gmJoinIconBtn: {
    padding: 0,
    borderRadius: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  gmPlaceholderBlock: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 2,
  },
  gmPlaceholderHit: {
    width: "100%",
    borderRadius: 10,
    opacity: 0.65,
  },
  gmPlaceholderPressed: {
    opacity: 0.85,
    backgroundColor: "rgba(248,250,252,0.95)",
  },
  gmPlaceholderRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  gmPlaceholderLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "500",
    color: Z.text,
    lineHeight: 20,
  },
  gmReadOnlyFooter: {
    fontSize: 12,
    color: Z.sub,
    textAlign: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    lineHeight: 18,
  },
  addMemberNotice: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginBottom: 12,
  },
  addMemberNoticeText: { fontSize: 13, color: "#1E40AF", fontWeight: "600", lineHeight: 18 },
  addFriendSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FAFAFA",
  },
  addFriendSearchInput: { flex: 1, fontSize: 15, color: Z.text, paddingVertical: 2 },
  inviteCheckBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Z.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Z.bg,
  },
  inviteCheckBoxOn: { backgroundColor: Z.primary, borderColor: Z.primary },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Z.subBg },
  miniBtnTextOk: { color: Z.primary, fontWeight: "700", fontSize: 13 },
  miniBtnTextNo: { color: Z.red, fontWeight: "700", fontSize: 13 },
  requestFriendLink: { color: Z.primary, fontWeight: "700", fontSize: 13 },
  mmAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Z.subBg,
  },
  mmAddBtnText: { fontSize: 13, fontWeight: "700", color: Z.primary },
  mmTabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  mmTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    minHeight: 40,
  },
  mmTabActive: { backgroundColor: Z.primary },
  mmTabIdle: { backgroundColor: Z.subBg },
  mmTabText: { fontSize: 12, fontWeight: "700" },
  mmTabTextActive: { color: "#fff" },
  mmTabTextIdle: { color: Z.sub },
  mmPendingCountBadge: {
    marginLeft: 2,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  mmPendingCountBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  mmMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    marginBottom: 4,
  },
  mmMemberName: { fontSize: 14, fontWeight: "700", color: Z.text },
  mmAdminQuota: {
    fontSize: 12,
    color: Z.sub,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  mmMemberActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  mmIconActionPromote: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(0, 104, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  mmIconActionKick: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  mmPromoteHeaderBtn: {
    maxWidth: 88,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0, 104, 255, 0.1)",
  },
  mmPromoteHeaderBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Z.primary,
  },
  promotePickerSheet: {
    marginTop: "auto",
    backgroundColor: Z.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    maxHeight: "55%",
  },
  promotePickerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  promotePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  promotePickerAction: {
    fontSize: 12,
    fontWeight: "700",
    color: Z.primary,
  },
  mmRolePillOwner: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  mmRolePillOwnerText: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  mmRolePillAdmin: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(0, 104, 255, 0.1)",
  },
  mmRolePillAdminText: { fontSize: 11, fontWeight: "700", color: "#1D4ED8" },
  mmMoreBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Z.subBg,
    alignItems: "center",
    justifyContent: "center",
  },
  mmPendingCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Z.line,
    backgroundColor: Z.bg,
  },
  sectionCap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "700",
    color: Z.sub,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  iconBtn: { padding: 8 },
  kickOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
  },
  kickOutBtnText: { fontSize: 14, fontWeight: "700", color: Z.red },
  bulletinTabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  bulletinTabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  bulletinTabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Z.sub,
    textAlign: "center",
  },
  bulletinTabLabelActive: { color: Z.primary },
  bulletinTabUnderline: {
    marginTop: 6,
    height: 2,
    alignSelf: "stretch",
    marginHorizontal: 8,
    borderRadius: 2,
    backgroundColor: Z.primary,
  },
  bulletinSectionCap: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: Z.sub,
    marginBottom: 8,
    marginTop: 4,
  },
  bulletinPinCard: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    backgroundColor: Z.bg,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bulletinPinCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulletinPinWho: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "700",
    color: Z.text,
  },
  bulletinPinWhen: { fontSize: 11, fontWeight: "600", color: Z.sub },
  bulletinPinPreview: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    lineHeight: 19,
  },
  bulletinPollCard: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    backgroundColor: Z.bg,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bulletinPollHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bulletinPollCreatorName: {
    fontSize: 13,
    fontWeight: "700",
    color: Z.text,
  },
  bulletinPollKindRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  bulletinPollKindLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },
  bulletinPollCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletinPollTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: Z.text,
    lineHeight: 21,
  },
  bulletinPollTitleBlock: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
    color: Z.text,
    lineHeight: 19,
  },
  bulletinPollPreview: {
    marginTop: 6,
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  bulletinPollMeta: { fontSize: 12, fontWeight: "600", color: Z.sub },
  bulletinPollFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    flexWrap: "wrap",
    gap: 4,
  },
  bulletinPollFooterSep: { fontSize: 11, color: "rgba(0,0,0,0.2)" },
  bulletinPollVoteLink: { fontSize: 11, fontWeight: "600", color: "#2563eb" },
  bulletinPollAdminRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bulletinPollAdminBtn: {
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  bulletinPollAdminBtnText: { fontSize: 10, fontWeight: "600", color: Z.text },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "700", color: Z.primary },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: Z.bg, borderRadius: 16, paddingTop: 12, maxHeight: "80%" },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Z.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
  },
});
