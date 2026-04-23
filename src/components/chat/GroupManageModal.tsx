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
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckSquare,
  Check,
  Camera,
  BellOff,
  Bell,
  BarChart2,
  Search,
  Settings,
  Shield,
  Trash2,
  UserCog,
  User,
  UserPlus,
  Users,
} from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { MIN_GROUP_MEMBERS } from "@/constants/group";
import { env } from "@/config/env";
import { useAppSelector } from "@/hooks/useAppStore";
import type { IConversation, IGroupMember, IGroupSettings, MemberRole } from "@/types/chat.types";
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
  | "pinned"
  | "media"
  | "transferOwner"
  | "polls"
  | "tasks"
  | "personal";

type Panel = GroupManagePanel;

interface GroupManageModalProps {
  visible: boolean;
  onClose: () => void;
  conversation: IConversation;
  currentUserId?: string;
  /** Khi mở modal, nhảy thẳng tới tab (vd. từ thanh ghim → Chỉnh sửa). */
  initialPanel?: Panel;
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

export function GroupManageModal({
  visible,
  onClose,
  conversation,
  currentUserId,
  initialPanel,
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
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskData, setEditingTaskData] = useState<any>(null);
  const [muteNotifOpen, setMuteNotifOpen] = useState(false);
  const [muteNotifMode, setMuteNotifMode] = useState<"create" | "edit">("create");
  const [muteNotifSubmitting, setMuteNotifSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setPanel(initialPanel ?? "home");
      setEditName(conversation.name ?? "");
      setAddFriendFilter("");
      setPickOwnerForLeave(false);
      setPollModalOpen(false);
      setTaskModalOpen(false);
      setEditingTaskData(null);
      setMuteNotifOpen(false);
      setMuteNotifSubmitting(false);
    }
  }, [visible, conversation.name, initialPanel]);

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

  const { data: pollsEnvelope } = useGetPollsQuery(groupId, {
    skip: !visible,
  });

  const { data: tasksEnvelope } = useGetTasksQuery(groupId, {
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

  const pinnedList = useMemo(
    () => messages.filter((m) => m.isPinned && !m.isRecalled && !m.isDeleted),
    [messages],
  );

  const pollsList = useMemo(() => {
    const raw = pollsEnvelope?.data;
    return Array.isArray(raw) ? raw : [];
  }, [pollsEnvelope]);

  const tasksList = useMemo(() => {
    const raw = tasksEnvelope?.data;
    return Array.isArray(raw) ? raw : [];
  }, [tasksEnvelope]);

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
                : panel === "pinned"
                  ? "Tin đã ghim"
                  : panel === "media"
                    ? "Ảnh, file, link"
                    : panel === "polls"
                      ? "Bình chọn"
                      : panel === "tasks"
                        ? "Công việc"
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
      </View>

      <View style={styles.quickRow}>
        <Pressable style={styles.quickCell} onPress={() => setPanel("add")}>
          <View style={styles.quickIcon}>
            <UserPlus size={22} color={Z.primary} strokeWidth={1.75} />
          </View>
          <Text style={styles.quickLabel}>Thêm thành viên</Text>
        </Pressable>
        <Pressable style={styles.quickCell} onPress={() => void toggleMuted(!isMuted)}>
          <View style={styles.quickIcon}>
            {isMuted ? (
              <BellOff size={22} color={Z.primary} strokeWidth={1.75} />
            ) : (
              <Bell size={22} color={Z.primary} strokeWidth={1.75} />
            )}
          </View>
          <Text style={styles.quickLabel}>{isMuted ? "Bật thông báo" : "Tắt thông báo"}</Text>
        </Pressable>
      </View>

      <View style={styles.mediaSection}>
        <View style={styles.mediaHeader}>
          <ImageIcon size={18} color={Z.text} strokeWidth={1.75} />
          <Text style={styles.mediaTitle}>Ảnh, file, link</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mediaStrip}
        >
          {mediaMessages.slice(0, 12).map((m) => {
            const uri = m.thumbnailUrl || m.mediaUrl || undefined;
            return (
              <Pressable
                key={m.messageId}
                onPress={() => setPanel("media")}
                style={styles.thumbBox}
              >
                {uri && (m.type === "image" || m.type === "video") ? (
                  <Image source={{ uri }} style={styles.thumbImg} />
                ) : (
                  <View style={[styles.thumbImg, styles.thumbPlaceholder]}>
                    <Text style={{ fontSize: 11, color: Z.sub }}>
                      {m.type === "file" ? "FILE" : "•"}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Pressable onPress={() => setPanel("media")} style={styles.thumbMore}>
            <ChevronRight size={22} color={Z.primary} />
          </Pressable>
        </ScrollView>
      </View>

      <MenuBlock
        onPress={() => setPanel("pinned")}
        icon={<Pin size={22} color={Z.text} strokeWidth={1.75} />}
        label="Tin nhắn đã ghim"
        sub={pinnedList.length ? `${pinnedList.length} tin` : undefined}
      />
      <MenuBlock
        onPress={() => setPanel("tasks")}
        icon={<CheckSquare size={22} color={Z.text} strokeWidth={1.75} />}
        label="Công việc & nhắc hẹn"
        sub={tasksList.length ? `${tasksList.length} việc` : undefined}
      />
      <MenuBlock
        onPress={() => setPanel("polls")}
        icon={<BarChart2 size={22} color={Z.text} strokeWidth={1.75} />}
        label="Bình chọn"
        sub={pollsList.length ? `${pollsList.length} bình chọn` : undefined}
      />
      {canEditGroupSettings ? (
        <MenuBlock
          onPress={() => setPanel("settings")}
          icon={<Settings size={22} color={Z.text} strokeWidth={1.75} />}
          label="Cài đặt nhóm"
        />
      ) : null}
      <MenuBlock
        onPress={() => setPanel("members")}
        icon={<Users size={22} color={Z.text} strokeWidth={1.75} />}
        label={`Xem thành viên (${members.length})`}
      />

      <View style={styles.divider} />

      {canManageMembers ? (
        <MenuBlock
          onPress={() => setPanel("requests")}
          icon={<UserCog size={22} color={Z.text} strokeWidth={1.75} />}
          label="Duyệt thành viên"
          sub={joinRequests.length ? `${joinRequests.length} yêu cầu` : undefined}
        />
      ) : null}

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

      <ToggleRow
        label="Ghim trò chuyện"
        value={isPinnedToTop}
        disabled={busy}
        onValueChange={(v) => void togglePinnedConv(v)}
      />
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
            canManageMembers ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 }}>
                <Text style={styles.help}>
                  {kickGloballyDisabled
                    ? `Nhóm hiện có ${members.length} người — cần ít nhất ${MIN_GROUP_MEMBERS + 1} người thì mới mời được một người ra (để nhóm còn tối thiểu ${MIN_GROUP_MEMBERS} người).`
                    : "Chạm «Mời ra» để xóa thành viên khỏi nhóm (không áp dụng cho trưởng nhóm)."}
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 4 }}>
                <Text style={styles.help}>
                  Chỉ trưởng nhóm hoặc quản trị mới thấy nút mời người ra.
                </Text>
              </View>
            )
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
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text style={styles.sectionCap}>Quyền thành viên</Text>
        <ToggleRow
          label="Đổi tên & ảnh nhóm"
          value={mp.changeNameAvatar}
          onValueChange={(v) => void patchSettingMember("changeNameAvatar", v)}
          disabled={savingSettings}
        />
        <ToggleRow
          label="Ghim tin, bình chọn…"
          value={mp.pinMessages}
          onValueChange={(v) => void patchSettingMember("pinMessages", v)}
          disabled={savingSettings}
        />
        <ToggleRow
          label="Ghi chú, nhắc hẹn"
          value={mp.createNotesReminders}
          onValueChange={(v) => void patchSettingMember("createNotesReminders", v)}
          disabled={savingSettings}
        />
        <ToggleRow
          label="Tạo bình chọn"
          value={mp.createPolls}
          onValueChange={(v) => void patchSettingMember("createPolls", v)}
          disabled={savingSettings}
        />
        <ToggleRow
          label="Gửi tin nhắn"
          value={mp.sendMessages}
          onValueChange={(v) => void patchSettingMember("sendMessages", v)}
          disabled={savingSettings}
        />

        <Text style={[styles.sectionCap, { marginTop: 16 }]}>Quản trị</Text>
        <ToggleRow
          label="Duyệt thành viên mới"
          value={ad.approvalRequired}
          onValueChange={(v) => void patchSettingAdmin("approvalRequired", v)}
          disabled={savingSettings}
        />
        <ToggleRow
          label="Nổi bật tin trưởng nhóm"
          value={ad.highlightLeaderMessages}
          onValueChange={(v) => void patchSettingAdmin("highlightLeaderMessages", v)}
          disabled={savingSettings}
        />
        <ToggleRow
          label="Link tham gia nhóm"
          value={ad.allowJoinLink}
          onValueChange={(v) => void patchSettingAdmin("allowJoinLink", v)}
          disabled={savingSettings}
        />

        <Pressable
          style={[styles.primaryBtn, { marginHorizontal: 16, marginTop: 16 }]}
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
        >
          <Text style={styles.primaryBtnText}>Tạo lại link nhóm</Text>
        </Pressable>
      </ScrollView>
    );
  };

  const renderPinned = () => (
    <View style={{ flex: 1 }}>
      <FlatList
        data={pinnedList}
        keyExtractor={(m) => m.messageId}
        ListEmptyComponent={
          <Text style={[styles.help, { textAlign: "center", marginTop: 24 }]}>
            Chưa có tin ghim.
          </Text>
        }
        renderItem={({ item: m }) => (
          <View style={styles.searchRow}>
            <Text style={styles.menuLabel} numberOfLines={2}>
              {m.content || `[${m.type}]`}
            </Text>
            <Text style={styles.subSmall}>{new Date(m.createdAt).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );

  const renderTasks = () => (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.sectionCap}>Danh sách</Text>
      {tasksList.length === 0 ? (
        <Text style={[styles.help, { paddingHorizontal: 16 }]}>Chưa có công việc.</Text>
      ) : (
        tasksList.map((raw, idx) => {
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
          const subLine = [t.status, dueLine].filter(Boolean).join(" · ");
          return (
            <Pressable
              key={key}
              style={styles.searchRow}
              onPress={() => {
                setEditingTaskData(raw);
                setTaskModalOpen(true);
              }}
            >
              <Text style={styles.menuLabel} numberOfLines={2}>
                {t.title}
              </Text>
              {subLine ? (
                <Text
                  style={[
                    styles.subSmall,
                    dueLine.includes("Hết hạn")
                      ? { color: "#DC2626", fontWeight: "600" }
                      : undefined,
                  ]}
                >
                  {subLine}
                </Text>
              ) : null}
            </Pressable>
          );
        })
      )}

      {tasksList.length > 0 ? (
        <Text style={[styles.help, { paddingHorizontal: 16, marginTop: 12 }]}>
          Có thể chạm vào công việc để xem chi tiết hoặc chỉnh sửa.
        </Text>
      ) : null}

      {!canCreateTaskUi ? (
        <Text style={[styles.help, { paddingHorizontal: 16, marginTop: 12 }]}>
          Nhóm không cho phép thành viên tạo công việc / nhắc hẹn.
        </Text>
      ) : null}
      <Pressable
        style={[
          styles.primaryBtn,
          { marginHorizontal: 16, marginTop: 12 },
          (!canCreateTaskUi || busy) && { opacity: 0.45 },
        ]}
        onPress={() => {
          setEditingTaskData(null);
          setTaskModalOpen(true);
        }}
        disabled={busy || !canCreateTaskUi}
      >
        <Text style={styles.primaryBtnText}>Tạo công việc / nhắc hẹn</Text>
      </Pressable>
    </ScrollView>
  );

  const renderMedia = () => {
    const w = Dimensions.get("window").width;
    const gap = 6;
    const pad = 12;
    const cell = (w - pad * 2 - gap * 2) / 3;
    return (
      <FlatList
        data={mediaMessages}
        keyExtractor={(m) => m.messageId}
        numColumns={3}
        columnWrapperStyle={{ gap, paddingHorizontal: pad, marginBottom: gap }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
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
                  <Text style={{ color: Z.sub, fontSize: 11 }}>{m.type}</Text>
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

  const renderPolls = () => (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 32 }}
    >
      <Text style={styles.sectionCap}>Danh sách</Text>
      {pollsList.length === 0 ? (
        <Text style={[styles.help, { paddingHorizontal: 16 }]}>Chưa có bình chọn.</Text>
      ) : (
        pollsList.map((raw, idx) => {
          const p = pollSummary(raw);
          const key = p.id || `poll-${idx}`;
          return (
            <View key={key} style={styles.searchRow}>
              <Text style={styles.menuLabel} numberOfLines={2}>
                {p.title}
              </Text>
              <Text style={styles.subSmall}>{p.closed ? "Đã đóng" : "Đang mở"}</Text>
            </View>
          );
        })
      )}

      {!canCreatePollUi ? (
        <Text style={[styles.help, { paddingHorizontal: 16, marginTop: 12 }]}>
          Nhóm không cho phép thành viên tạo bình chọn.
        </Text>
      ) : null}
      <Pressable
        style={[
          styles.primaryBtn,
          { marginHorizontal: 16, marginTop: 12 },
          (!canCreatePollUi || busy) && { opacity: 0.45 },
        ]}
        onPress={() => setPollModalOpen(true)}
        disabled={busy || !canCreatePollUi}
      >
        <Text style={styles.primaryBtnText}>Tạo bình chọn mới</Text>
      </Pressable>
    </ScrollView>
  );

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
            <Pressable onPress={handleBack} style={styles.backBtn} hitSlop={12}>
              <ChevronLeft size={28} color={Z.text} strokeWidth={1.75} />
            </Pressable>
            <Text style={styles.topTitle}>{headerTitle}</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.body}>
            {panel === "home" && renderHome()}
            {panel === "rename" && renderRename()}
            {panel === "add" && renderAdd()}
            {panel === "members" && renderMembers()}
            {panel === "requests" && renderRequests()}
            {panel === "settings" && renderSettings()}
            {panel === "pinned" && renderPinned()}
            {panel === "media" && renderMedia()}
            {panel === "transferOwner" && renderTransfer()}
            {panel === "tasks" && renderTasks()}
            {panel === "polls" && renderPolls()}
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
  topTitle: { fontSize: 17, fontWeight: "700", color: Z.text },
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
  quickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  quickCell: { flex: 1, alignItems: "center", paddingVertical: 4 },
  quickIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Z.subBg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLabel: { fontSize: 11, color: Z.text, textAlign: "center" },
  mediaSection: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  mediaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  mediaTitle: { fontSize: 15, fontWeight: "600", color: Z.text },
  mediaStrip: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  thumbBox: { width: 64, height: 64, borderRadius: 8, overflow: "hidden" },
  thumbImg: { width: 64, height: 64, borderRadius: 8 },
  thumbPlaceholder: { backgroundColor: Z.subBg, alignItems: "center", justifyContent: "center" },
  thumbMore: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Z.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Z.subBg,
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
