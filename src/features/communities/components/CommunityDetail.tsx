import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe2,
  Info,
  Link2,
  Lock,
  MoreVertical,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";

import { FeedPostCard } from "@/features/newsfeed/components/FeedPostCard";
import { useIconColors } from "@/hooks/useIconColors";
import { usePostMultipleUsersMutation, type FriendListItem } from "@/store/api/userApi";
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
  useGetPendingPostsQuery,
} from "@/store/api/communityApi";
import { PendingPostsModal } from "./PendingPostsModal";
import {
  type CommunityCategory,
  type CommunityMemberRole,
  type ICommunityMember,
} from "@/types/community.types";
import type { IPost } from "@/types/newsfeed.types";
import { toast } from "@/utils/appToast";
import { CATEGORY_LABEL, ROLE_LABEL, type TabKey } from "../constants";
import { canManage } from "../utils/helpers";
import { CommunityHeader } from "./CommunityHeader";
import { EditCommunityModal } from "./EditCommunityModal";
import { GroupMenuSheet } from "./GroupMenuSheet";
import { MemberManageSheet } from "./MemberManageSheet";
import { MembersModal } from "./MembersModal";
import { RequestsModal } from "./RequestsModal";
import { InfoRow } from "./InfoRow";
import { CommunityReportSheet } from "./CommunityReportSheet";
import { TransferOwnerModal } from "./TransferOwnerModal";

export interface CommunityDetailProps {
  groupId: string;
}

export function CommunityDetail({ groupId }: CommunityDetailProps) {
  const { primary, foreground, muted, destructive } = useIconColors();
  const [tab, setTab] = useState<TabKey>("posts");
  const [editOpen, setEditOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ICommunityMember | null>(null);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [requestsModalOpen, setRequestsModalOpen] = useState(false);
  const [pendingPostsModalOpen, setPendingPostsModalOpen] = useState(false);
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);

  const groupMenuSheetRef = useRef<BottomSheet>(null);
  const memberManageSheetRef = useRef<BottomSheet>(null);
  const isTransitioningRef = useRef(false);

  const {
    data: community,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetCommunityQuery(groupId, { skip: !groupId });
  const { data: members } = useGetCommunityMembersQuery(groupId, { skip: !groupId });
  const { data: posts } = useGetCommunityPostsQuery({ groupId, limit: 20 }, { skip: !groupId });
  const manager = canManage(community?.viewerRole);
  const owner = community?.viewerRole === "owner";
  const { data: requests } = useGetCommunityRequestsQuery(groupId, { skip: !groupId || !manager });
  const { data: pendingPosts } = useGetPendingPostsQuery(groupId, {
    skip: !groupId || !manager || !community?.isPostApprovalRequired,
  });

  const [joinCommunity, { isLoading: joining }] = useJoinCommunityMutation();
  const [leaveCommunity] = useLeaveCommunityMutation();
  const [archiveCommunity] = useArchiveCommunityMutation();
  const [resolveRequest] = useResolveCommunityRequestMutation();
  const [removeMember] = useRemoveCommunityMemberMutation();
  const [updateRole] = useUpdateCommunityMemberRoleMutation();
  const [transferOwner] = useTransferCommunityOwnerMutation();

  const [profilesMap, setProfilesMap] = useState<Record<string, FriendListItem>>({});
  const [postMultipleUsers] = usePostMultipleUsersMutation();
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ids: string[] = [];
    if (members) {
      members.forEach((m) => ids.push(m.userId));
    }
    if (requests) {
      requests.forEach((r) => ids.push(r.userId));
    }
    const uniqueIds = Array.from(new Set(ids));
    const missingIds = uniqueIds.filter((id) => !fetchedIdsRef.current.has(id));

    if (missingIds.length > 0) {
      missingIds.forEach((id) => fetchedIdsRef.current.add(id));
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
          missingIds.forEach((id) => fetchedIdsRef.current.delete(id));
        });
    }
  }, [members, requests, postMultipleUsers]);

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

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Đang tải cộng đồng...</Text>
      </SafeAreaView>
    );
  }

  if (isError || !community) {
    const status = (error as any)?.status;
    const message = (error as any)?.data?.message || "";

    let title = "Không thể truy cập";
    let description = "Đã xảy ra lỗi không xác định khi tải dữ liệu cộng đồng.";

    if (status === 404) {
      title = "Cộng đồng không tồn tại";
      description = "Cộng đồng này không tồn tại, đã bị xóa hoặc lưu trữ bởi ban quản trị.";
    } else if (status === 403) {
      title = "Truy cập bị từ chối";
      description = message.includes("chặn")
        ? "Bạn đã bị chặn khỏi cộng đồng này bởi ban quản trị."
        : "Cộng đồng này là riêng tư. Bạn cần là thành viên để xem nội dung.";
    }

    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle size={40} color={destructive} />
        </View>
        <Text className="mb-2 text-center text-2xl font-bold text-foreground">{title}</Text>
        <Text className="mb-8 max-w-xs text-center text-base text-muted-foreground">
          {description}
        </Text>
        <View className="flex-row gap-4">
          <Pressable
            className="flex-row items-center gap-2 rounded-full border border-border bg-card px-5 py-3 active:opacity-70"
            onPress={() => router.back()}
          >
            <ArrowLeft size={16} color={foreground} />
            <Text className="font-semibold text-foreground">Quay lại</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-2 rounded-full bg-primary px-5 py-3 active:opacity-70"
            onPress={() => void refetch()}
          >
            <RefreshCw size={16} color="#ffffff" />
            <Text className="font-semibold text-primary-foreground">Tải lại</Text>
          </Pressable>
        </View>
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

  const handleTransferOwner = () => {
    if (!selectedMember) return;
    isTransitioningRef.current = true;
    memberManageSheetRef.current?.close();
    setTransferModalOpen(true);
  };

  const handleConfirmTransferOwner = async () => {
    if (!selectedMember) return;
    try {
      setTransferModalOpen(false);
      await transferOwner({ groupId, targetUserId: selectedMember.userId }).unwrap();
      toast.success("Đã chuyển quyền chủ sở hữu thành công");
      setMembersModalOpen(false);
    } catch {
      toast.error("Không thể chuyển quyền chủ sở hữu");
    } finally {
      setSelectedMember(null);
    }
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

  const handleResolveRequest = async (userId: string, action: "approve" | "reject") => {
    try {
      await resolveRequest({ groupId, userId, action }).unwrap();
      toast.success(action === "approve" ? "Đã duyệt yêu cầu" : "Đã từ chối yêu cầu");
    } catch {
      toast.error("Không thể xử lý yêu cầu");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      {/* Floating Navigation Header */}
      <View className="absolute left-0 right-0 top-0 z-50 flex-row items-center justify-end px-4 pb-3 pt-12">
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setMembersModalOpen(true)}
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 backdrop-blur-md active:scale-90"
          >
            <Users size={18} color="#fff" />
          </Pressable>
          {manager && (
            <Pressable
              onPress={() => setRequestsModalOpen(true)}
              className="relative h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 backdrop-blur-md active:scale-90"
            >
              <UserCheck size={18} color="#fff" />
              {!!requests?.length && (
                <View className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
                  <Text className="text-destructive-foreground text-[9px] font-bold">
                    {requests.length}
                  </Text>
                </View>
              )}
            </Pressable>
          )}
          {manager && community.isPostApprovalRequired && (
            <Pressable
              onPress={() => setPendingPostsModalOpen(true)}
              className="relative h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 backdrop-blur-md active:scale-90"
            >
              <FileText size={18} color="#fff" />
              {!!pendingPosts?.length && (
                <View className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1">
                  <Text className="text-[9px] font-bold text-white">{pendingPosts.length}</Text>
                </View>
              )}
            </Pressable>
          )}
          {(owner || community.viewerRole === "admin") && (
            <Pressable
              onPress={() => setEditOpen(true)}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 backdrop-blur-md active:scale-90"
            >
              <Pencil size={18} color="#fff" />
            </Pressable>
          )}
          <Pressable
            onPress={() => groupMenuSheetRef.current?.expand()}
            className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/25 backdrop-blur-md active:scale-90"
          >
            <MoreVertical size={18} color="#fff" />
          </Pressable>
        </View>
      </View>

      {tab === "posts" && (
        <FlatList
          data={posts?.items ?? []}
          keyExtractor={(item: IPost) => item.postId}
          contentContainerStyle={{ paddingBottom: 100, gap: 16 }}
          ListHeaderComponent={
            <CommunityHeader
              community={community}
              isMember={isMember}
              joining={joining}
              tab={tab}
              setTab={setTab}
              onJoin={() => void handleJoin()}
              onPost={() => router.push(`/(main)/(communities)/editor/new?groupId=${groupId}`)}
            />
          }
          ListEmptyComponent={
            <View className="mx-4 mt-4 items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8">
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
          renderItem={({ item }) => (
            <View className="mx-4">
              <FeedPostCard post={item} communityRole={community?.viewerRole} />
            </View>
          )}
        />
      )}

      {tab === "about" && (
        <FlatList
          data={[0]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={{ paddingBottom: 100, gap: 16 }}
          ListHeaderComponent={
            <CommunityHeader
              community={community}
              isMember={isMember}
              joining={joining}
              tab={tab}
              setTab={setTab}
              onJoin={() => void handleJoin()}
              onPost={() => router.push(`/(main)/(communities)/editor/new?groupId=${groupId}`)}
            />
          }
          renderItem={() => (
            <View className="mt-2 gap-5 px-4">
              {/* Mô tả cộng đồng */}
              <View className="gap-4 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2 border-b border-border/40 pb-3">
                  <Info size={18} color={primary} />
                  <Text className="text-[16px] font-bold text-foreground">Mô tả cộng đồng</Text>
                </View>
                <Text className="text-sm font-medium leading-relaxed text-muted-foreground">
                  {community.description || "Cộng đồng chưa có mô tả."}
                </Text>
              </View>

              {/* Thống kê hoạt động */}
              <View className="gap-4 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2 border-b border-border/40 pb-3">
                  <Users size={18} color={primary} />
                  <Text className="text-[16px] font-bold text-foreground">Thống kê hoạt động</Text>
                </View>
                <View className="flex-row items-center justify-around py-2">
                  <View className="items-center">
                    <Text className="text-2xl font-extrabold text-foreground">
                      {community.memberCount.toLocaleString("vi-VN")}
                    </Text>
                    <Text className="mt-1 text-xs font-semibold text-muted-foreground">
                      Thành viên
                    </Text>
                  </View>
                  <View className="h-8 w-[1px] bg-border/40" />
                  <View className="items-center">
                    <Text className="text-2xl font-extrabold text-foreground">
                      {community.postCount.toLocaleString("vi-VN")}
                    </Text>
                    <Text className="mt-1 text-xs font-semibold text-muted-foreground">
                      Bài viết
                    </Text>
                  </View>
                </View>
              </View>

              {/* Accordion Rules */}
              <View className="gap-4 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2 border-b border-border/40 pb-3">
                  <BookOpen size={18} color={primary} />
                  <Text className="text-[16px] font-bold text-foreground">Nội quy cộng đồng</Text>
                </View>
                {community.rules?.length ? (
                  <View className="gap-1">
                    {community.rules.map((rule, index) => {
                      const isExpanded = expandedRuleId === rule.id;
                      const formattedIndex = String(index + 1).padStart(2, "0");
                      return (
                        <View
                          key={rule.id}
                          className="mt-3 border-b border-border/20 pb-3 last:border-0"
                        >
                          <Pressable
                            onPress={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                            className="flex-row items-center justify-between gap-3 active:opacity-70"
                          >
                            <View className="flex-1 flex-row items-center gap-3.5">
                              <Text className="text-xl font-extrabold text-primary/80">
                                {formattedIndex}
                              </Text>
                              <Text className="flex-1 text-[15px] font-semibold text-foreground">
                                {rule.title}
                              </Text>
                            </View>
                            {isExpanded ? (
                              <ChevronUp size={18} color={muted} />
                            ) : (
                              <ChevronDown size={18} color={muted} />
                            )}
                          </Pressable>

                          {isExpanded && (
                            <View className="mt-2.5 rounded-2xl border border-border/20 bg-muted/40 p-3.5">
                              <Text className="text-sm font-medium leading-relaxed text-muted-foreground">
                                {rule.description}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text className="py-2 text-sm font-medium text-muted-foreground">
                    Cộng đồng chưa thiết lập nội quy riêng.
                  </Text>
                )}
              </View>

              {/* Information Row List */}
              <View className="gap-4 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-2 border-b border-border/40 pb-3">
                  <Globe2 size={18} color={primary} />
                  <Text className="text-[16px] font-bold text-foreground">Thông tin chi tiết</Text>
                </View>
                <View className="gap-3">
                  <InfoRow
                    icon={<Sparkles size={16} color={primary} />}
                    label="Chủ đề"
                    value={CATEGORY_LABEL[community.category]}
                  />
                  <InfoRow
                    icon={
                      community.type === "public" ? (
                        <Globe2 size={16} color={primary} />
                      ) : (
                        <Lock size={16} color={primary} />
                      )
                    }
                    label="Loại cộng đồng"
                    value={community.type === "public" ? "Công khai" : "Riêng tư"}
                  />
                  <InfoRow
                    icon={<Calendar size={16} color={primary} />}
                    label="Ngày thành lập"
                    value={new Date(community.createdAt).toLocaleDateString("vi-VN")}
                  />
                  <InfoRow
                    icon={<Link2 size={16} color={primary} />}
                    label="Slug nhóm"
                    value={community.slug}
                  />
                  <InfoRow
                    icon={<Users size={16} color={primary} />}
                    label="Chế độ tham gia"
                    value={
                      community.joinPolicy === "open"
                        ? "Tham gia trực tiếp"
                        : "Cần quản trị viên duyệt"
                    }
                  />
                  <InfoRow
                    icon={<Sparkles size={16} color={primary} />}
                    label="Tìm kiếm nhóm"
                    value={
                      community.type === "public" ? "Hiển thị công khai" : "Chỉ thành viên qua link"
                    }
                  />
                </View>
              </View>

              {/* Danger Zone / Admin Actions */}
              <View className="gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                <Text className="text-[15px] font-bold text-destructive">
                  Vùng quản trị nguy hiểm
                </Text>
                {isMember && !owner && (
                  <Pressable
                    onPress={confirmLeave}
                    className="flex-row items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 py-3.5 transition-all active:scale-95"
                  >
                    <UserMinus size={18} color={destructive} />
                    <Text className="text-[14px] font-bold text-destructive">
                      Rời khỏi cộng đồng
                    </Text>
                  </Pressable>
                )}
                {owner && (
                  <Pressable
                    onPress={confirmArchive}
                    className="flex-row items-center justify-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 py-3.5 transition-all active:scale-95"
                  >
                    <Trash2 size={18} color={destructive} />
                    <Text className="text-[14px] font-bold text-destructive">
                      Giải tán cộng đồng này
                    </Text>
                  </Pressable>
                )}
                {!isMember && community.joinRequestStatus !== "pending" && (
                  <Pressable
                    disabled={joining}
                    onPress={handleJoin}
                    className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 shadow-md shadow-primary/20 transition-all active:scale-95"
                  >
                    <Text className="text-[14px] font-bold text-primary-foreground">
                      Gia nhập cộng đồng
                    </Text>
                  </Pressable>
                )}
                {!isMember && community.joinRequestStatus === "pending" && (
                  <View className="flex-row items-center justify-center gap-2 rounded-2xl bg-muted py-3.5">
                    <Text className="text-[14px] font-bold text-muted-foreground">
                      Đang chờ phê duyệt gia nhập
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* Group Menu Bottom Sheet */}
      <GroupMenuSheet
        sheetRef={groupMenuSheetRef}
        community={community}
        isMember={isMember}
        owner={owner}
        mutedColor={muted}
        destructiveColor={destructive}
        confirmLeave={confirmLeave}
        confirmArchive={confirmArchive}
        onReportPress={() => setReportVisible(true)}
        renderBackdrop={renderBackdrop}
      />

      {/* Community Report Sheet */}
      <CommunityReportSheet
        groupId={groupId}
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
      />

      {/* Member Management Bottom Sheet */}
      <MemberManageSheet
        sheetRef={memberManageSheetRef}
        selectedMember={selectedMember}
        profilesMap={profilesMap}
        owner={owner}
        mutedColor={muted}
        foregroundColor={foreground}
        destructiveColor={destructive}
        onClose={() => {
          if (isTransitioningRef.current) {
            isTransitioningRef.current = false;
          } else {
            setSelectedMember(null);
          }
        }}
        handleUpdateRole={handleUpdateRole}
        handleTransferOwner={handleTransferOwner}
        handleKickMember={handleKickMember}
        renderBackdrop={renderBackdrop}
      />

      {/* FAB Create Post */}
      {tab === "posts" && isMember && (
        <Pressable
          onPress={() => router.push(`/(main)/(communities)/editor/new?groupId=${groupId}`)}
          className="absolute bottom-6 right-6 z-50 size-14 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95"
          style={{
            elevation: 6,
            shadowColor: primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
          }}
        >
          <Pencil size={22} color="#fff" strokeWidth={2.5} />
        </Pressable>
      )}

      {/* Members Modal */}
      <MembersModal
        open={membersModalOpen && selectedMember === null}
        onClose={() => setMembersModalOpen(false)}
        members={members ?? []}
        profilesMap={profilesMap}
        community={community}
        manager={manager}
        mutedColor={muted}
        foregroundColor={foreground}
        onSelectMember={(member) => {
          setSelectedMember(member);
          memberManageSheetRef.current?.expand();
        }}
      />

      {/* Join Requests Modal */}
      <RequestsModal
        open={requestsModalOpen}
        onClose={() => setRequestsModalOpen(false)}
        requests={requests ?? []}
        profilesMap={profilesMap}
        mutedColor={muted}
        handleResolveRequest={handleResolveRequest}
      />

      {/* Edit Community Modal */}
      <EditCommunityModal
        community={community}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />

      {/* Pending Posts Modal */}
      <PendingPostsModal
        open={pendingPostsModalOpen}
        onClose={() => setPendingPostsModalOpen(false)}
        groupId={groupId}
        mutedColor={muted}
        foregroundColor={foreground}
      />

      {/* Transfer Owner Confirmation Modal */}
      <TransferOwnerModal
        open={transferModalOpen}
        onClose={() => {
          setTransferModalOpen(false);
          setSelectedMember(null);
        }}
        communityName={community.name}
        targetDisplayName={
          profilesMap[selectedMember?.userId ?? ""]?.displayName || selectedMember?.userId || ""
        }
        onConfirm={handleConfirmTransferOwner}
      />
    </SafeAreaView>
  );
}
