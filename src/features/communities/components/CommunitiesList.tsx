import { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
  Vibration,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Plus, Search, Users, MailOpen, Calendar } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import {
  useListCommunitiesQuery,
  useLazySearchGroupsQuery,
  useGetReceivedInvitationsQuery,
  useAcceptInvitationMutation,
  useDeclineInvitationMutation,
} from "@/store/api/communityApi";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type ICommunity,
  type ISearchGroupResult,
} from "@/types/community.types";
import { normalizeMediaUrl } from "@/utils/url";
import { toast } from "@/utils/appToast";
import { CATEGORY_LABEL } from "../constants";
import { CategoryChip } from "./CategoryChip";
import { CommunityCard } from "./CommunityCard";
import { CommunitySkeleton } from "./CommunitySkeleton";
import { CreateCommunityModal } from "./CreateCommunityModal";
import { CommunityJoinedFeed } from "./CommunityJoinedFeed";

const defaultAvatarGroup = require("../../../../assets/images/avatar-group-default.jpg");

export function CommunitiesList() {
  const { primary, foreground, muted } = useIconColors();
  const [activeTab, setActiveTab] = useState<"discover" | "feed" | "invites">("discover");
  const [category, setCategory] = useState<CommunityCategory | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  // Search states
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ISearchGroupResult[]>([]);
  const [searchTrigger, { isLoading: searchLoading }] = useLazySearchGroupsQuery();

  const { data, isLoading } = useListCommunitiesQuery({ category, limit: 30 });
  const { data: joined } = useListCommunitiesQuery({ scope: "joined", limit: 8 });

  // Received invitations
  const { data: invitesData, isLoading: isInvitesLoading } = useGetReceivedInvitationsQuery();
  const [acceptInvitation, { isLoading: isAccepting }] = useAcceptInvitationMutation();
  const [declineInvitation, { isLoading: isDeclining }] = useDeclineInvitationMutation();

  const joinedItems = joined?.items ?? [];

  const handleAccept = async (groupId: string) => {
    try {
      await acceptInvitation(groupId).unwrap();
      Vibration.vibrate(80);
      toast.success("Đã đồng ý tham gia cộng đồng!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể đồng ý tham gia");
    }
  };

  const handleDecline = async (groupId: string) => {
    try {
      await declineInvitation(groupId).unwrap();
      toast.success("Đã từ chối lời mời");
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể từ chối lời mời");
    }
  };

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchTrigger({ q: searchQuery.trim(), pageSize: 15 })
        .unwrap()
        .then((res) => {
          setSearchResults(res.items ?? []);
        })
        .catch((err) => {
          console.error("Search groups error:", err);
          setSearchResults([]);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchTrigger]);

  const isSearching = searchQuery.trim().length >= 2;
  const displayData = isSearching ? searchResults : (data?.items ?? []);
  const showSkeleton = isLoading || searchLoading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="border-b border-border/40 bg-background px-4 py-3.5">
        {showSearchInput ? (
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => {
                setShowSearchInput(false);
                setSearchQuery("");
              }}
              className="rounded-full p-1 active:opacity-70"
            >
              <ArrowLeft size={22} color={foreground} />
            </Pressable>
            <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-0.5">
              <Search size={18} color={muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm kiếm nhóm..."
                placeholderTextColor={muted}
                autoFocus
                className="flex-1 py-2 text-sm text-foreground"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  className="px-2 py-1 active:opacity-75"
                >
                  <Text className="text-xs font-semibold text-primary">Xóa</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-2xl font-bold text-foreground">Cộng đồng</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setShowSearchInput(true)}
                className="size-10 items-center justify-center rounded-full border border-border bg-card active:scale-95"
              >
                <Search size={19} color={foreground} />
              </Pressable>
              <Pressable
                onPress={() => setModalOpen(true)}
                className="size-10 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95"
                style={{
                  elevation: 6,
                  shadowColor: primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                }}
              >
                <Plus size={20} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {!showSearchInput && (
        <View className="flex-row border-b border-border/40 bg-background px-4">
          <Pressable
            onPress={() => setActiveTab("discover")}
            className={`flex-1 items-center border-b-2 py-3 ${
              activeTab === "discover" ? "border-primary" : "border-transparent"
            }`}
          >
            <Text
              className={`font-semibold ${
                activeTab === "discover" ? "font-bold text-primary" : "text-muted-foreground"
              }`}
            >
              Khám phá
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("feed")}
            className={`flex-1 items-center border-b-2 py-3 ${
              activeTab === "feed" ? "border-primary" : "border-transparent"
            }`}
          >
            <Text
              className={`font-semibold ${
                activeTab === "feed" ? "font-bold text-primary" : "text-muted-foreground"
              }`}
            >
              Bảng tin
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("invites")}
            className={`flex-1 items-center border-b-2 py-3 ${
              activeTab === "invites" ? "border-primary" : "border-transparent"
            }`}
          >
            <Text
              className={`font-semibold ${
                activeTab === "invites" ? "font-bold text-primary" : "text-muted-foreground"
              }`}
            >
              Lời mời
            </Text>
          </Pressable>
        </View>
      )}

      {activeTab === "feed" && !isSearching ? (
        <CommunityJoinedFeed />
      ) : activeTab === "invites" && !isSearching ? (
        <FlatList
          data={isInvitesLoading ? [1, 2] : (invitesData?.items ?? [])}
          keyExtractor={(item, index) =>
            isInvitesLoading ? `skeleton-${index}` : (item as any).groupId
          }
          contentContainerStyle={{ padding: 16, gap: 14 }}
          ListHeaderComponent={
            <View className="mb-2">
              <Text className="text-lg font-bold text-foreground">Lời mời gia nhập cộng đồng</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground">
                Các lời mời từ bạn bè gửi đến bạn để cùng kết nối và thảo luận.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View className="mt-4 items-center gap-3 rounded-2xl border border-dashed border-border p-10">
              <View className="size-14 items-center justify-center rounded-2xl bg-muted/30">
                <MailOpen size={28} color={muted} />
              </View>
              <Text className="mt-2 text-center font-bold text-foreground">
                Hộp thư lời mời đang trống
              </Text>
              <Text className="px-4 text-center text-xs text-muted-foreground">
                Bạn chưa nhận được lời mời gia nhập cộng đồng nào.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (isInvitesLoading) {
              return <CommunitySkeleton />;
            }
            const invite = item as any;
            const communityName = invite.communityInfo?.name ?? "Cộng đồng Zalogram";
            const inviterName = invite.invitedByInfo?.displayName ?? "Người dùng Zalogram";
            const inviterAvatar = invite.invitedByInfo?.avatar;
            const communityAvatar = invite.communityInfo?.avatar;

            return (
              <View className="flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <View className="flex-row items-center gap-3">
                  <View className="size-12 items-center justify-center overflow-hidden rounded-xl border border-border/10 bg-primary/10">
                    {communityAvatar ? (
                      <Image
                        source={{ uri: normalizeMediaUrl(communityAvatar) }}
                        className="size-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-sm font-extrabold text-primary">
                        {communityName.slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Pressable
                      onPress={() => router.push(`/(main)/(communities)/${invite.groupId}`)}
                    >
                      <Text
                        className="text-sm font-bold text-foreground active:text-primary"
                        numberOfLines={1}
                      >
                        {communityName}
                      </Text>
                    </Pressable>
                    <View className="mt-1 flex-row items-center gap-1.5">
                      <Text className="text-xs text-muted-foreground">Mời bởi:</Text>
                      <View className="flex-row items-center gap-1">
                        {inviterAvatar && (
                          <Image
                            source={{ uri: normalizeMediaUrl(inviterAvatar) }}
                            className="size-3.5 rounded-full"
                            resizeMode="cover"
                          />
                        )}
                        <Text className="text-xs font-bold text-foreground" numberOfLines={1}>
                          {inviterName}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View className="flex-row items-center gap-2 border-t border-border/40 pt-2.5">
                  <Calendar size={13} color={muted} />
                  <Text className="text-[11px] font-semibold text-muted-foreground">
                    Mời vào {new Date(invite.createdAt).toLocaleDateString("vi-VN")}
                  </Text>
                </View>

                <View className="mt-1 w-full flex-row gap-2">
                  <Pressable
                    disabled={isAccepting || isDeclining}
                    onPress={() => void handleDecline(invite.groupId)}
                    className="h-9 flex-1 items-center justify-center rounded-xl bg-muted/40 px-3 active:bg-muted/70"
                  >
                    <Text className="text-xs font-bold text-foreground">Từ chối</Text>
                  </Pressable>
                  <Pressable
                    disabled={isAccepting || isDeclining}
                    onPress={() => void handleAccept(invite.groupId)}
                    className="h-9 flex-1 items-center justify-center rounded-xl bg-primary px-3 active:bg-primary/80"
                  >
                    {isAccepting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text className="text-xs font-bold text-primary-foreground">Chấp nhận</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      ) : (
        <FlatList
          data={showSkeleton ? [1, 2, 3] : (displayData as any)}
          keyExtractor={(item, index) =>
            showSkeleton ? `skeleton-${index}` : (item as ICommunity).groupId
          }
          contentContainerStyle={{ padding: 16, gap: 14 }}
          ListHeaderComponent={
            !isSearching ? (
              <View className="mb-2 gap-5">
                <FlatList
                  horizontal
                  data={["all", ...COMMUNITY_CATEGORIES] as (CommunityCategory | "all")[]}
                  keyExtractor={(item) => item}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                  renderItem={({ item }) => (
                    <CategoryChip
                      category={item}
                      active={(item === "all" ? undefined : item) === category}
                      onPress={() => setCategory(item === "all" ? undefined : item)}
                    />
                  )}
                />

                {!!joinedItems.length && (
                  <View className="gap-3">
                    <Text className="font-bold text-foreground">Cộng đồng của tôi</Text>
                    <FlatList
                      horizontal
                      data={joinedItems}
                      keyExtractor={(item) => item.groupId}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                      renderItem={({ item }) => (
                        <Pressable
                          onPress={() => router.push(`/(main)/(communities)/${item.groupId}`)}
                          className="w-56 overflow-hidden rounded-2xl border border-border bg-card p-4 active:opacity-85"
                        >
                          <View className="flex-row items-center gap-3">
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                overflow: "hidden",
                              }}
                            >
                              <Image
                                source={
                                  normalizeMediaUrl(item.avatar)
                                    ? { uri: normalizeMediaUrl(item.avatar) }
                                    : defaultAvatarGroup
                                }
                                className="size-full"
                                style={{ width: "100%", height: "100%", borderRadius: 22 }}
                                resizeMode="cover"
                              />
                            </View>
                            <View className="min-w-0 flex-1">
                              <Text className="font-bold text-card-foreground" numberOfLines={1}>
                                {item.name}
                              </Text>
                              <Text className="text-xs text-muted-foreground">
                                {item.memberCount} thành viên
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                <Text className="font-bold text-foreground">
                  {category ? CATEGORY_LABEL[category] || category : "Tất cả chủ đề"}
                </Text>
              </View>
            ) : (
              <View className="mb-2">
                <Text className="text-base font-bold text-foreground">
                  Kết quả tìm kiếm cho "{searchQuery}"
                </Text>
              </View>
            )
          }
          ListEmptyComponent={
            <View className="items-center gap-3 rounded-2xl border border-dashed border-border p-8">
              <Users size={28} color={muted} />
              <Text className="text-center font-semibold text-foreground">
                {showSkeleton
                  ? "Đang tải dữ liệu..."
                  : isSearching
                    ? "Không tìm thấy cộng đồng nào phù hợp."
                    : "Chưa có cộng đồng trong chủ đề này."}
              </Text>
              {!showSkeleton && !isSearching && (
                <Text className="text-center text-sm text-muted-foreground">
                  Bạn có thể tạo cộng đồng đầu tiên.
                </Text>
              )}
            </View>
          }
          renderItem={({ item }) =>
            showSkeleton ? <CommunitySkeleton /> : <CommunityCard item={item as any} />
          }
        />
      )}

      <CreateCommunityModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SafeAreaView>
  );
}
