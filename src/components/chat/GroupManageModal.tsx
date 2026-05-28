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
import { ConfirmModal } from "@/components/chat/ConfirmModal";
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
import { ChatSharedFileRow } from "@/components/chat/ChatSharedFileRow";
import {
  ConversationGalleryLinkRow,
  CONVERSATION_GALLERY_THEME,
  type ConversationGalleryKind,
} from "@/components/chat/conversationGallery";
import { matchesGalleryCategory } from "@/components/chat/conversationGallery/conversationGalleryFilters";
import { BulletinTaskCard } from "@/components/chat/BulletinTaskCard";
import { Avatar } from "@/components/common/Avatar";
import { MAX_PINNED_PER_CONVERSATION } from "@/constants/chatPin";
import { orderPinnedMessagesMRU } from "@/utils/pinnedMessageOrder";
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
  useGetMessageGalleryQuery,
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
import { apiClient } from "@/services/api";
import { useLeaveCommunityMutation } from "@/store/api/communityApi";
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
  isGroupAdminSlotsFull,
  MAX_GROUP_ADMINS,
  normalizeGroupMembersList,
  resolveGroupMemberRole,
} from "@/utils/groupConversationPermissions";
import { getJoinGroupUrl as joinUrlFromSuffix } from "@/utils/joinGroupUrl";
import { filterGroupMembersExcludingRemoved } from "@/utils/groupMembersRealtime";
import { useGroupJoinLinkModalOptional } from "@/contexts/GroupJoinLinkModalContext";
import { buildAppMediaDownloadUrl } from "@/utils/chatMediaDownload";
import { resolveGroupAvatarDisplayUrl } from "@/utils/groupAvatarUrl";
import { normalizeMediaUrl } from "@/utils/url";

/** Màu / kích thước khớp web MemberManagementModal (inline). */
const MM = {
  avatarBg: "#DBEAFE",
  avatarText: "#1D4ED8",
  tabActive: "#0068FF",
  tabIdleBg: "rgba(0,0,0,0.05)",
  rowHover: "rgba(0,0,0,0.05)",
  pillOwnerBg: "rgba(245, 158, 11, 0.1)",
  pillOwnerText: "#D97706",
  pillAdminBg: "rgba(37, 99, 235, 0.1)",
  pillAdminText: "#1D4ED8",
  actionPromoteBg: "rgba(0, 104, 255, 0.1)",
  actionKickBg: "rgba(239, 68, 68, 0.1)",
  actionMoreBg: "rgba(0, 0, 0, 0.05)",
  actionKickIcon: "#DC2626",
  muted: "#6B7280",
} as const;

function memberAvatarInitials(name?: string | null): string {
  const raw = (name ?? "").trim();
  if (!raw) return "?";
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function MemberListAvatar({
  uri,
  name,
}: {
  uri?: string | null;
  name?: string | null;
}): ReactElement {
  const imageUri = uri?.trim() ? normalizeMediaUrl(uri.trim()) : undefined;
  if (imageUri) {
    return <Image source={{ uri: imageUri }} style={mmAvatarStyles.image} />;
  }
  return (
    <View style={mmAvatarStyles.fallback}>
      <Text style={mmAvatarStyles.fallbackText}>{memberAvatarInitials(name)}</Text>
    </View>
  );
}

const mmAvatarStyles = StyleSheet.create({
  image: { width: 40, height: 40, borderRadius: 20, backgroundColor: MM.avatarBg },
  fallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: MM.avatarBg,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { fontSize: 14, fontWeight: "700", color: MM.avatarText },
});

/** Avatar hero màn Thông tin nhóm — ảnh phủ kín khung tròn 80×80 (không thu nhỏ như size lg). */
function GroupHeroAvatar({
  uri,
  name,
  conversationId,
  cacheVersion,
}: {
  uri?: string | null;
  name?: string | null;
  conversationId: string;
  cacheVersion?: string | null;
}): ReactElement {
  const imageUri = uri?.trim()
    ? resolveGroupAvatarDisplayUrl(uri.trim(), { conversationId, updatedAt: cacheVersion })
    : undefined;
  if (imageUri) {
    return (
      <Image source={{ uri: imageUri }} style={groupHeroAvatarStyles.image} resizeMode="cover" />
    );
  }
  return (
    <View style={groupHeroAvatarStyles.fallback}>
      <Text style={groupHeroAvatarStyles.fallbackText}>{memberAvatarInitials(name ?? "Nhóm")}</Text>
    </View>
  );
}

const groupHeroAvatarStyles = StyleSheet.create({
  image: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    backgroundColor: "#DBEAFE",
  },
  fallback: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { fontSize: 28, fontWeight: "700", color: "#0068FF" },
});

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
  red: "#EF4444",
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

function requestRowDisplayName(
  userId: string,
  rawName: string | undefined,
  selfId?: string,
): string {
  if (selfId && userId === selfId) return "Bạn";
  return (rawName ?? "").trim() || userId;
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
  const isCommunityChat = !!conversation.groupId;
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
  const [memberActionMenuUserId, setMemberActionMenuUserId] = useState<string | null>(null);

  const [successorSearchQuery, setSuccessorSearchQuery] = useState("");
  const [selectedSuccessorId, setSelectedSuccessorId] = useState<string | null>(null);
  const [transferNewRole, setTransferNewRole] = useState<"admin" | "member">("admin");
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [disbandConfirmOpen, setDisbandConfirmOpen] = useState(false);

  const [kickConfirmOpen, setKickConfirmOpen] = useState(false);
  const [kickTargetMember, setKickTargetMember] = useState<IGroupMember | null>(null);
  const [demoteConfirmOpen, setDemoteConfirmOpen] = useState(false);
  const [demoteTargetMember, setDemoteTargetMember] = useState<IGroupMember | null>(null);
  const [promoteConfirmOpen, setPromoteConfirmOpen] = useState(false);
  const [promoteTargetMember, setPromoteTargetMember] = useState<IGroupMember | null>(null);
  const [promotePickerOpen, setPromotePickerOpen] = useState(false);
  const [friendActionUserIds, setFriendActionUserIds] = useState<Record<string, true>>({});

  useEffect(() => {
    if (demoteConfirmOpen || kickConfirmOpen || promoteConfirmOpen) {
      setMemberActionMenuUserId(null);
    }
  }, [demoteConfirmOpen, kickConfirmOpen, promoteConfirmOpen]);

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
      setMemberActionMenuUserId(null);
      setPromotePickerOpen(false);
      setFriendActionUserIds({});
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

  const galleryOpen = visible && panel === "media";
  const {
    data: galleryItems = [],
    isFetching: galleryFetching,
    isError: galleryError,
  } = useGetMessageGalleryQuery(
    { conversationId: groupId, category: mediaTab, limit: 120 },
    { skip: !galleryOpen },
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

  useEffect(() => {
    if (adminSlotsFull) {
      setTransferNewRole("member");
    } else {
      setTransferNewRole("admin");
    }
  }, [adminSlotsFull]);

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
  const [leaveCommunity] = useLeaveCommunityMutation();

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

  const filteredSuccessors = useMemo(() => {
    const q = successorSearchQuery.trim().toLowerCase();
    if (!q) return othersForOwnerHandoff;
    return othersForOwnerHandoff.filter((m) => m.displayName.toLowerCase().includes(q));
  }, [othersForOwnerHandoff, successorSearchQuery]);

  const effectiveMemberCount = members.length;
  const leaveBlockedByMinMembers =
    !conversation.groupId && effectiveMemberCount <= MIN_GROUP_MEMBERS;
  const leaveMinMembersHint = `Nhóm cần còn tối thiểu ${MIN_GROUP_MEMBERS} thành viên sau khi có người rời (hiện ${effectiveMemberCount} người). Hãy mời thêm thành viên hoặc giải tán nhóm.`;

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

  const visibleGalleryItems = useMemo(
    () => galleryItems.filter((item) => matchesGalleryCategory(item, mediaTab)),
    [galleryItems, mediaTab],
  );

  const pinnedMessageOrder = useAppSelector((s) => s.chat.pinnedMessageOrderByConv[groupId] ?? []);

  const pinnedList = useMemo(() => {
    const pinned = messages.filter((m) => m.isPinned && !m.isRecalled && !m.isDeleted);
    return orderPinnedMessagesMRU(pinned, pinnedMessageOrder);
  }, [messages, pinnedMessageOrder]);

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
      setMemberActionMenuUserId(null);
      setPanel("home");
      return;
    }
    onClose();
  }, [onClose, panel, pickOwnerForLeave, taskModalOpen]);

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
      const mid = uploadRes.mediaId?.trim();
      const url = mid ? buildAppMediaDownloadUrl(mid) : uploadRes.url?.trim();
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
      setKickTargetMember(m);
      setKickConfirmOpen(true);
    },
    [members.length],
  );

  const confirmDemote = useCallback((m: IGroupMember) => {
    setDemoteTargetMember(m);
    setDemoteConfirmOpen(true);
  }, []);

  const confirmPromote = useCallback(
    (m: IGroupMember) => {
      if (adminSlotsFull) {
        toast.error(
          `Nhóm chỉ có tối đa ${MAX_GROUP_ADMINS} phó nhóm. Hãy hạ một phó nhóm trước khi bổ nhiệm thêm.`,
        );
        return;
      }
      setPromoteTargetMember(m);
      setPromoteConfirmOpen(true);
    },
    [adminSlotsFull],
  );

  const normalizedMembers = useMemo(
    () =>
      normalizeGroupMembersList(members, {
        leaderId: conversation.leaderId,
        creatorId: conversation.creatorId,
      }),
    [members, conversation.leaderId, conversation.creatorId],
  );

  const promotableMembers = useMemo(
    () => normalizedMembers.filter((m) => m.role === "member"),
    [normalizedMembers],
  );

  const activeMemberIds = useMemo(
    () => new Set(normalizedMembers.map((m) => m.userId)),
    [normalizedMembers],
  );

  const membersForList = useMemo(() => {
    if (!membersLeadersOnly) return normalizedMembers;
    return normalizedMembers.filter((m) => m.role === "owner" || m.role === "admin");
  }, [normalizedMembers, membersLeadersOnly]);

  useEffect(() => {
    if (membersLeadersOnly && memberManageTab !== "list") {
      setMemberManageTab("list");
    }
  }, [membersLeadersOnly, memberManageTab]);

  useEffect(() => {
    if (canModerateMembers && !membersLeadersOnly) return;
    if (memberManageTab === "pending") {
      setMemberManageTab("list");
    }
  }, [canModerateMembers, membersLeadersOnly, memberManageTab]);

  useEffect(() => {
    if (kickTargetMember && !activeMemberIds.has(kickTargetMember.userId)) {
      setKickConfirmOpen(false);
      setKickTargetMember(null);
    }
    if (demoteTargetMember && !activeMemberIds.has(demoteTargetMember.userId)) {
      setDemoteConfirmOpen(false);
      setDemoteTargetMember(null);
    }
    if (promoteTargetMember && !activeMemberIds.has(promoteTargetMember.userId)) {
      setPromoteConfirmOpen(false);
      setPromoteTargetMember(null);
    }
    if (promotePickerOpen && promotableMembers.length === 0) {
      setPromotePickerOpen(false);
    }
  }, [
    activeMemberIds,
    demoteTargetMember,
    kickTargetMember,
    promotePickerOpen,
    promoteTargetMember,
    promotableMembers.length,
  ]);

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
    if (conversation.groupId && isOwner) {
      Alert.alert(
        "Không thể rời nhóm",
        "Bạn là Quản trị viên sáng lập của Cộng đồng này và không thể rời khỏi phòng trò chuyện. Nếu không muốn sử dụng chat nữa, vui lòng Tắt trò chuyện hoặc Giải tán phòng chat tại trang Cộng đồng.",
        [{ text: "OK" }],
      );
      return;
    }

    if (conversation.groupId) {
      Alert.alert(
        "Rời nhóm",
        "Cuộc trò chuyện này liên kết với Cộng đồng. Bạn muốn thực hiện hành động nào?",
        [
          {
            text: "Chỉ rời phòng chat",
            onPress: () => {
              void (async () => {
                try {
                  await leaveGroup({ groupId }).unwrap();
                  toast.success("Đã rời phòng chat");
                  navigateOut();
                } catch (e: unknown) {
                  toast.error("Không thể rời phòng chat");
                }
              })();
            },
          },
          {
            text: "Rời cả Cộng đồng",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await leaveCommunity(conversation.groupId!).unwrap();
                  toast.success("Đã rời cộng đồng và phòng chat");
                  navigateOut();
                } catch (e: unknown) {
                  toast.error("Không thể rời cộng đồng");
                }
              })();
            },
          },
          {
            text: "Hủy",
            style: "cancel",
          },
        ],
      );
      return;
    }

    if (leaveBlockedByMinMembers) {
      toast.warning(leaveMinMembersHint);
      return;
    }
    if (isOwner) {
      if (othersForOwnerHandoff.length === 0) {
        toast.warning("Không còn thành viên khác để chuyển quyền. Hãy giải tán nhóm.");
        return;
      }
      setSuccessorSearchQuery("");
      setSelectedSuccessorId(null);
      setPickOwnerForLeave(true);
      return;
    }
    setLeaveConfirmOpen(true);
  }, [
    conversation.groupId,
    leaveBlockedByMinMembers,
    leaveMinMembersHint,
    isOwner,
    othersForOwnerHandoff.length,
    leaveGroup,
    leaveCommunity,
    groupId,
    navigateOut,
  ]);

  const handleTransferPress = useCallback(() => {
    if (othersForOwnerHandoff.length === 0) {
      toast.warning("Không còn thành viên khác để chuyển quyền. Hãy giải tán nhóm.");
      return;
    }
    setSuccessorSearchQuery("");
    setSelectedSuccessorId(null);
    if (adminSlotsFull) {
      setTransferNewRole("member");
    } else {
      setTransferNewRole("admin");
    }
    setPanel("transferOwner");
  }, [othersForOwnerHandoff.length, adminSlotsFull]);

  const handleDeleteGroup = useCallback(() => {
    if (conversation.groupId) {
      Alert.alert(
        "Giải tán nhóm",
        "Để giải tán phòng chat này, vui lòng thực hiện từ cài đặt giải tán tại trang chi tiết Cộng đồng.",
        [{ text: "OK" }],
      );
      return;
    }
    setDisbandConfirmOpen(true);
  }, [conversation.groupId]);

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

  const bulletizeAiSummaryLines = useCallback((text: string) => {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith("-") || l.startsWith("•") ? l : `• ${l}`))
      .join("\n");
  }, []);

  const buildAiSummaryText = useCallback(
    (summary: string, highlights: string[], unreadSummary: string, unreadMessageCount: number) => {
      const summaryBlock = summary
        ? `Tổng hợp tin nhắn\n${bulletizeAiSummaryLines(summary)}`
        : "Tổng hợp tin nhắn\n• (Chưa có)";
      const highlightsBlock =
        highlights.length > 0
          ? `Điểm nổi bật\n${highlights.map((h) => `• ${String(h).trim()}`).join("\n")}`
          : "Điểm nổi bật\n• Không có";
      const unreadSummaryBlock = unreadSummary
        ? `Tin nhắn vừa bỏ lỡ (${unreadMessageCount})\n${bulletizeAiSummaryLines(unreadSummary)}`
        : `Tin nhắn vừa bỏ lỡ (${unreadMessageCount})\n• (Chưa có)`;
      return [summaryBlock, highlightsBlock, unreadSummaryBlock].join("\n\n");
    },
    [bulletizeAiSummaryLines],
  );

  const runAiSummary = useCallback(
    async (showSuccessToast: boolean) => {
      setAiSummaryResult("");
      setAiSummaryLoading(true);
      try {
        const result = await apiClient.post<{
          success?: boolean;
          data?: {
            summary?: string;
            highlights?: string[];
            unreadSummary?: string;
            unreadMessageCount?: number;
          };
        }>("/ai/group-summary", {
          conversationId: groupId,
          limit: 40,
        });
        const payload = result.data?.data;
        const summary = String(payload?.summary ?? "").trim();
        const highlights = Array.isArray(payload?.highlights)
          ? (payload.highlights as string[])
          : [];
        const unreadSummary = String(payload?.unreadSummary ?? "").trim();
        const unreadMessageCount = Number(payload?.unreadMessageCount ?? 0);
        setAiSummaryResult(
          buildAiSummaryText(summary, highlights, unreadSummary, unreadMessageCount),
        );
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
                ? CONVERSATION_GALLERY_THEME[mediaTab].label
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
          onPress={() => {
            if (conversation.groupId) {
              toast.error("Tên nhóm và ảnh đại diện được đồng bộ từ Cộng đồng");
              return;
            }
            void pickAvatar();
          }}
          disabled={busy || !canEditGroupProfile || !!conversation.groupId}
          style={[
            styles.avatarWrap,
            (!canEditGroupProfile || !!conversation.groupId) && { opacity: 0.85 },
          ]}
        >
          <View style={styles.heroAvatarFrame}>
            <GroupHeroAvatar
              uri={conversation.avatar}
              name={conversation.name}
              conversationId={groupId}
              cacheVersion={conversation.updatedAt}
            />
          </View>
          {canEditGroupProfile && !conversation.groupId ? (
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
              if (conversation.groupId) {
                toast.error("Tên nhóm và ảnh đại diện được đồng bộ từ Cộng đồng");
                return;
              }
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
        {conversation.groupId ? (
          <Pressable
            onPress={() => {
              onClose();
              router.push(`/communities/${conversation.groupId}`);
            }}
            style={{
              marginTop: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(0, 104, 255, 0.08)",
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 16,
            }}
          >
            <Users size={14} color="#0068FF" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#0068FF" }}>
              Đến trang Cộng đồng
            </Text>
          </Pressable>
        ) : null}

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
          <Pressable
            style={styles.quickCell}
            onPress={() => {
              if (conversation.groupId) {
                toast.info(
                  "Vui lòng mời thành viên tham gia Cộng đồng để tham gia phòng chat này.",
                );
                return;
              }
              setPanel("add");
            }}
            disabled={busy}
          >
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
          <View style={styles.memberMgmtHeaderLeft}>
            <Users size={16} color={Z.sub} strokeWidth={2} />
            <Text style={styles.memberMgmtTitle}>Quản lý thành viên</Text>
          </View>
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
          kind="media"
          onPress={() => {
            setMediaTab("media");
            setPanel("media");
          }}
        />
        <HomeNavRow
          kind="file"
          onPress={() => {
            setMediaTab("file");
            setPanel("media");
          }}
        />
        <HomeNavRow
          kind="link"
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
            style={[styles.homeBtnTransfer, busy ? { opacity: 0.5 } : null]}
            android_ripple={{ color: "rgba(0, 104, 255, 0.15)" }}
            onPress={handleTransferPress}
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
          style={[styles.homeBtnLeave, busy ? { opacity: 0.5 } : null]}
          android_ripple={{ color: "rgba(239, 68, 68, 0.15)" }}
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
            style={[styles.homeBtnDisband, busy ? { opacity: 0.5 } : null]}
            android_ripple={{ color: "rgba(255, 255, 255, 0.2)" }}
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
            <GroupHeroAvatar
              uri={conversation.avatar}
              name={conversation.name}
              conversationId={groupId}
              cacheVersion={conversation.updatedAt}
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

  const renderMembers = () => (
    <View style={styles.mmRoot}>
      {isCommunityChat && (
        <View
          style={{
            backgroundColor: "rgba(0, 104, 255, 0.08)",
            padding: 12,
            marginHorizontal: 16,
            marginTop: 12,
            borderRadius: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: "#0068FF", fontWeight: "600", lineHeight: 18 }}>
            Thành viên và vai trò được đồng bộ từ Cộng đồng. Vui lòng quản lý thành viên tại trang
            quản trị Cộng đồng.
          </Text>
        </View>
      )}
      {canModerateMembers && !membersLeadersOnly && !isCommunityChat ? (
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
              size={14}
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
              size={14}
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
            {joinRequests.length > 0 && memberManageTab !== "pending" ? (
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
          removeClippedSubviews={false}
          onScrollBeginDrag={() => setMemberActionMenuUserId(null)}
          contentContainerStyle={styles.mmListContent}
          ListEmptyComponent={
            <Text style={styles.mmListEmpty}>
              {membersLeadersOnly ? "Chưa có phó nhóm." : "Chưa có thành viên."}
            </Text>
          }
          renderItem={({ item: m }) => {
            const isSelfAdmin = m.role === "admin" && m.userId === effectiveUserId;
            const canKickThis =
              !isCommunityChat &&
              !membersLeadersOnly &&
              canKickMembers &&
              Boolean(effectiveUserId) &&
              m.userId !== effectiveUserId &&
              m.role !== "owner";
            const canDemote =
              !isCommunityChat && (canKickMembers || isSelfAdmin) && m.role === "admin";
            const canPromote =
              !isCommunityChat &&
              !membersLeadersOnly &&
              canKickMembers &&
              m.role === "member" &&
              !adminSlotsFull;
            const menuOpen = memberActionMenuUserId === m.userId;
            const displayName = memberRowDisplayName(m, effectiveUserId);
            return (
              <View style={[styles.mmMemberCard, menuOpen ? styles.mmMemberCardActive : null]}>
                <View style={styles.mmMemberRow}>
                  <MemberListAvatar uri={m.avatar} name={displayName} />
                  <View style={styles.mmMemberInfo}>
                    <Text style={styles.mmMemberName} numberOfLines={1}>
                      {displayName}
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
                        style={({ pressed }) => [
                          styles.mmIconActionPromote,
                          pressed ? styles.mmIconActionPressed : null,
                        ]}
                        disabled={changingRole}
                        onPress={() => confirmPromote(m)}
                        accessibilityLabel="Bổ nhiệm phó nhóm"
                      >
                        <UserPlus size={16} color={Z.primary} strokeWidth={2} />
                      </Pressable>
                    ) : null}
                    {canKickThis ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.mmIconActionKick,
                          pressed ? styles.mmIconActionPressed : null,
                        ]}
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
                        accessibilityLabel="Mời khỏi nhóm"
                      >
                        <UserMinus size={16} color={MM.actionKickIcon} strokeWidth={2} />
                      </Pressable>
                    ) : null}
                    {canDemote ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.mmMoreBtn,
                          menuOpen ? styles.mmMoreBtnActive : null,
                          pressed ? styles.mmMoreBtnPressed : null,
                        ]}
                        onPress={() =>
                          setMemberActionMenuUserId((prev) => (prev === m.userId ? null : m.userId))
                        }
                        accessibilityLabel="Tùy chọn vai trò"
                        accessibilityState={{ expanded: menuOpen }}
                      >
                        <MoreHorizontal size={16} color={MM.muted} strokeWidth={2} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {menuOpen && canDemote ? (
                  <View style={styles.mmActionMenuDrop}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.mmActionMenuItem,
                        pressed ? styles.mmActionMenuItemPressed : null,
                      ]}
                      disabled={changingRole}
                      onPress={() => {
                        setMemberActionMenuUserId(null);
                        confirmDemote(m);
                      }}
                      accessibilityRole="menuitem"
                    >
                      <Text style={styles.mmActionMenuItemText}>Hạ phó nhóm xuống thành viên</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={joinRequests}
          keyExtractor={(r) => r.userId}
          contentContainerStyle={styles.mmListContent}
          ListEmptyComponent={<Text style={styles.mmListEmpty}>Không có yêu cầu chờ.</Text>}
          renderItem={({ item: r }) => {
            const displayName = requestRowDisplayName(r.userId, r.name, effectiveUserId);
            const showAddFriend = r.isFriend !== true && !friendActionUserIds[r.userId];
            return (
              <View style={styles.mmPendingCard}>
                <MemberListAvatar uri={r.avatar} name={displayName} />
                <View style={styles.mmPendingInfo}>
                  <Text style={styles.mmMemberName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.mmPendingSubtitle}>{joinRequestSubtitle(r.status)}</Text>
                </View>
                <View style={styles.mmPendingActions}>
                  {showAddFriend ? (
                    <Pressable
                      onPress={() => {
                        void (async () => {
                          try {
                            await sendFriendReq({ userId: r.userId }).unwrap();
                            setFriendActionUserIds((p) => ({ ...p, [r.userId]: true }));
                            void refetchRequests();
                            toast.success("Đã kết bạn");
                          } catch (e: unknown) {
                            const st =
                              e && typeof e === "object" && "status" in e
                                ? (e as { status?: number }).status
                                : undefined;
                            if (st === 409) {
                              setFriendActionUserIds((p) => ({ ...p, [r.userId]: true }));
                            }
                            toast.error(st === 409 ? "Đã kết bạn" : "Không thể kết bạn");
                          }
                        })();
                      }}
                      style={styles.mmPendingBtnFriend}
                    >
                      <Text style={styles.mmPendingBtnFriendText}>Kết bạn</Text>
                    </Pressable>
                  ) : null}
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
                    style={styles.mmPendingBtnReject}
                  >
                    <Text style={styles.mmPendingBtnRejectText}>Từ chối</Text>
                  </Pressable>
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
                    style={styles.mmPendingBtnApprove}
                  >
                    <Text style={styles.mmPendingBtnApproveText}>Duyệt</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
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
              setMemberActionMenuUserId(null);
              setPanel("members");
            }}
            style={({ pressed }) => [
              styles.gmPlaceholderHit,
              pressed ? styles.gmPlaceholderPressed : null,
            ]}
            android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          >
            <View style={styles.gmPlaceholderRowInner}>
              <KeyRound size={20} color="#64748B" strokeWidth={2} />
              <Text style={styles.gmPlaceholderLabel}>Trưởng & phó nhóm</Text>
              <ChevronRight size={16} color={Z.sub} />
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
    return (
      <View style={styles.bulletinPinnedList}>
        {pinnedList.map((m) => (
          <BulletinPinnedMessageCard
            key={m.messageId}
            msg={m}
            when={formatBulletinFooterTime(m.createdAt)}
            viewerUserId={effectiveUserId ?? ""}
            onPress={() => jumpToPinnedMessage(m.messageId)}
            disabled={!onJumpToMessage}
          />
        ))}
      </View>
    );
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
      const canClosePoll =
        Boolean(onClosePoll && !p.closed) &&
        String(creatorId).trim() === String(effectiveUserId ?? "").trim();
      const showPollAdminRow = Boolean(onAddPollOption || canClosePoll);
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
                {canClosePoll ? (
                  <Pressable
                    onPress={() => void onClosePoll?.(p.id)}
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

    const listLoading =
      galleryFetching && visibleGalleryItems.length === 0 ? (
        <Text style={[styles.help, { textAlign: "center", marginTop: 24, paddingHorizontal: 16 }]}>
          Đang tải...
        </Text>
      ) : null;

    const listError = galleryError ? (
      <Text
        style={[
          styles.help,
          { textAlign: "center", marginTop: 24, paddingHorizontal: 16, color: "#DC2626" },
        ]}
      >
        Không tải được danh sách.
      </Text>
    ) : null;

    if (mediaTab === "file") {
      return (
        <View style={{ flex: 1 }}>
          <FlatList
            style={styles.mediaFileList}
            data={visibleGalleryItems}
            keyExtractor={(m) => m.messageId}
            contentContainerStyle={styles.mediaFileListContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              listLoading ??
              listError ?? (
                <Text
                  style={[
                    styles.help,
                    { textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
                  ]}
                >
                  Chưa có file được chia sẻ.
                </Text>
              )
            }
            ItemSeparatorComponent={() => <View style={styles.mediaFileListSeparator} />}
            renderItem={({ item: m }) => {
              const msg = m as IMessage;
              const { fileName, mimeType } = resolveChatFileBubbleMeta(msg);
              const who =
                memberNameById.get(m.senderId) ?? m.senderDisplayName?.trim() ?? "Thành viên";
              const when = formatBulletinFooterTime(m.createdAt);
              return (
                <ChatSharedFileRow
                  fileName={fileName}
                  mimeType={mimeType}
                  metaLine={`${who} · ${when || "—"}`}
                  onPress={() => jumpToPinnedMessage(m.messageId)}
                />
              );
            }}
          />
        </View>
      );
    }

    if (mediaTab === "link") {
      return (
        <View style={{ flex: 1 }}>
          <FlatList
            data={visibleGalleryItems}
            keyExtractor={(item) => item.messageId}
            contentContainerStyle={styles.mediaFileListContent}
            ItemSeparatorComponent={() => <View style={styles.mediaFileListSeparator} />}
            ListEmptyComponent={
              listLoading ??
              listError ?? (
                <Text
                  style={[
                    styles.help,
                    { textAlign: "center", marginTop: 24, paddingHorizontal: 16 },
                  ]}
                >
                  Chưa có link trong tin nhắn gần đây.
                </Text>
              )
            }
            renderItem={({ item }) => {
              const url = (item.content ?? "").trim();
              const who =
                memberNameById.get(item.senderId) ?? item.senderDisplayName?.trim() ?? "Thành viên";
              const when = formatBulletinFooterTime(item.createdAt);
              return (
                <ConversationGalleryLinkRow
                  url={url}
                  previewLine={`${who} · ${when || "—"}`}
                  onPress={() => jumpToPinnedMessage(item.messageId)}
                  onLongPress={async () => {
                    await Clipboard.setStringAsync(url);
                    toast.success("Đã sao chép link");
                  }}
                />
              );
            }}
          />
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <FlatList
          data={visibleGalleryItems}
          keyExtractor={(m) => m.messageId}
          numColumns={3}
          columnWrapperStyle={{ gap, paddingHorizontal: pad, marginBottom: gap }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          ListEmptyComponent={
            listLoading ??
            listError ?? (
              <Text
                style={[styles.help, { textAlign: "center", marginTop: 24, paddingHorizontal: 16 }]}
              >
                Chưa có ảnh hoặc video.
              </Text>
            )
          }
          renderItem={({ item: m }) => {
            const msg = m as IMessage;
            const isVideo =
              m.type === "video" || (m.mediaType ?? "").toLowerCase().startsWith("video/");
            const imageUri = !isVideo ? chatImageDisplayUrl(msg) : null;
            const videoUri = isVideo ? chatVideoPlayUrl(msg) : null;
            const thumbUri = (m.thumbnailUrl ?? "").trim() || imageUri || videoUri;
            return (
              <Pressable
                style={{ width: cell }}
                onPress={() => jumpToPinnedMessage(m.messageId)}
                onLongPress={() => {
                  if (!isVideo && imageUri) {
                    setGalleryLightbox({
                      kind: "image",
                      uri: imageUri,
                      filename: chatMediaDownloadFilename(msg, "image"),
                    });
                    return;
                  }
                  if (isVideo && videoUri) {
                    setGalleryLightbox({
                      kind: "video",
                      uri: videoUri,
                      filename: chatMediaDownloadFilename(msg, "video"),
                    });
                  }
                }}
              >
                {thumbUri ? (
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
                        backgroundColor: CONVERSATION_GALLERY_THEME.media.softBg,
                      },
                    ]}
                  >
                    <ImageIcon
                      size={22}
                      color={CONVERSATION_GALLERY_THEME.media.tint}
                      strokeWidth={1.75}
                    />
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>
    );
  };

  const renderTransfer = () => {
    const handleConfirmTransfer = async () => {
      if (!selectedSuccessorId) return;
      try {
        await transferOwner({
          groupId,
          newOwnerUserId: selectedSuccessorId,
          currentOwnerNewRole: transferNewRole,
        }).unwrap();
        setPanel("home");
        void refetch();
        toast.success("Trưởng nhóm mới đã được cập nhật");
      } catch {
        toast.error("Không thể chuyển quyền. Thử lại hoặc kiểm tra quyền trên máy chủ");
      }
    };

    return (
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* Role selection block */}
        <View className="border-b border-gray-100 bg-gray-50/50 px-4 py-3">
          <Text className="mb-2 text-xs font-medium leading-relaxed text-gray-500">
            Bạn sẽ mất quyền trưởng nhóm sau khi xác nhận. Chọn vai trò mới của bạn:
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              disabled={adminSlotsFull}
              onPress={() => setTransferNewRole("admin")}
              className={`flex-1 flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${transferNewRole === "admin" ? "border-[#0068ff] bg-blue-500/5" : "border-gray-200 bg-white"} ${adminSlotsFull ? "opacity-40" : ""}`}
            >
              <Text
                className={`text-[13px] font-bold ${transferNewRole === "admin" ? "text-[#0068ff]" : "text-gray-700"}`}
              >
                Phó nhóm
              </Text>
              <View
                className={`h-4 w-4 items-center justify-center rounded-full border ${transferNewRole === "admin" ? "border-[#0068ff]" : "border-gray-300"}`}
              >
                {transferNewRole === "admin" && (
                  <View className="h-2 w-2 rounded-full bg-[#0068ff]" />
                )}
              </View>
            </Pressable>
            <Pressable
              onPress={() => setTransferNewRole("member")}
              className={`flex-1 flex-row items-center justify-between rounded-xl border px-3 py-2.5 ${transferNewRole === "member" ? "border-[#0068ff] bg-blue-500/5" : "border-gray-200 bg-white"}`}
            >
              <Text
                className={`text-[13px] font-bold ${transferNewRole === "member" ? "text-[#0068ff]" : "text-gray-700"}`}
              >
                Thành viên
              </Text>
              <View
                className={`h-4 w-4 items-center justify-center rounded-full border ${transferNewRole === "member" ? "border-[#0068ff]" : "border-gray-300"}`}
              >
                {transferNewRole === "member" && (
                  <View className="h-2 w-2 rounded-full bg-[#0068ff]" />
                )}
              </View>
            </Pressable>
          </View>
          {adminSlotsFull ? (
            <Text className="mt-2 text-[11px] font-semibold text-amber-600">
              Nhóm đã đủ {MAX_GROUP_ADMINS} phó nhóm — bạn chỉ có thể trở thành thành viên.
            </Text>
          ) : null}
        </View>

        {/* Search bar block */}
        <View className="border-b border-gray-100 bg-white px-4 py-2">
          <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-100 px-3 py-1.5">
            <TextInput
              value={successorSearchQuery}
              onChangeText={setSuccessorSearchQuery}
              placeholder="Tìm kiếm thành viên nhận quyền..."
              placeholderTextColor="#9CA3AF"
              className="flex-grow p-0 text-[14px]"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Candidates list */}
        <FlatList
          data={filteredSuccessors}
          keyExtractor={(m) => m.userId}
          ListEmptyComponent={
            <Text style={[styles.help, { textAlign: "center", marginTop: 24 }]}>
              Không tìm thấy thành viên phù hợp.
            </Text>
          }
          renderItem={({ item: m }) => {
            const isSelected = selectedSuccessorId === m.userId;
            return (
              <Pressable
                className={`flex-row items-center border-b border-gray-50 px-4 py-3 active:bg-gray-50 ${isSelected ? "bg-blue-500/5" : ""}`}
                onPress={() => setSelectedSuccessorId(m.userId)}
              >
                <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                <View className="ml-3 flex-1">
                  <Text className="text-[14px] font-bold text-gray-800">{m.displayName}</Text>
                  {m.role === "admin" ? (
                    <Text className="mt-0.5 text-[11px] font-medium text-gray-400">Phó nhóm</Text>
                  ) : null}
                </View>
                {/* Radio button */}
                <View
                  className={`h-5 w-5 items-center justify-center rounded-full border ${isSelected ? "border-[#0068ff]" : "border-gray-300"}`}
                >
                  {isSelected && <View className="h-2.5 w-2.5 rounded-full bg-[#0068ff]" />}
                </View>
              </Pressable>
            );
          }}
        />

        {/* Action Button at the bottom */}
        <View className="border-t border-gray-100 bg-white p-4">
          <Pressable
            disabled={!selectedSuccessorId || busy}
            onPress={() => void handleConfirmTransfer()}
            className={`w-full items-center justify-center rounded-xl bg-[#0068ff] py-3.5 active:bg-blue-700 ${!selectedSuccessorId || busy ? "opacity-50" : ""}`}
          >
            {transferringOwner ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[15px] font-bold text-white">Xác nhận chuyển quyền</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

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
            <View style={[styles.topBar, panel === "members" ? styles.mmTopBar : null]}>
              <View style={[styles.topBarSide, panel === "members" ? styles.mmTopBarSide : null]}>
                <Pressable
                  onPress={handleBack}
                  style={panel === "members" ? styles.mmBackBtn : styles.backBtn}
                  hitSlop={12}
                >
                  <ChevronLeft
                    size={panel === "members" ? 20 : 28}
                    color={Z.text}
                    strokeWidth={panel === "members" ? 2 : 1.75}
                  />
                </Pressable>
              </View>
              <Text
                style={[
                  styles.topTitleCenter,
                  panel === "members" ? styles.mmTopTitle : null,
                  panel === "media" ? styles.mediaTopTitle : null,
                ]}
                numberOfLines={1}
              >
                {headerTitle}
              </Text>
              <View
                style={[
                  styles.topBarSide,
                  panel === "members" ? styles.mmTopBarSide : null,
                  panel !== "members"
                    ? { alignItems: "flex-end", minWidth: undefined, paddingRight: 16 }
                    : null,
                ]}
              >
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

        <Modal visible={pickOwnerForLeave} transparent animationType="fade">
          <Pressable style={styles.overlay} onPress={() => setPickOwnerForLeave(false)}>
            <Pressable style={styles.sheet} className="p-4" onPress={(e) => e.stopPropagation()}>
              <Text className="mb-2 px-1 text-[17px] font-bold text-gray-800">
                Chọn trưởng nhóm mới trước khi rời
              </Text>

              {/* Search bar block */}
              <View className="mb-3 px-1">
                <View className="flex-row items-center rounded-xl border border-gray-200 bg-gray-100 px-3 py-1.5">
                  <TextInput
                    value={successorSearchQuery}
                    onChangeText={setSuccessorSearchQuery}
                    placeholder="Tìm kiếm..."
                    placeholderTextColor="#9CA3AF"
                    className="flex-grow p-0 text-[14px]"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Successor selection list */}
              <FlatList
                data={filteredSuccessors}
                keyExtractor={(m) => m.userId}
                style={{ maxHeight: 260 }}
                ListEmptyComponent={
                  <Text style={[styles.help, { textAlign: "center", paddingVertical: 16 }]}>
                    Không tìm thấy thành viên
                  </Text>
                }
                renderItem={({ item: m }) => {
                  const isSelected = selectedSuccessorId === m.userId;
                  return (
                    <Pressable
                      className={`flex-row items-center rounded-xl px-2 py-2.5 active:bg-gray-50 ${isSelected ? "bg-blue-500/5" : ""}`}
                      onPress={() => setSelectedSuccessorId(m.userId)}
                    >
                      <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                      <View className="ml-3 flex-1">
                        <Text className="text-[14px] font-bold text-gray-800">{m.displayName}</Text>
                        {m.role === "admin" ? (
                          <Text className="text-[11px] font-medium text-gray-400">Phó nhóm</Text>
                        ) : null}
                      </View>
                      {/* Radio button */}
                      <View
                        className={`h-5 w-5 items-center justify-center rounded-full border ${isSelected ? "border-[#0068ff]" : "border-gray-300"}`}
                      >
                        {isSelected && <View className="h-2.5 w-2.5 rounded-full bg-[#0068ff]" />}
                      </View>
                    </Pressable>
                  );
                }}
              />

              {/* Bottom buttons */}
              <View className="mt-4 flex-row gap-3 px-1">
                <Pressable
                  onPress={() => setPickOwnerForLeave(false)}
                  className="flex-1 items-center justify-center rounded-xl bg-gray-100 py-3 active:bg-gray-200"
                >
                  <Text className="text-[14px] font-bold text-gray-700">Hủy</Text>
                </Pressable>
                <Pressable
                  disabled={!selectedSuccessorId || leaving}
                  onPress={() => {
                    if (!selectedSuccessorId) return;
                    setPickOwnerForLeave(false);
                    void runLeave(selectedSuccessorId);
                  }}
                  className={`flex-1 items-center justify-center rounded-xl bg-[#0068ff] py-3 active:bg-blue-700 ${!selectedSuccessorId || leaving ? "opacity-50" : ""}`}
                >
                  {leaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-[14px] font-bold text-white">Chọn & tiếp tục</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <ConfirmModal
          visible={leaveConfirmOpen}
          title="Rời nhóm?"
          description="Bạn sẽ rời khỏi nhóm và không còn nhận tin nhắn từ nhóm này."
          confirmLabel="Rời nhóm"
          variant="danger"
          isConfirming={leaving}
          onClose={() => setLeaveConfirmOpen(false)}
          onConfirm={() => {
            setLeaveConfirmOpen(false);
            void runLeave();
          }}
        />

        <ConfirmModal
          visible={disbandConfirmOpen}
          title="Giải tán nhóm?"
          description="Tất cả thành viên sẽ bị xóa khỏi nhóm và cuộc trò chuyện này sẽ bị giải tán vĩnh viễn."
          confirmLabel="Giải tán nhóm"
          variant="dangerSoft"
          isConfirming={deleting}
          onClose={() => setDisbandConfirmOpen(false)}
          onConfirm={() => {
            setDisbandConfirmOpen(false);
            void (async () => {
              try {
                await deleteGroup(groupId).unwrap();
                toast.success("Đã giải tán nhóm");
                navigateOut();
              } catch {
                toast.error("Không thể giải tán nhóm");
              }
            })();
          }}
        />

        <ConfirmModal
          visible={kickConfirmOpen && !!kickTargetMember}
          title="Mời khỏi nhóm"
          description={
            kickTargetMember
              ? `Mời "${memberRowDisplayName(kickTargetMember, effectiveUserId)}" ra khỏi nhóm?`
              : "Mời người này ra khỏi nhóm?"
          }
          confirmLabel="Mời ra khỏi nhóm"
          variant="danger"
          isConfirming={removing}
          onClose={() => setKickConfirmOpen(false)}
          onConfirm={() => {
            if (!kickTargetMember) return;
            setKickConfirmOpen(false);
            void (async () => {
              try {
                await removeMember({ groupId, userId: kickTargetMember.userId }).unwrap();
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
          }}
        />

        <ConfirmModal
          visible={demoteConfirmOpen && !!demoteTargetMember}
          title="Hạ phó nhóm"
          description={
            demoteTargetMember
              ? `Hạ "${memberRowDisplayName(demoteTargetMember, effectiveUserId)}" xuống thành viên?`
              : "Hạ người này xuống thành viên?"
          }
          confirmLabel="Hạ xuống thành viên"
          isConfirming={changingRole}
          onClose={() => setDemoteConfirmOpen(false)}
          onConfirm={() => {
            if (!demoteTargetMember) return;
            setDemoteConfirmOpen(false);
            void (async () => {
              try {
                await changeRole({
                  groupId,
                  userId: demoteTargetMember.userId,
                  role: "member",
                }).unwrap();
                void refetch();
                toast.success("Đã hạ phó nhóm xuống thành viên");
              } catch {
                toast.error("Không thể đổi vai trò");
              }
            })();
          }}
        />

        <ConfirmModal
          visible={promoteConfirmOpen && !!promoteTargetMember}
          title="Bổ nhiệm phó nhóm"
          description={
            promoteTargetMember
              ? `Bổ nhiệm "${memberRowDisplayName(promoteTargetMember, effectiveUserId)}" làm phó nhóm?`
              : "Bổ nhiệm người này làm phó nhóm?"
          }
          confirmLabel="Bổ nhiệm"
          isConfirming={changingRole}
          onClose={() => setPromoteConfirmOpen(false)}
          onConfirm={() => {
            if (!promoteTargetMember) return;
            setPromoteConfirmOpen(false);
            void (async () => {
              try {
                await changeRole({
                  groupId,
                  userId: promoteTargetMember.userId,
                  role: "admin",
                }).unwrap();
                void refetch();
                toast.success("Đã bổ nhiệm phó nhóm");
                setPromotePickerOpen(false);
              } catch {
                toast.error("Không thể đổi vai trò");
              }
            })();
          }}
        />

        <Modal
          visible={promotePickerOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setPromotePickerOpen(false)}
        >
          <Pressable style={styles.overlay} onPress={() => setPromotePickerOpen(false)}>
            <Pressable style={styles.mmPromotePickerSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.mmPromotePickerHeader}>
                <Text style={styles.mmPromotePickerTitle}>Chọn thành viên</Text>
                <Pressable
                  hitSlop={12}
                  onPress={() => setPromotePickerOpen(false)}
                  accessibilityLabel="Đóng"
                  style={({ pressed }) => [
                    styles.mmPromotePickerClose,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <X size={22} color={Z.sub} strokeWidth={2} />
                </Pressable>
              </View>
              <FlatList
                data={promotableMembers}
                keyExtractor={(m) => m.userId}
                style={{ maxHeight: Math.min(Dimensions.get("window").height * 0.55, 420) }}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
                ListEmptyComponent={
                  <Text style={[styles.help, { textAlign: "center", paddingVertical: 28 }]}>
                    Không còn thành viên thường để bổ nhiệm
                  </Text>
                }
                renderItem={({ item: m }) => (
                  <Pressable
                    style={({ pressed }) => [
                      styles.mmPromotePickerRow,
                      pressed ? styles.mmPromotePickerRowPressed : null,
                    ]}
                    onPress={() => {
                      setPromotePickerOpen(false);
                      confirmPromote(m);
                    }}
                  >
                    <MemberListAvatar
                      uri={m.avatar}
                      name={memberRowDisplayName(m, effectiveUserId)}
                    />
                    <Text style={styles.mmPromotePickerName} numberOfLines={1}>
                      {memberRowDisplayName(m, effectiveUserId)}
                    </Text>
                    <Text style={styles.mmPromotePickerAction}>Bổ nhiệm</Text>
                  </Pressable>
                )}
              />
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
          <Pressable
            style={[
              styles.aiSheet,
              { maxHeight: Math.min(Dimensions.get("window").height * 0.88, 720) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
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
            {aiSummaryLoading ? (
              <ScrollView
                style={styles.aiSheetScroll}
                contentContainerStyle={styles.aiSheetScrollContent}
                keyboardShouldPersistTaps="handled"
              >
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
              </ScrollView>
            ) : (
              <>
                <ScrollView
                  style={styles.aiSheetScroll}
                  contentContainerStyle={styles.aiSheetScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={{ fontSize: 14, lineHeight: 22, color: Z.text }}>
                    {aiSummaryResult}
                  </Text>
                </ScrollView>
                <View style={styles.aiSheetFooter}>
                  <Pressable
                    style={styles.primaryBtn}
                    onPress={() => void handleRerunAiSummary()}
                    disabled={aiSummaryLoading}
                  >
                    <Text style={styles.primaryBtnText}>Phân tích lại</Text>
                  </Pressable>
                </View>
              </>
            )}
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

/** Hàng điều hướng màn Thông tin nhóm — label đồng bộ web. */
function HomeNavRow({
  kind,
  onPress,
  isLast,
}: {
  kind: ConversationGalleryKind;
  onPress: () => void;
  isLast?: boolean;
}) {
  const theme = CONVERSATION_GALLERY_THEME[kind];
  return (
    <Pressable
      style={[styles.homeNavRow, isLast ? styles.homeNavRowLast : null]}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
    >
      <Text style={styles.homeNavRowLabel}>{theme.navLabel}</Text>
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  backBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  topBarSide: { width: 48, justifyContent: "center" },
  topTitleCenter: {
    flex: 1,
    fontSize: 21,
    fontWeight: "800",
    color: Z.text,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  mediaTopTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0,
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  memberMgmtHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    marginRight: 8,
  },
  memberMgmtTitle: { fontSize: 14, fontWeight: "700", color: Z.text, flexShrink: 1 },
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  homeNavRowLast: { borderBottomWidth: 0 },
  homeNavRowLabel: { flex: 1, fontSize: 14, fontWeight: "700", color: Z.text },
  homeActionsWrap: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: Z.bg,
  },
  homeBtnTransfer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(0, 104, 255, 0.4)",
    backgroundColor: "transparent",
  },
  homeBtnTransferText: {
    fontSize: 14,
    fontWeight: "700",
    color: Z.primary,
  },
  homeBtnLeave: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.35)",
    backgroundColor: "transparent",
  },
  homeBtnLeaveText: {
    fontSize: 14,
    fontWeight: "700",
    color: Z.red,
  },
  homeBtnDisband: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
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
  aiSheetScroll: {
    flexShrink: 1,
  },
  aiSheetScrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  aiSheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
    backgroundColor: Z.bg,
  },
  thumbPlaceholder: { backgroundColor: Z.subBg, alignItems: "center", justifyContent: "center" },
  mediaFileList: {
    flex: 1,
    backgroundColor: Z.bg,
  },
  mediaFileListContent: {
    paddingTop: 14,
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  mediaFileListSeparator: {
    height: 12,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#BFDBFE",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gmJoinUrlCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  gmJoinUrlText: {
    fontSize: 12,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    color: "#0068FF",
    lineHeight: 18,
  },
  gmJoinActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
  },
  gmJoinIconBtn: {
    padding: 0,
    borderRadius: 10,
    width: 36,
    height: 36,
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
  },
  gmPlaceholderPressed: {
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
  miniBtnOk: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0, 104, 255, 0.28)",
    backgroundColor: "#DBEAFE",
  },
  miniBtnNo: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.28)",
    backgroundColor: "#FEE2E2",
  },
  miniBtnTextOk: { color: "#0068FF", fontWeight: "700", fontSize: 13 },
  miniBtnTextNo: { color: "#DC2626", fontWeight: "700", fontSize: 13 },
  requestFriendLink: { color: Z.primary, fontWeight: "700", fontSize: 13 },
  mmRoot: { flex: 1, backgroundColor: Z.bg },
  mmTopBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mmTopBarSide: { width: 36 },
  mmBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  mmTopTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0,
  },
  mmPromotePickerSheet: {
    marginTop: "auto",
    maxHeight: "88%",
    backgroundColor: Z.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  mmPromotePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  mmPromotePickerTitle: { fontSize: 16, fontWeight: "800", color: Z.text },
  mmPromotePickerClose: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: Z.subBg,
  },
  mmPromotePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  mmPromotePickerRowPressed: { backgroundColor: Z.subBg },
  mmPromotePickerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: Z.text,
  },
  mmPromotePickerAction: {
    fontSize: 12,
    fontWeight: "800",
    color: Z.primary,
  },
  mmPendingActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 0,
    maxWidth: "46%",
  },
  mmPendingBtnFriend: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(37, 99, 235, 0.1)",
  },
  mmPendingBtnFriendText: { fontSize: 12, fontWeight: "800", color: "#1D4ED8" },
  mmPendingBtnReject: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  mmPendingBtnRejectText: { fontSize: 12, fontWeight: "800", color: "#DC2626" },
  mmPendingBtnApprove: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(0, 104, 255, 0.1)",
  },
  mmPendingBtnApproveText: { fontSize: 12, fontWeight: "800", color: Z.primary },
  mmTabsRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
    backgroundColor: Z.bg,
  },
  mmTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  mmTabActive: {
    backgroundColor: MM.tabActive,
    shadowColor: MM.tabActive,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  mmTabIdle: { backgroundColor: MM.tabIdleBg },
  mmTabText: { fontSize: 12, fontWeight: "700" },
  mmTabTextActive: { color: "#fff" },
  mmTabTextIdle: { color: MM.muted },
  mmListContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  mmListEmpty: {
    textAlign: "center",
    marginTop: 32,
    fontSize: 14,
    color: MM.muted,
  },
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
  mmMemberCard: {
    marginBottom: 8,
    borderRadius: 12,
    padding: 10,
  },
  mmMemberCardActive: {
    backgroundColor: MM.rowHover,
  },
  mmMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mmMemberInfo: { flex: 1, minWidth: 0, justifyContent: "center" },
  mmMemberName: { fontSize: 14, fontWeight: "700", color: Z.text },
  mmMemberActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  mmIconActionPromote: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: MM.actionPromoteBg,
    alignItems: "center",
    justifyContent: "center",
  },
  mmIconActionKick: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: MM.actionKickBg,
    alignItems: "center",
    justifyContent: "center",
  },
  mmIconActionPressed: {
    opacity: 0.85,
  },
  mmRolePillOwner: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: MM.pillOwnerBg,
  },
  mmRolePillOwnerText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    color: MM.pillOwnerText,
  },
  mmRolePillAdmin: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: MM.pillAdminBg,
  },
  mmRolePillAdminText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    color: MM.pillAdminText,
  },
  mmMoreBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: MM.actionMoreBg,
    alignItems: "center",
    justifyContent: "center",
  },
  mmMoreBtnActive: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  mmMoreBtnPressed: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  mmActionMenuDrop: {
    alignSelf: "flex-end",
    marginTop: 6,
    width: 176,
    borderRadius: 12,
    backgroundColor: Z.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.1)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  mmActionMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  mmActionMenuItemPressed: {
    backgroundColor: MM.rowHover,
  },
  mmActionMenuItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: Z.text,
    lineHeight: 18,
  },
  mmPendingInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
    justifyContent: "center",
  },
  mmPendingSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: MM.muted,
  },
  mmPendingCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.05)",
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
  bulletinPinnedList: {
    gap: 12,
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
