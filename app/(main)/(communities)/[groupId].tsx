import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  BookOpen,
  Camera,
  Crown,
  FileText,
  Lock,
  MoreVertical,
  Pencil,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserMinus,
  UserX,
} from "lucide-react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";

import { FeedPostCard } from "@/features/newsfeed/components/FeedPostCard";
import { Avatar } from "@/components/common/Avatar";
import { useIconColors } from "@/hooks/useIconColors";
import { usePostMultipleUsersMutation, type FriendListItem } from "@/store/api/userApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import {
  useArchiveCommunityMutation,
  useGetCommunityMembersQuery,
  useGetCommunityPostsQuery,
  useGetCommunityQuery,
  useGetCommunityRequestsQuery,
  useJoinCommunityMutation,
  useLeaveCommunityMutation,
  useRemoveCommunityMemberMutation,
  useResolveCommunityRequestMutation,
  useTransferCommunityOwnerMutation,
  useUpdateCommunityMemberRoleMutation,
  useUpdateCommunityMutation,
} from "@/store/api/communityApi";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type CommunityMemberRole,
  type ICommunity,
  type ICommunityJoinRequest,
  type ICommunityMember,
} from "@/types/community.types";
import type { IPost } from "@/types/newsfeed.types";
import { toast } from "@/utils/appToast";
const defaultAvatarGroup = require("../../../assets/images/avatar-group-default..jpg");
const defaultCoverGroup = require("../../../assets/images/cover-group-default..jpg");

const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  general: "Chung",
  technology: "Công nghệ",
  sports: "Thể thao",
  music: "Nhạc",
  education: "Giáo dục",
  gaming: "Gaming",
  lifestyle: "Đời sống",
};

const ROLE_LABEL: Record<CommunityMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  moderator: "Mod",
  member: "Member",
};

const TABS = ["posts", "members", "about"] as const;
type TabKey = (typeof TABS)[number];

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function canManage(role?: CommunityMemberRole | null): boolean {
  return role === "owner" || role === "admin" || role === "moderator";
}

function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full px-3 py-2 active:opacity-80 ${active ? "bg-primary" : "bg-transparent"}`}
    >
      <Text
        className={
          active
            ? "text-center font-semibold text-primary-foreground"
            : "text-center font-semibold text-muted-foreground"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="flex-1 rounded-2xl bg-muted/60 px-3 py-3">
      <Text className="text-lg font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-xl py-3 pl-0.5 pr-2 active:bg-muted/50"
    >
      <View
        className={`size-10 items-center justify-center rounded-full ${destructive ? "bg-destructive/10" : "bg-muted/60"}`}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${destructive ? "text-destructive" : "text-foreground"}`}
        >
          {label}
        </Text>
        <Text className="mt-0.5 text-[12px] leading-snug text-muted-foreground" numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

function EditCommunityModal({
  community,
  open,
  onClose,
}: {
  community: ICommunity;
  open: boolean;
  onClose: () => void;
}) {
  const { primary, muted } = useIconColors();
  const [updateCommunity, { isLoading }] = useUpdateCommunityMutation();
  const [uploadMedia] = useUploadMediaMutation();

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [category, setCategory] = useState<CommunityCategory>(community.category);

  // Avatar & Cover states
  const [avatar, setAvatar] = useState(community.avatar ?? "");
  const [coverUrl, setCoverUrl] = useState(community.coverUrl ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (open) {
      setName(community.name);
      setDescription(community.description ?? "");
      setCategory(community.category);
      setAvatar(community.avatar ?? "");
      setCoverUrl(community.coverUrl ?? "");
    }
  }, [community, open]);

  const pickImage = async (target: "avatar" | "cover") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Cần quyền thư viện ảnh");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];

    if (target === "avatar") setUploadingAvatar(true);
    else setUploadingCover(true);

    try {
      const file = await prepareLocalFileForUpload({
        uri: asset.uri,
        name: asset.fileName ?? `${target}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      const up = await uploadMedia({
        file: { uri: file.uri, name: file.name, type: file.type },
        mediaType: "image",
      }).unwrap();
      const url = up.url?.trim();
      if (url) {
        if (target === "avatar") {
          setAvatar(url);
          toast.success("Đã tải ảnh đại diện lên");
        } else {
          setCoverUrl(url);
          toast.success("Đã tải ảnh bìa lên");
        }
      }
    } catch {
      toast.error("Không tải được ảnh");
    } finally {
      if (target === "avatar") setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!name.trim()) return;
    try {
      await updateCommunity({
        groupId: community.groupId,
        body: {
          name: name.trim(),
          description: description.trim() || null,
          avatar: avatar.trim() || null,
          coverUrl: coverUrl.trim() || null,
          category,
          type: community.type,
          joinPolicy: community.joinPolicy,
          rules: community.rules,
        },
      }).unwrap();
      toast.success("Đã cập nhật cộng đồng");
      onClose();
    } catch {
      toast.error("Không cập nhật được cộng đồng");
    }
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="font-semibold text-foreground">Hủy</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Chỉnh sửa</Text>
          <Pressable
            disabled={isLoading || !name.trim()}
            onPress={() => void submit()}
            className="rounded-xl bg-primary px-3 py-2 active:opacity-80 disabled:opacity-50"
          >
            <Text className="font-semibold text-primary-foreground">Lưu</Text>
          </Pressable>
        </View>
        <FlatList
          data={[0]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={() => (
            <View className="gap-4">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tên cộng đồng"
                placeholderTextColor={muted}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả"
                placeholderTextColor={muted}
                multiline
                className="min-h-28 rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
              />

              <View className="gap-2">
                <Text className="font-semibold text-foreground">Hình ảnh cộng đồng</Text>
                <View className="relative w-full" style={{ height: 160 }}>
                  {/* Cover Container */}
                  <View className="h-full w-full overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30">
                    <Pressable
                      onPress={() => void pickImage("cover")}
                      disabled={uploadingCover}
                      className="size-full items-center justify-center"
                    >
                      {coverUrl ? (
                        <Image source={{ uri: coverUrl }} className="size-full" />
                      ) : (
                        <View className="items-center gap-1.5">
                          {uploadingCover ? (
                            <ActivityIndicator color={primary} size="small" />
                          ) : (
                            <>
                              <Camera size={22} color={muted} />
                              <Text className="text-xs font-semibold text-muted-foreground">
                                Tải lên ảnh bìa
                              </Text>
                            </>
                          )}
                        </View>
                      )}
                    </Pressable>
                  </View>

                  {/* Avatar Container */}
                  <View
                    className="absolute -bottom-8 left-4 size-20 overflow-hidden rounded-full border-4 border-background bg-card shadow-lg"
                    style={{
                      elevation: 5,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 3,
                    }}
                  >
                    <Pressable
                      onPress={() => void pickImage("avatar")}
                      disabled={uploadingAvatar}
                      className="size-full items-center justify-center"
                    >
                      {avatar ? (
                        <Image source={{ uri: avatar }} className="size-full" />
                      ) : (
                        <View className="size-full items-center justify-center bg-primary/10">
                          {uploadingAvatar ? (
                            <ActivityIndicator color={primary} size="small" />
                          ) : (
                            <Camera size={18} color={primary} />
                          )}
                        </View>
                      )}
                    </Pressable>
                  </View>
                </View>
                <View style={{ height: 32 }} />
              </View>

              <Text className="font-semibold text-foreground">Chủ đề</Text>
              <View className="flex-row flex-wrap gap-2">
                {COMMUNITY_CATEGORIES.map((item) => {
                  const active = category === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      className={`rounded-full border px-4 py-2 active:opacity-80 ${
                        active ? "border-primary bg-primary" : "border-border bg-card"
                      }`}
                    >
                      <Text
                        className={
                          active
                            ? "font-semibold text-primary-foreground"
                            : "font-semibold text-foreground"
                        }
                      >
                        {CATEGORY_LABEL[item]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

export default function CommunityDetailScreen() {
  const { primary, foreground, muted, destructive } = useIconColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [tab, setTab] = useState<TabKey>("posts");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ICommunityMember | null>(null);

  const groupMenuSheetRef = useRef<BottomSheet>(null);
  const memberManageSheetRef = useRef<BottomSheet>(null);

  const { data: community, isLoading } = useGetCommunityQuery(groupId, { skip: !groupId });
  const { data: members } = useGetCommunityMembersQuery(groupId, { skip: !groupId });
  const { data: posts } = useGetCommunityPostsQuery({ groupId, limit: 20 }, { skip: !groupId });
  const manager = canManage(community?.viewerRole);
  const owner = community?.viewerRole === "owner";
  const { data: requests } = useGetCommunityRequestsQuery(groupId, { skip: !groupId || !manager });

  const [joinCommunity, { isLoading: joining }] = useJoinCommunityMutation();
  const [leaveCommunity] = useLeaveCommunityMutation();
  const [archiveCommunity] = useArchiveCommunityMutation();
  const [resolveRequest] = useResolveCommunityRequestMutation();
  const [removeMember] = useRemoveCommunityMemberMutation();
  const [updateRole] = useUpdateCommunityMemberRoleMutation();
  const [transferOwner] = useTransferCommunityOwnerMutation();

  const [profilesMap, setProfilesMap] = useState<Record<string, FriendListItem>>({});
  const [postMultipleUsers] = usePostMultipleUsersMutation();

  const memberUserIds = members?.map((m) => m.userId) ?? [];
  const requestUserIds = requests?.map((r) => r.userId) ?? [];
  const allUserIds = useMemo(
    () => Array.from(new Set([...memberUserIds, ...requestUserIds])),
    [memberUserIds, requestUserIds],
  );

  useEffect(() => {
    const missingIds = allUserIds.filter((id) => !profilesMap[id]);
    if (missingIds.length > 0) {
      postMultipleUsers({ userIds: missingIds })
        .unwrap()
        .then((users) => {
          if (users && users.length > 0) {
            setProfilesMap((prev) => {
              const next = { ...prev };
              users.forEach((u) => {
                next[u.userId] = u;
              });
              return next;
            });
          }
        })
        .catch((err) => {
          console.error("Batch fetch members error:", err);
        });
    }
  }, [allUserIds, postMultipleUsers]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const menuSnapPoints = useMemo(() => ["35%"], []);
  const memberSnapPoints = useMemo(() => ["50%"], []);

  if (isLoading || !community) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Đang tải cộng đồng...</Text>
      </SafeAreaView>
    );
  }

  const isMember = community.viewerStatus === "active";

  const handleJoin = async (): Promise<void> => {
    try {
      const result = await joinCommunity({ groupId }).unwrap();
      toast.success(
        result.status === "requested" ? "Đã gửi yêu cầu tham gia" : "Đã tham gia cộng đồng",
      );
    } catch {
      toast.error("Không thể tham gia cộng đồng");
    }
  };

  const confirmLeave = (): void => {
    Alert.alert("Rời cộng đồng?", "Bạn sẽ mất quyền đăng bài trong cộng đồng này.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Rời",
        style: "destructive",
        onPress: () => {
          void leaveCommunity(groupId)
            .unwrap()
            .then(() => toast.success("Đã rời cộng đồng"))
            .catch(() => toast.error("Không thể rời cộng đồng"));
        },
      },
    ]);
  };

  const confirmArchive = (): void => {
    Alert.alert("Lưu trữ cộng đồng?", "Cộng đồng sẽ không còn xuất hiện trong discovery.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Lưu trữ",
        style: "destructive",
        onPress: () => {
          void archiveCommunity(groupId)
            .unwrap()
            .then(() => {
              toast.success("Đã lưu trữ cộng đồng");
              router.back();
            })
            .catch(() => toast.error("Không thể lưu trữ cộng đồng"));
        },
      },
    ]);
  };

  const handleUpdateRole = async (role: CommunityMemberRole) => {
    if (!selectedMember) return;
    try {
      memberManageSheetRef.current?.close();
      await updateRole({ groupId, userId: selectedMember.userId, role }).unwrap();
      toast.success(
        `Đã cập nhật quyền của ${profilesMap[selectedMember.userId]?.displayName || selectedMember.userId} thành ${ROLE_LABEL[role]}`,
      );
    } catch {
      toast.error("Không thể cập nhật quyền");
    }
  };

  const handleTransferOwner = async () => {
    if (!selectedMember) return;
    Alert.alert(
      "Chuyển quyền sở hữu?",
      `Bạn có chắc chắn muốn chuyển quyền chủ sở hữu cho ${profilesMap[selectedMember.userId]?.displayName || selectedMember.userId}? Bạn sẽ bị hạ cấp xuống thành viên thường.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Chuyển",
          style: "destructive",
          onPress: async () => {
            try {
              memberManageSheetRef.current?.close();
              await transferOwner({ groupId, targetUserId: selectedMember.userId }).unwrap();
              toast.success("Đã chuyển quyền chủ sở hữu thành công");
            } catch {
              toast.error("Không thể chuyển quyền chủ sở hữu");
            }
          },
        },
      ],
    );
  };

  const handleKickMember = () => {
    if (!selectedMember) return;
    const memberName = profilesMap[selectedMember.userId]?.displayName || selectedMember.userId;
    Alert.alert(
      "Trục xuất thành viên?",
      `Bạn có chắc chắn muốn xóa ${memberName} khỏi cộng đồng này?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Trục xuất",
          style: "destructive",
          onPress: async () => {
            try {
              memberManageSheetRef.current?.close();
              await removeMember({ groupId, userId: selectedMember.userId }).unwrap();
              toast.success(`Đã trục xuất ${memberName} khỏi cộng đồng`);
            } catch {
              toast.error("Không thể trục xuất thành viên");
            }
          },
        },
      ],
    );
  };

  const renderRequest = ({ item }: { item: ICommunityJoinRequest }) => {
    const profile = profilesMap[item.userId];
    const name = profile?.displayName || item.userId;
    const avatarUri = profile?.avatar;

    return (
      <View className="rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={name} size="md" />
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-card-foreground" numberOfLines={1}>
              {name}
            </Text>
            {profile && (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                @{item.userId}
              </Text>
            )}
          </View>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">
          {item.message || "Không có lời nhắn"}
        </Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => void resolveRequest({ groupId, userId: item.userId, action: "approve" })}
            className="rounded-full bg-primary px-4 py-2 active:opacity-80"
          >
            <Text className="font-semibold text-primary-foreground">Duyệt</Text>
          </Pressable>
          <Pressable
            onPress={() => void resolveRequest({ groupId, userId: item.userId, action: "reject" })}
            className="rounded-full bg-muted px-4 py-2 active:opacity-80"
          >
            <Text className="font-semibold text-foreground">Từ chối</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const renderMember = ({ item }: { item: ICommunityMember }) => {
    const profile = profilesMap[item.userId];
    const name = profile?.displayName || item.userId;
    const avatarUri = profile?.avatar;
    const isSelf = item.userId === community.ownerId;
    const showManage = manager && item.role !== "owner" && !isSelf;

    return (
      <Pressable
        onPress={() => {
          if (showManage) {
            setSelectedMember(item);
            memberManageSheetRef.current?.expand();
          }
        }}
        className="rounded-2xl border border-border bg-card p-4 active:bg-muted/30"
      >
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={name} size="md" />
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-card-foreground" numberOfLines={1}>
              {name}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {new Date(item.joinedAt).toLocaleDateString("vi-VN")}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            {item.role === "owner" && <Crown size={12} color={foreground} />}
            <Text className="text-[11px] font-semibold text-foreground">
              {ROLE_LABEL[item.role]}
            </Text>
          </View>
          {showManage && (
            <View className="rounded-full bg-muted/40 p-1">
              <MoreVertical size={16} color={muted} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 border-b border-border/40 px-4 py-3">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:opacity-70">
          <ArrowLeft size={22} color={foreground} />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-foreground" numberOfLines={1}>
          {community.name}
        </Text>
        {(owner || community.viewerRole === "admin") && (
          <Pressable
            onPress={() => setEditOpen(true)}
            className="rounded-full p-2 active:opacity-70"
          >
            <Pencil size={20} color={foreground} />
          </Pressable>
        )}
        <Pressable
          onPress={() => groupMenuSheetRef.current?.expand()}
          className="rounded-full p-2 active:opacity-70"
        >
          <MoreVertical size={20} color={foreground} />
        </Pressable>
      </View>

      {tab === "posts" && (
        <FlatList
          data={posts?.items ?? []}
          keyExtractor={(item: IPost) => item.postId}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={
            <CommunityHeader
              community={community}
              isMember={isMember}
              joining={joining}
              tab={tab}
              setTab={setTab}
              onJoin={() => void handleJoin()}
              onPost={() => router.push(`/(main)/(newsfeed)/editor/new?groupId=${groupId}`)}
            />
          }
          ListEmptyComponent={
            <View className="items-center gap-3 rounded-2xl border border-dashed border-border p-8">
              {community.type === "private" && !isMember ? (
                <>
                  <Lock size={28} color={muted} />
                  <Text className="text-center font-semibold text-foreground">
                    Cộng đồng riêng tư
                  </Text>
                  <Text className="text-center text-sm text-muted-foreground">
                    Bạn cần là thành viên để xem bài viết.
                  </Text>
                </>
              ) : (
                <>
                  <FileText size={28} color={muted} />
                  <Text className="text-center font-semibold text-foreground">
                    Chưa có bài viết
                  </Text>
                  <Text className="text-center text-sm text-muted-foreground">
                    Hãy mở đầu cuộc thảo luận.
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => <FeedPostCard post={item} />}
        />
      )}

      {tab === "members" && (
        <FlatList
          data={members ?? []}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={
            <View className="gap-4">
              <CommunityHeader
                community={community}
                isMember={isMember}
                joining={joining}
                tab={tab}
                setTab={setTab}
                onJoin={() => void handleJoin()}
                onPost={() => router.push(`/(main)/(newsfeed)/editor/new?groupId=${groupId}`)}
              />
              {manager && !!requests?.length && (
                <View className="gap-3">
                  <Text className="font-bold text-foreground">Yêu cầu đang chờ</Text>
                  {requests.map((request) => (
                    <View key={request.userId}>{renderRequest({ item: request })}</View>
                  ))}
                </View>
              )}
              <Text className="font-bold text-foreground">Thành viên</Text>
            </View>
          }
          renderItem={renderMember}
          ListEmptyComponent={
            <Text className="text-center text-muted-foreground">Chưa có thành viên.</Text>
          }
        />
      )}

      {tab === "about" && (
        <FlatList
          data={[0]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListHeaderComponent={
            <CommunityHeader
              community={community}
              isMember={isMember}
              joining={joining}
              tab={tab}
              setTab={setTab}
              onJoin={() => void handleJoin()}
              onPost={() => router.push(`/(main)/(newsfeed)/editor/new?groupId=${groupId}`)}
            />
          }
          renderItem={() => (
            <View className="gap-4">
              <View className="rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2">
                  <BookOpen size={18} color={primary} />
                  <Text className="font-bold text-card-foreground">Nội quy</Text>
                </View>
                {community.rules?.length ? (
                  community.rules.map((rule, index) => (
                    <View key={rule.id} className="mt-4 rounded-2xl bg-muted/50 p-4">
                      <Text className="text-xs font-bold text-primary">#{index + 1}</Text>
                      <Text className="mt-1 font-semibold text-foreground">{rule.title}</Text>
                      <Text className="mt-1 text-sm text-muted-foreground">{rule.description}</Text>
                    </View>
                  ))
                ) : (
                  <Text className="mt-3 text-sm text-muted-foreground">
                    Cộng đồng chưa có nội quy riêng.
                  </Text>
                )}
              </View>
              <View className="rounded-2xl border border-border bg-card p-4">
                <Text className="font-bold text-card-foreground">Thông tin</Text>
                <View className="mt-3 gap-3">
                  <InfoRow label="Chủ đề" value={CATEGORY_LABEL[community.category]} />
                  <InfoRow
                    label="Loại"
                    value={community.type === "public" ? "Công khai" : "Riêng tư"}
                  />
                  <InfoRow
                    label="Tham gia"
                    value={community.joinPolicy === "approval" ? "Cần duyệt" : "Mở"}
                  />
                  <InfoRow
                    label="Ngày tạo"
                    value={new Date(community.createdAt).toLocaleDateString("vi-VN")}
                  />
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* Bottom Sheet Menu Cộng đồng */}
      <BottomSheet
        ref={groupMenuSheetRef}
        index={-1}
        snapPoints={menuSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: "transparent" }}
        handleIndicatorStyle={{ backgroundColor: muted, width: 44 }}
      >
        <BottomSheetView className="flex-1 rounded-t-3xl bg-card px-4 pb-8 pt-1">
          <View className="border-b border-border/40 pb-3">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cộng đồng
            </Text>
            <Text
              className="mt-1 text-lg font-bold leading-tight text-foreground"
              numberOfLines={1}
            >
              {community.name}
            </Text>
          </View>

          <View className="mt-2 gap-1">
            {isMember && !owner && (
              <ActionRow
                icon={<UserMinus size={20} color={destructive} />}
                label="Rời cộng đồng"
                hint="Bạn sẽ không thể đăng bài và xem nội dung riêng tư"
                destructive
                onPress={() => {
                  groupMenuSheetRef.current?.close();
                  confirmLeave();
                }}
              />
            )}
            {owner && (
              <ActionRow
                icon={<Trash2 size={20} color={destructive} />}
                label="Lưu trữ cộng đồng"
                hint="Cộng đồng sẽ bị ẩn khỏi công cộng và không hiển thị nữa"
                destructive
                onPress={() => {
                  groupMenuSheetRef.current?.close();
                  confirmArchive();
                }}
              />
            )}
          </View>

          <Pressable
            onPress={() => groupMenuSheetRef.current?.close()}
            className="mt-3 items-center rounded-xl border border-border/60 py-3.5 active:bg-muted/40"
          >
            <Text className="text-[15px] font-semibold text-muted-foreground">Đóng</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheet>

      {/* Bottom Sheet Quản lý Thành viên */}
      <BottomSheet
        ref={memberManageSheetRef}
        index={-1}
        snapPoints={memberSnapPoints}
        enablePanDownToClose
        onClose={() => setSelectedMember(null)}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: "transparent" }}
        handleIndicatorStyle={{ backgroundColor: muted, width: 44 }}
      >
        <BottomSheetView className="flex-1 rounded-t-3xl bg-card px-4 pb-8 pt-1">
          {selectedMember && (
            <>
              <View className="flex-row items-center gap-3 border-b border-border/40 pb-3">
                <Avatar
                  uri={profilesMap[selectedMember.userId]?.avatar}
                  name={profilesMap[selectedMember.userId]?.displayName || selectedMember.userId}
                  size="md"
                />
                <View className="min-w-0 flex-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quản lý thành viên
                  </Text>
                  <Text
                    className="text-lg font-bold leading-tight text-foreground"
                    numberOfLines={1}
                  >
                    {profilesMap[selectedMember.userId]?.displayName || selectedMember.userId}
                  </Text>
                </View>
              </View>

              <View className="mt-2 gap-1">
                {owner && selectedMember.role !== "admin" && (
                  <ActionRow
                    icon={<Shield size={20} color={foreground} />}
                    label="Thăng cấp thành Admin"
                    hint="Cho phép quản lý cài đặt nhóm và tất cả thành viên"
                    onPress={() => void handleUpdateRole("admin")}
                  />
                )}
                {owner && selectedMember.role !== "moderator" && (
                  <ActionRow
                    icon={<ShieldAlert size={20} color={foreground} />}
                    label="Thăng cấp thành Moderator"
                    hint="Cho phép duyệt yêu cầu tham gia và xóa bài viết"
                    onPress={() => void handleUpdateRole("moderator")}
                  />
                )}
                {owner && selectedMember.role !== "member" && (
                  <ActionRow
                    icon={<UserCheck size={20} color={foreground} />}
                    label="Hạ cấp xuống Thành viên"
                    hint="Tước bỏ quyền quản trị của tài khoản này"
                    onPress={() => void handleUpdateRole("member")}
                  />
                )}
                {owner && (
                  <ActionRow
                    icon={<Crown size={20} color={foreground} />}
                    label="Chuyển quyền Chủ sở hữu"
                    hint="Nhượng toàn quyền tối cao của nhóm cho thành viên này"
                    onPress={() => void handleTransferOwner()}
                  />
                )}
                <ActionRow
                  icon={<UserX size={20} color={destructive} />}
                  label="Trục xuất khỏi cộng đồng"
                  hint="Xóa tài khoản khỏi nhóm ngay lập tức"
                  destructive
                  onPress={() => handleKickMember()}
                />
              </View>

              <Pressable
                onPress={() => memberManageSheetRef.current?.close()}
                className="mt-3 items-center rounded-xl border border-border/60 py-3.5 active:bg-muted/40"
              >
                <Text className="text-[15px] font-semibold text-muted-foreground">Đóng</Text>
              </Pressable>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>

      <EditCommunityModal
        community={community}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </SafeAreaView>
  );
}

function CommunityHeader({
  community,
  isMember,
  joining,
  tab,
  setTab,
  onJoin,
  onPost,
}: {
  community: ICommunity;
  isMember: boolean;
  joining: boolean;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  onJoin: () => void;
  onPost: () => void;
}) {
  const { primary } = useIconColors();

  return (
    <View className="gap-4">
      <View className="overflow-hidden rounded-3xl border border-border bg-card">
        <Image
          source={community.coverUrl ? { uri: community.coverUrl } : defaultCoverGroup}
          className="h-36 w-full"
          contentFit="cover"
          transition={300}
        />
        <View className="gap-4 p-4">
          <View className="flex-row items-end gap-3">
            <View className="-mt-12 size-20 items-center justify-center overflow-hidden rounded-3xl border-4 border-card bg-primary shadow-lg">
              <Image
                source={community.avatar ? { uri: community.avatar } : defaultAvatarGroup}
                className="size-full"
                contentFit="cover"
                transition={300}
              />
            </View>
            <View className="min-w-0 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="flex-1 text-2xl font-bold text-card-foreground" numberOfLines={1}>
                  {community.name}
                </Text>
                {canManage(community.viewerRole) && <ShieldCheck size={20} color={primary} />}
              </View>
              <Text className="text-sm text-muted-foreground">
                {CATEGORY_LABEL[community.category]} ·{" "}
                {community.type === "public" ? "Công khai" : "Riêng tư"}
              </Text>
            </View>
          </View>

          <Text className="text-sm text-muted-foreground">
            {community.description || "Cộng đồng chưa có mô tả."}
          </Text>

          <View className="flex-row gap-2">
            <StatBlock value={community.memberCount} label="thành viên" />
            <StatBlock value={community.postCount} label="bài viết" />
            <StatBlock
              value={community.joinPolicy === "approval" ? "Duyệt" : "Mở"}
              label="tham gia"
            />
          </View>

          {isMember ? (
            <Pressable
              onPress={onPost}
              className="rounded-2xl bg-primary px-4 py-3 active:opacity-80"
            >
              <Text className="text-center font-semibold text-primary-foreground">
                Đăng bài vào cộng đồng
              </Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={joining || community.joinRequestStatus === "pending"}
              onPress={onJoin}
              className="rounded-2xl bg-primary px-4 py-3 active:opacity-80 disabled:opacity-50"
            >
              <Text className="text-center font-semibold text-primary-foreground">
                {community.joinRequestStatus === "pending"
                  ? "Đã gửi yêu cầu"
                  : "Tham gia cộng đồng"}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View className="flex-row rounded-full bg-muted p-1">
        <TabButton active={tab === "posts"} label="Bài viết" onPress={() => setTab("posts")} />
        <TabButton
          active={tab === "members"}
          label="Thành viên"
          onPress={() => setTab("members")}
        />
        <TabButton active={tab === "about"} label="About" onPress={() => setTab("about")} />
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
