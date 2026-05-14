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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  UserCog,
  User,
  UserPlus,
  Users,
  Plus,
  MessageSquare,
} from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { MIN_GROUP_MEMBERS } from "@/constants/group";
import { env } from "@/config/env";
import { useAppSelector } from "@/hooks/useAppStore";
import type {
  IConversation,
  IGroupMember,
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
  useGetGroupRequestsQuery,
  useGetGroupMembersQuery,
  useDeleteGroupMutation,
  useChangeMemberRoleMutation,
  useAddMembersMutation,
  useGetPollsQuery,
  useGetTasksQuery,
  useDeleteTaskMutation,
} from "@/store/api/chatApi";
import { CHAT_MESSAGES_QUERY_LIMIT } from "@/store/api/endpoints/messageApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { useGetFriendsQuery } from "@/store/api/userApi";
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
  canUserCreatePollInGroup,
  canUserCreateTaskInGroup,
} from "@/utils/groupConversationPermissions";

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

function webOriginFromApi(): string {
  return env.apiBaseUrl.replace(/\/api\/v1\/?$/i, "");
}

function joinUrlFromSuffix(suffix: string | undefined): string {
  if (!suffix) return "";
  return `${webOriginFromApi()}/join/${suffix}`;
}

function roleLabel(role: MemberRole): string {
  if (role === "owner") return "Trưởng nhóm";
  if (role === "admin") return "Quản trị";
  return "Thành viên";
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
}: GroupManageModalProps): ReactElement {
  const groupId = conversation.conversationId;
  const authUserId = useAppSelector((s) => s.auth.user?.userId);
  const effectiveUserId = (currentUserId ?? authUserId)?.trim() || undefined;

  const [panel, setPanel] = useState<Panel>("home");
  const [pickOwnerForLeave, setPickOwnerForLeave] = useState(false);
  const [editName, setEditName] = useState(conversation.name ?? "");
  const [selectedInviteFriendIds, setSelectedInviteFriendIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [addFriendFilter, setAddFriendFilter] = useState("");
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
  const [bulletinExpanded, setBulletinExpanded] = useState(true);
  const [bulletinNotesTab, setBulletinNotesTab] = useState<BulletinNotesTab>("all");
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState("");

  useEffect(() => {
    if (visible) {
      const init = initialPanel ?? "home";
      if (init === "pinned") {
        setPanel("bulletinFeed");
        setBulletinNotesTab("pinned");
      } else if (init === "polls") {
        setPanel("bulletinFeed");
        setBulletinNotesTab("polls");
      } else if (init === "bulletinFeed") {
        setPanel("bulletinFeed");
        setBulletinNotesTab("all");
      } else {
        setPanel(init);
        setBulletinNotesTab("all");
      }
      setEditName(conversation.name ?? "");
      setAddFriendFilter("");
      setPickOwnerForLeave(false);
      setPollModalOpen(false);
      setTaskModalOpen(false);
      setEditingTaskData(null);
      setMuteNotifOpen(false);
      setMuteNotifSubmitting(false);
      setMediaTab("media");
      setBulletinExpanded(true);
      setAiSummaryOpen(false);
      setAiSummaryLoading(false);
      setAiSummaryResult("");
    }
  }, [visible, conversation.name, conversation.conversationId, initialPanel]);

  const {
    data: members = [],
    isFetching,
    refetch,
  } = useGetGroupMembersQuery(groupId, {
    skip: !visible,
    refetchOnMountOrArgChange: true,
  });

  const { data: messages = [] } = useGetMessagesQuery(
    { conversationId: groupId, limit: CHAT_MESSAGES_QUERY_LIMIT },
    { skip: !visible },
  );

  const { data: settings, refetch: refetchSettings } = useGetGroupSettingsQuery(groupId, {
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

  const { data: friends = [], isFetching: loadingFriendsForInvite } = useGetFriendsQuery(
    undefined,
    {
      skip: !visible || panel !== "add",
    },
  );

  const memberIdSet = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const friendsToInvite = useMemo(() => {
    const q = addFriendFilter.trim().toLowerCase();
    return friends.filter((f) => {
      if (memberIdSet.has(f.userId)) return false;
      if (!q) return true;
      return f.displayName.toLowerCase().includes(q);
    });
  }, [friends, memberIdSet, addFriendFilter]);

  const toggleInviteFriend = useCallback((userId: string) => {
    setSelectedInviteFriendIds((prev) => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId);
      else n.add(userId);
      return n;
    });
  }, []);

  const [updateGroup, { isLoading: savingName }] = useUpdateGroupMutation();
  const [addMembers, { isLoading: adding }] = useAddMembersMutation();
  const [removeMember, { isLoading: removing }] = useRemoveMemberMutation();
  const [changeRole, { isLoading: changingRole }] = useChangeMemberRoleMutation();
  const [deleteGroup, { isLoading: deleting }] = useDeleteGroupMutation();
  const [leaveGroup, { isLoading: leaving }] = useLeaveGroupMutation();
  const [patchPrefs, { isLoading: patchingPrefs }] = usePatchConversationPreferencesMutation();
  const [updateSettings, { isLoading: savingSettings }] = useUpdateGroupSettingsMutation();
  const [approveReq] = useApproveGroupRequestMutation();
  const [rejectReq] = useRejectGroupRequestMutation();
  const [uploadMedia, { isLoading: uploadingAvatar }] = useUploadMediaMutation();
  const [deleteTaskMut] = useDeleteTaskMutation();

  const { data: pollsEnvelope, isFetching: pollsFetching } = useGetPollsQuery(groupId, {
    skip: !visible,
  });

  const { data: tasksEnvelope, isFetching: tasksFetching } = useGetTasksQuery(groupId, {
    skip: !visible,
  });

  const myMember = useMemo(
    () => (effectiveUserId ? members.find((m) => m.userId === effectiveUserId) : undefined),
    [members, effectiveUserId],
  );
  const myRole = myMember?.role;
  const effectiveGroupSettings = settings ?? conversation.groupSettings;
  const canCreatePollUi = canUserCreatePollInGroup({
    conversation: { type: "group", groupSettings: effectiveGroupSettings },
    userRole: myRole,
  });
  const canCreateTaskUi = canUserCreateTaskInGroup({
    conversation: { type: "group", groupSettings: effectiveGroupSettings },
    userRole: myRole,
  });
  const canManageMembers = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";
  const canEditGroupSettings = isOwner || myRole === "admin";

  /** Khớp backend: owner/admin luôn được; member cần `changeNameAvatar` (áp dụng cho cả tên và ảnh nhóm). */
  const canEditGroupProfile = useMemo(() => {
    if (!myMember?.role) return false;
    if (myMember.role === "owner" || myMember.role === "admin") return true;
    return settings?.memberPermissions.changeNameAvatar ?? true;
  }, [myMember?.role, settings?.memberPermissions.changeNameAvatar]);

  const othersForOwnerHandoff = useMemo(
    () => members.filter((m) => m.userId !== effectiveUserId),
    [members, effectiveUserId],
  );

  const joinSuffix = settings?.joinLinkSuffix;
  const joinUrl = joinUrlFromSuffix(joinSuffix);
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
      const url = uploadRes.url?.trim();
      if (!url) throw new Error("no url");
      await updateGroup({ groupId, avatar: url }).unwrap();
      toast.success("Đã cập nhật ảnh đại diện nhóm");
    } catch {
      toast.error("Không thể cập nhật ảnh nhóm");
    }
  }, [canEditGroupProfile, groupId, updateGroup, uploadMedia]);

  const handleAddMembers = useCallback(async () => {
    const ids = [...selectedInviteFriendIds];
    if (ids.length === 0) {
      toast.error("Chọn ít nhất một bạn bè");
      return;
    }
    try {
      await addMembers({ groupId, memberIds: ids }).unwrap();
      setSelectedInviteFriendIds(new Set());
      void refetch();
      setPanel("home");
      toast.success("Đã gửi lời mời vào nhóm");
    } catch {
      toast.error("Không thể mời thành viên");
    }
  }, [addMembers, groupId, refetch, selectedInviteFriendIds]);

  const confirmRemove = useCallback(
    (m: IGroupMember) => {
      if (members.length <= MIN_GROUP_MEMBERS) {
        toast.warning(
          `Nhóm phải còn tối thiểu ${MIN_GROUP_MEMBERS} người — không thể xóa thêm (hiện ${members.length} người).`,
        );
        return;
      }
      Alert.alert("Xóa khỏi nhóm", `Xóa ${m.displayName} khỏi nhóm?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeMember({ groupId, userId: m.userId }).unwrap();
                void refetch();
                toast.success("Đã xóa thành viên");
              } catch (e: unknown) {
                const msg =
                  e && typeof e === "object" && "data" in e
                    ? String((e as { data?: { message?: string } }).data?.message ?? "")
                    : "";
                toast.error(msg || "Không thể xóa thành viên");
              }
            })();
          },
        },
      ]);
    },
    [groupId, members.length, removeMember, refetch],
  );

  const pickNewRole = useCallback(
    (m: IGroupMember) => {
      if (!isOwner || m.userId === effectiveUserId) return;
      Alert.alert("Đổi vai trò", m.displayName, [
        {
          text: "Quản trị",
          onPress: () => {
            void (async () => {
              try {
                await changeRole({ groupId, userId: m.userId, role: "admin" }).unwrap();
                void refetch();
                toast.success("Đã đặt làm quản trị");
              } catch {
                toast.error("Không thể đổi vai trò");
              }
            })();
          },
        },
        {
          text: "Thành viên",
          onPress: () => {
            void (async () => {
              try {
                await changeRole({ groupId, userId: m.userId, role: "member" }).unwrap();
                void refetch();
                toast.success("Đã đặt làm thành viên");
              } catch {
                toast.error("Không thể đổi vai trò");
              }
            })();
          },
        },
        { text: "Hủy", style: "cancel" },
      ]);
    },
    [changeRole, effectiveUserId, groupId, isOwner, refetch],
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

  const transferOwnerTo = useCallback(
    async (userId: string) => {
      if (!effectiveUserId) return;
      Alert.alert("Chuyển quyền trưởng nhóm", "Bạn sẽ trở thành quản trị sau khi chuyển.", [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: () => {
            void (async () => {
              try {
                await changeRole({ groupId, userId, role: "owner" }).unwrap();
                await changeRole({ groupId, userId: effectiveUserId, role: "admin" }).unwrap();
                setPanel("home");
                void refetch();
                toast.success("Trưởng nhóm mới đã được cập nhật");
              } catch {
                toast.error("Không thể chuyển quyền. Thử lại hoặc kiểm tra quyền trên máy chủ");
              }
            })();
          },
        },
      ]);
    },
    [changeRole, effectiveUserId, groupId, refetch],
  );

  const busy =
    savingName ||
    adding ||
    removing ||
    changingRole ||
    leaving ||
    deleting ||
    patchingPrefs ||
    savingSettings ||
    uploadingAvatar;

  const headerTitle =
    panel === "home"
      ? "Tùy chọn"
      : panel === "rename"
        ? "Thông tin nhóm"
        : panel === "add"
          ? "Thêm thành viên"
          : panel === "members"
            ? `Thành viên (${members.length})`
            : panel === "requests"
              ? "Duyệt thành viên"
              : panel === "settings"
                ? "Cài đặt nhóm"
                : panel === "media"
                  ? mediaTab === "media"
                    ? "Ảnh / Video"
                    : mediaTab === "file"
                      ? "File"
                      : "Link"
                  : panel === "bulletinFeed"
                    ? "Tin ghim & Bình chọn"
                    : panel === "tasks"
                      ? "Danh sách giao việc & nhắc hẹn"
                      : panel === "personal"
                        ? "Cài đặt cá nhân"
                        : "Chuyển quyền";

  const renderHome = () => (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Pressable
          onPress={() => void pickAvatar()}
          disabled={busy || !canEditGroupProfile}
          style={[styles.avatarWrap, !canEditGroupProfile && { opacity: 0.85 }]}
        >
          <Avatar
            uri={conversation.avatar || undefined}
            name={conversation.name || undefined}
            size="xl"
            isGroup
          />
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
            <Pencil size={20} color={Z.primary} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={styles.memberCountText}>{conversation.memberCount} thành viên</Text>
      </View>

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
              <BellOff size={20} color={Z.sub} strokeWidth={1.75} />
            ) : (
              <Bell size={20} color={Z.sub} strokeWidth={1.75} />
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
              size={20}
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
            <UserPlus size={20} color={Z.sub} strokeWidth={1.75} />
          </View>
          <Text style={styles.quickLabel}>Thêm thành{"\n"}viên</Text>
        </Pressable>
        <Pressable style={styles.quickCell} onPress={() => setPanel("settings")} disabled={busy}>
          <View style={styles.quickIcon}>
            <Settings size={20} color={Z.sub} strokeWidth={1.75} />
          </View>
          <Text style={styles.quickLabel}>Quản lý{"\n"}nhóm</Text>
        </Pressable>
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
          onPress={() => setPanel("members")}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          <Text style={styles.memberMgmtTitle}>Quản lý thành viên ({members.length})</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {joinRequests.length > 0 ? (
              <View style={styles.requestBadge}>
                <Text style={styles.requestBadgeText}>
                  {joinRequests.length > 99 ? "99+" : joinRequests.length}
                </Text>
              </View>
            ) : null}
            <ChevronRight size={18} color={Z.sub} />
          </View>
        </Pressable>
      </View>

      <View style={styles.bulletinOuter}>
        <Pressable
          style={styles.bulletinHeader}
          onPress={() => setBulletinExpanded((v) => !v)}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          <View
            style={{
              transform: [{ rotate: bulletinExpanded ? "0deg" : "-90deg" }],
            }}
          >
            <ChevronDown size={18} color={Z.sub} strokeWidth={2} />
          </View>
          <Text style={styles.bulletinHeaderTitle}>Bảng tin nhóm</Text>
        </Pressable>
        {bulletinExpanded ? (
          <View style={styles.bulletinBody}>
            <Pressable
              style={styles.bulletinRow}
              onPress={() => setPanel("tasks")}
              android_ripple={{ color: "rgba(0,0,0,0.04)" }}
            >
              <Clock size={18} color={Z.sub} strokeWidth={1.75} />
              <Text style={[styles.bulletinRowLabel, { flex: 1, marginLeft: 12 }]}>
                Danh sách giao việc & nhắc hẹn
              </Text>
              <ChevronRight size={16} color={Z.sub} />
            </Pressable>
            <Pressable
              style={styles.bulletinRow}
              onPress={() => {
                setBulletinNotesTab("all");
                setPanel("bulletinFeed");
              }}
              android_ripple={{ color: "rgba(0,0,0,0.04)" }}
            >
              <FileText size={18} color={Z.sub} strokeWidth={1.75} />
              <Text style={[styles.bulletinRowLabel, { flex: 1, marginLeft: 12 }]}>
                Tin ghim & Bình chọn
              </Text>
              <ChevronRight size={16} color={Z.sub} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <MenuBlock
        onPress={() => {
          setMediaTab("media");
          setPanel("media");
        }}
        icon={<ImageIcon size={22} color={Z.text} strokeWidth={1.75} />}
        label="Ảnh / Video"
      />
      <MenuBlock
        onPress={() => {
          setMediaTab("file");
          setPanel("media");
        }}
        icon={<FileText size={22} color={Z.text} strokeWidth={1.75} />}
        label="File"
      />
      <MenuBlock
        onPress={() => {
          setMediaTab("link");
          setPanel("media");
        }}
        icon={<Link2 size={22} color={Z.text} strokeWidth={1.75} />}
        label="Link"
      />

      <Pressable
        style={styles.linkBlock}
        onPress={async () => {
          if (!joinUrl) {
            toast.warning("Chưa có link nhóm. Quản trị có thể bật trong Cài đặt nhóm");
            return;
          }
          await Clipboard.setStringAsync(joinUrl);
          toast.success("Đã sao chép link nhóm");
        }}
      >
        <Link2 size={22} color={Z.text} strokeWidth={1.75} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.menuLabel}>Link nhóm</Text>
          <Text style={styles.linkSub} numberOfLines={2}>
            {joinUrl || "—"}
          </Text>
        </View>
        <ChevronRight size={18} color={Z.sub} />
      </Pressable>

      <MenuBlock
        onPress={() => setPanel("personal")}
        icon={<User size={22} color={Z.text} strokeWidth={1.75} />}
        label="Cài đặt cá nhân"
      />

      <View style={styles.divider} />

      {isOwner ? (
        <MenuBlock
          onPress={() => setPanel("transferOwner")}
          icon={<UserCog size={22} color={Z.text} strokeWidth={1.75} />}
          label="Chuyển quyền trưởng nhóm"
        />
      ) : null}

      <Pressable style={styles.destructRow} onPress={handleLeavePress} disabled={busy}>
        {leaving ? (
          <ActivityIndicator color={Z.red} />
        ) : (
          <>
            <LogOut size={22} color={Z.red} strokeWidth={1.75} />
            <Text style={styles.destructText}>Rời nhóm</Text>
          </>
        )}
      </Pressable>

      {isOwner ? (
        <Pressable style={styles.destructRow} onPress={handleDeleteGroup} disabled={busy}>
          {deleting ? (
            <ActivityIndicator color={Z.red} />
          ) : (
            <>
              <Trash2 size={22} color={Z.red} strokeWidth={1.75} />
              <Text style={styles.destructText}>Giải tán nhóm</Text>
            </>
          )}
        </Pressable>
      ) : null}

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
          <Avatar
            uri={conversation.avatar || undefined}
            name={conversation.name || undefined}
            size="xl"
            isGroup
          />
          {canEditGroupProfile ? (
            <View style={styles.camBadge}>
              <Camera size={16} color="#fff" strokeWidth={2} />
            </View>
          ) : null}
        </Pressable>
        <Text style={[styles.help, { textAlign: "center", marginTop: 10, paddingHorizontal: 8 }]}>
          {canEditGroupProfile
            ? "Chạm ảnh để đổi ảnh đại diện nhóm"
            : "Nhóm không cho phép thành viên đổi tên hoặc ảnh đại diện. Chỉ trưởng nhóm hoặc quản trị có thể chỉnh sửa."}
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

  const renderAdd = () => (
    <View style={{ flex: 1 }}>
      <View style={[styles.panelPad, { paddingBottom: 8 }]}>
        <View style={styles.addMemberNotice}>
          <Text style={styles.addMemberNoticeText}>
            Chọn từ bạn bè đã kết bạn — không nhập mã ID. Chỉ hiện người chưa có trong nhóm.
          </Text>
        </View>
        <Text style={styles.help}>Chọn từ danh sách bạn bè (chưa có trong nhóm).</Text>
        <View style={styles.addFriendSearchWrap}>
          <Search size={18} color={Z.sub} strokeWidth={2} />
          <TextInput
            value={addFriendFilter}
            onChangeText={setAddFriendFilter}
            placeholder="Tìm theo tên..."
            placeholderTextColor={Z.sub}
            style={styles.addFriendSearchInput}
            editable={!busy}
          />
        </View>
      </View>
      {loadingFriendsForInvite ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={Z.primary} />
      ) : (
        <FlatList
          data={friendsToInvite}
          keyExtractor={(f) => f.userId}
          style={{ flex: 1 }}
          extraData={selectedInviteFriendIds.size}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 8 }}
          ListEmptyComponent={
            <Text
              style={[styles.help, { textAlign: "center", marginTop: 24, paddingHorizontal: 16 }]}
            >
              {friends.length === 0
                ? "Chưa có bạn bè trong danh sách."
                : "Không còn bạn nào để mời hoặc không khớp tìm kiếm."}
            </Text>
          }
          renderItem={({ item: f }) => {
            const on = selectedInviteFriendIds.has(f.userId);
            return (
              <Pressable
                style={[styles.memberRow, on ? { backgroundColor: "#EFF6FF" } : null]}
                onPress={() => toggleInviteFriend(f.userId)}
                disabled={busy}
              >
                <Avatar uri={f.avatar || undefined} name={f.displayName} size="sm" />
                <Text style={[styles.menuLabel, { flex: 1, marginLeft: 12 }]} numberOfLines={1}>
                  {f.displayName}
                </Text>
                <View style={[styles.inviteCheckBox, on ? styles.inviteCheckBoxOn : null]}>
                  {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
      <View
        style={[
          styles.panelPad,
          {
            paddingTop: 12,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: Z.line,
          },
        ]}
      >
        <Pressable
          style={styles.primaryBtn}
          onPress={() => void handleAddMembers()}
          disabled={busy}
        >
          {adding ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Gửi lời mời</Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  const kickGloballyDisabled = members.length <= MIN_GROUP_MEMBERS;

  const renderMembers = () => (
    <View style={{ flex: 1 }}>
      {isFetching ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={Z.primary} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.userId}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 }}>
              {canManageMembers && joinRequests.length > 0 ? (
                <Pressable
                  onPress={() => setPanel("requests")}
                  android_ripple={{ color: "rgba(0,104,255,0.08)" }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    marginBottom: 12,
                    borderRadius: 12,
                    backgroundColor: Z.subBg,
                  }}
                >
                  <UserPlus size={20} color={Z.primary} strokeWidth={1.85} />
                  <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: Z.text }}>
                    Yêu cầu vào nhóm
                  </Text>
                  <View style={styles.requestBadge}>
                    <Text style={styles.requestBadgeText}>
                      {joinRequests.length > 99 ? "99+" : joinRequests.length}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={Z.sub} />
                </Pressable>
              ) : null}
              {canManageMembers ? (
                <Text style={styles.help}>
                  {kickGloballyDisabled
                    ? `Nhóm hiện có ${members.length} người — cần ít nhất ${MIN_GROUP_MEMBERS + 1} người thì mới mời được một người ra (để nhóm còn tối thiểu ${MIN_GROUP_MEMBERS} người).`
                    : "Chạm «Mời ra» để xóa thành viên khỏi nhóm (không áp dụng cho trưởng nhóm)."}
                </Text>
              ) : (
                <Text style={styles.help}>
                  Chỉ trưởng nhóm hoặc quản trị mới thấy nút mời người ra.
                </Text>
              )}
            </View>
          }
          renderItem={({ item: m }) => (
            <View style={styles.memberRow}>
              <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
              <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                <Text style={styles.menuLabel} numberOfLines={1}>
                  {m.displayName}
                </Text>
                <Text style={styles.subSmall}>{roleLabel(m.role)}</Text>
              </View>
              {canManageMembers &&
              Boolean(effectiveUserId) &&
              m.userId !== effectiveUserId &&
              m.role !== "owner" ? (
                <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 2 }}>
                  {isOwner ? (
                    <Pressable onPress={() => pickNewRole(m)} style={styles.iconBtn} hitSlop={6}>
                      <Shield size={18} color={Z.text} strokeWidth={1.75} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => {
                      if (kickGloballyDisabled) {
                        toast.warning(
                          `Nhóm phải còn tối thiểu ${MIN_GROUP_MEMBERS} người — không thể mời thêm ai ra (hiện ${members.length} người).`,
                        );
                        return;
                      }
                      confirmRemove(m);
                    }}
                    style={[styles.kickOutBtn, kickGloballyDisabled ? { opacity: 0.45 } : null]}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Trash2 size={17} color={Z.red} strokeWidth={2} />
                    <Text style={styles.kickOutBtnText}>Mời ra</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );

  const renderRequests = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        data={joinRequests}
        keyExtractor={(r) => r.userId}
        ListEmptyComponent={
          <Text style={[styles.help, { textAlign: "center", marginTop: 24 }]}>
            Không có yêu cầu chờ.
          </Text>
        }
        renderItem={({ item: r }) => (
          <View style={styles.memberRow}>
            <Avatar uri={r.avatar || undefined} name={r.name} size="sm" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.menuLabel}>{r.name}</Text>
              {r.status ? <Text style={styles.subSmall}>{r.status}</Text> : null}
            </View>
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
              style={[styles.miniBtn, { marginRight: 8 }]}
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
        )}
      />
    </View>
  );

  const renderSettings = () => {
    if (!settings) {
      return (
        <View style={styles.panelPad}>
          <ActivityIndicator color={Z.primary} />
        </View>
      );
    }
    const mp = settings.memberPermissions;
    const ad = settings.adminSettings;
    const settingsLocked = savingSettings || !canEditGroupSettings;
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 32 }}>
        {!canEditGroupSettings ? (
          <Text style={[styles.help, { paddingHorizontal: 16, paddingTop: 8 }]}>
            Bạn có thể xem cài đặt nhóm. Chỉ trưởng nhóm hoặc quản trị mới chỉnh được các tùy chọn
            bên dưới.
          </Text>
        ) : null}
        <Text style={styles.sectionCap}>Quyền thành viên</Text>
        <ToggleRow
          label="Đổi tên & ảnh nhóm"
          value={mp.changeNameAvatar}
          onValueChange={(v) => void patchSettingMember("changeNameAvatar", v)}
          disabled={settingsLocked}
        />
        <ToggleRow
          label="Ghim tin, bình chọn…"
          value={mp.pinMessages}
          onValueChange={(v) => void patchSettingMember("pinMessages", v)}
          disabled={settingsLocked}
        />
        <ToggleRow
          label="Ghi chú, nhắc hẹn"
          value={mp.createNotesReminders}
          onValueChange={(v) => void patchSettingMember("createNotesReminders", v)}
          disabled={settingsLocked}
        />
        <ToggleRow
          label="Tạo bình chọn"
          value={mp.createPolls}
          onValueChange={(v) => void patchSettingMember("createPolls", v)}
          disabled={settingsLocked}
        />
        <ToggleRow
          label="Gửi tin nhắn"
          value={mp.sendMessages}
          onValueChange={(v) => void patchSettingMember("sendMessages", v)}
          disabled={settingsLocked}
        />

        <Text style={[styles.sectionCap, { marginTop: 16 }]}>Quản trị</Text>
        <ToggleRow
          label="Duyệt thành viên mới"
          value={ad.approvalRequired}
          onValueChange={(v) => void patchSettingAdmin("approvalRequired", v)}
          disabled={settingsLocked}
        />
        <ToggleRow
          label="Nổi bật tin trưởng nhóm"
          value={ad.highlightLeaderMessages}
          onValueChange={(v) => void patchSettingAdmin("highlightLeaderMessages", v)}
          disabled={settingsLocked}
        />
        <ToggleRow
          label="Link tham gia nhóm"
          value={ad.allowJoinLink}
          onValueChange={(v) => void patchSettingAdmin("allowJoinLink", v)}
          disabled={settingsLocked}
        />

        <Pressable
          style={[
            styles.primaryBtn,
            { marginHorizontal: 16, marginTop: 16 },
            settingsLocked && { opacity: 0.45 },
          ]}
          onPress={() => {
            void (async () => {
              try {
                await updateSettings({ groupId, regenerateJoinLink: true }).unwrap();
                void refetchSettings();
                toast.success("Link nhóm đã được làm mới");
              } catch {
                toast.error("Không tạo được link mới");
              }
            })();
          }}
          disabled={settingsLocked}
        >
          <Text style={styles.primaryBtnText}>Tạo lại link nhóm</Text>
        </Pressable>
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
    return pinnedList.map((m) => {
      const who = String(m.senderDisplayName ?? "").trim() || "Thành viên";
      const when = formatBulletinFooterTime(m.createdAt);
      const rawContent = String(m.content ?? "").trim();
      const preview = rawContent.length > 180 ? `${rawContent.slice(0, 180)}…` : rawContent || "…";
      return (
        <Pressable
          key={m.messageId}
          onPress={() => jumpToPinnedMessage(m.messageId)}
          disabled={!onJumpToMessage}
          style={({ pressed }) => [
            styles.bulletinPinCard,
            pressed && onJumpToMessage ? { opacity: 0.92 } : null,
            !onJumpToMessage ? { opacity: 0.85 } : null,
          ]}
        >
          <View style={styles.bulletinPinCardTop}>
            <Pin size={18} color={Z.primary} strokeWidth={2} />
            <Text style={styles.bulletinPinWho} numberOfLines={1}>
              {who}
            </Text>
            <Text style={styles.bulletinPinWhen} numberOfLines={1}>
              {when || "—"}
            </Text>
          </View>
          <Text style={styles.bulletinPinPreview} numberOfLines={8}>
            {preview}
          </Text>
        </Pressable>
      );
    });
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

  /** Thẻ nhắc hẹn — cùng layout với thẻ bình chọn / tin ghim trong modal. */
  const renderTaskCards = (emptyHint: string) => {
    if (tasksList.length === 0) {
      return (
        <Text
          style={[styles.help, { textAlign: "center", paddingVertical: 28, paddingHorizontal: 16 }]}
        >
          {emptyHint}
        </Text>
      );
    }
    return tasksList.map((raw, idx) => {
      const t = taskSummary(raw);
      const key = t.id || `task-${idx}`;
      const dueObj = t.due ? new Date(t.due) : null;
      let dueLine = "";
      if (dueObj) {
        dueLine = dueObj.toLocaleString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        if (dueObj.getTime() < Date.now()) {
          dueLine = `Hết hạn: ${dueLine}`;
        } else {
          dueLine = `Hạn: ${dueLine}`;
        }
      }
      const overdue = dueLine.startsWith("Hết hạn");
      const statusTrim = t.status.trim();
      return (
        <Pressable
          key={key}
          style={({ pressed }) => [styles.bulletinPollCard, pressed ? { opacity: 0.92 } : null]}
          onPress={() => {
            setEditingTaskData(raw);
            setTaskModalOpen(true);
          }}
        >
          <View style={styles.bulletinPollCardTop}>
            <Clock size={18} color="#059669" strokeWidth={2} />
            <Text style={styles.bulletinPollTitle} numberOfLines={3}>
              {t.title}
            </Text>
          </View>
          {statusTrim ? (
            <Text style={styles.bulletinPollPreview} numberOfLines={2}>
              {statusTrim}
            </Text>
          ) : null}
          {dueLine ? (
            <Text style={[styles.bulletinPollMeta, overdue ? { color: Z.red } : null]}>
              {dueLine}
            </Text>
          ) : null}
        </Pressable>
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
      (pollsFetching || tasksFetching) &&
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
          {canCreatePollUi || canCreateTaskUi ? (
            <View style={{ marginTop: 16, gap: 10 }}>
              {canCreatePollUi ? (
                <Pressable
                  style={[styles.secondaryBtn, (!canCreatePollUi || busy) && { opacity: 0.45 }]}
                  onPress={() => setPollModalOpen(true)}
                  disabled={busy || !canCreatePollUi}
                >
                  <Text style={styles.secondaryBtnText}>Tạo bình chọn mới</Text>
                </Pressable>
              ) : null}
              {canCreateTaskUi ? (
                <Pressable
                  style={[styles.secondaryBtn, (!canCreateTaskUi || busy) && { opacity: 0.45 }]}
                  onPress={() => {
                    setEditingTaskData(null);
                    setTaskModalOpen(true);
                  }}
                  disabled={busy || !canCreateTaskUi}
                >
                  <Text style={styles.secondaryBtnText}>Tạo công việc / nhắc hẹn</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {!canCreatePollUi ? (
            <Text style={[styles.help, { marginTop: 14 }]}>
              Nhóm không cho phép thành viên tạo bình chọn.
            </Text>
          ) : null}
          {!canCreateTaskUi ? (
            <Text style={[styles.help, { marginTop: 8 }]}>
              Nhóm không cho phép thành viên tạo công việc / nhắc hẹn.
            </Text>
          ) : null}
        </ScrollView>
      </View>
    );
  };

  const renderTasks = () => {
    const showLoading = tasksFetching && tasksList.length === 0;
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
        ) : tasksList.length > 0 ? (
          <View style={{ paddingBottom: 8 }}>
            <Text style={styles.bulletinSectionCap}>NHẮC HẸN</Text>
            {renderTaskCards("")}
          </View>
        ) : (
          renderTaskCards("Chưa có nhắc hẹn hay công việc.")
        )}

        {tasksList.length > 0 ? (
          <Text style={[styles.help, { marginTop: 14 }]}>
            Có thể chạm vào công việc để xem chi tiết hoặc chỉnh sửa.
          </Text>
        ) : null}

        {!canCreateTaskUi ? (
          <Text style={[styles.help, { marginTop: 14 }]}>
            Nhóm không cho phép thành viên tạo công việc / nhắc hẹn.
          </Text>
        ) : null}
      </ScrollView>
    );
  };

  const renderMedia = () => {
    const w = Dimensions.get("window").width;
    const gap = 6;
    const pad = 12;
    const cell = (w - pad * 2 - gap * 2) / 3;

    const gridMessages = mediaMessages.filter((m) => {
      if (mediaTab === "media") return m.type === "image" || m.type === "video";
      return m.type === "file";
    });

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
              onPress={async () => {
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
            {mediaTab === "file" ? "Chưa có file được chia sẻ." : "Chưa có ảnh hoặc video."}
          </Text>
        }
        renderItem={({ item: m }) => {
          const uri = m.thumbnailUrl || m.mediaUrl;
          return (
            <View style={{ width: cell }}>
              {uri && (m.type === "image" || m.type === "video") ? (
                <Image source={{ uri }} style={{ width: cell, height: cell, borderRadius: 8 }} />
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
                    {m.type === "file" ? m.mediaOriginalName?.slice(0, 24) || "FILE" : "•"}
                  </Text>
                </View>
              )}
            </View>
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
              ) : null}
            </View>
          </View>

          <View style={styles.body}>
            {panel === "home" && renderHome()}
            {panel === "rename" && renderRename()}
            {panel === "add" && renderAdd()}
            {panel === "members" && renderMembers()}
            {panel === "requests" && renderRequests()}
            {panel === "settings" && renderSettings()}
            {panel === "bulletinFeed" && renderBulletinFeed()}
            {panel === "media" && renderMedia()}
            {panel === "transferOwner" && renderTransfer()}
            {panel === "tasks" && renderTasks()}
            {panel === "personal" && renderPersonal()}
          </View>
        </SafeAreaView>

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
    </>
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
      <View style={{ flex: 1, paddingRight: 8 }}>
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
  scroll: { flex: 1 },
  hero: { alignItems: "center", paddingTop: 12, paddingBottom: 8 },
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
  groupTitle: { fontSize: 20, fontWeight: "700", color: Z.text, flexShrink: 1 },
  memberCountText: {
    fontSize: 14,
    color: Z.sub,
    fontWeight: "600",
    marginTop: 6,
    textAlign: "center",
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  quickCell: { flex: 1, alignItems: "center", paddingVertical: 2, minWidth: 0 },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Z.subBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  quickLabel: { fontSize: 10, color: Z.text, textAlign: "center", lineHeight: 13 },
  aiBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: "#F5F3FF",
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Z.primary,
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
    paddingVertical: 14,
  },
  memberMgmtTitle: { fontSize: 15, fontWeight: "700", color: Z.text, flex: 1, marginRight: 8 },
  requestBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  requestBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bulletinOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  bulletinHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  bulletinHeaderTitle: { fontSize: 15, fontWeight: "700", color: Z.text },
  bulletinBody: { paddingBottom: 4 },
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
