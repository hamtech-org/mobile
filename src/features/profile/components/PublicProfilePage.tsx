import { useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { FeedPostCard } from "@/features/newsfeed/components/FeedPostCard";
import { useAppSelector } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import { useGetPostsByAuthorQuery, useGetReelsByAuthorQuery } from "@/store/api/newsfeedApi";
import {
  useAcceptFriendRequestMutation,
  useCancelFriendRequestMutation,
  useGetFriendRequestStatusQuery,
  useGetFriendsQuery,
  useGetUserByIdQuery,
  useRemoveFriendMutation,
  useSendUserFriendRequestMutation,
  type FriendListItem,
  type FriendshipStatus,
} from "@/store/api/userApi";
import { toast } from "@/utils/appToast";
import { safeRouterBack } from "@/utils/navigation";

type ProfileTab = "posts" | "about" | "reels" | "photos" | "friends";
type ViewMode = "list" | "grid";

interface PublicProfilePageProps {
  userId: string;
}

const tabs: { key: ProfileTab; label: string; icon: ComponentProps<typeof Ionicons>["name"] }[] = [
  { key: "posts", label: "Bài viết", icon: "newspaper-outline" },
  { key: "about", label: "Giới thiệu", icon: "person-circle-outline" },
  { key: "reels", label: "Reels", icon: "play-circle-outline" },
  { key: "photos", label: "Ảnh", icon: "images-outline" },
  { key: "friends", label: "Bạn bè", icon: "people-outline" },
];

function getInitials(name?: string | null): string {
  const value = name?.trim() || "U";
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function formatJoinDate(value?: string | null): string {
  if (!value) return "Chưa có thông tin";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có thông tin";
  return date.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}

function friendActionMeta(status: FriendshipStatus): {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
} {
  if (status === "friend") return { label: "Bạn bè", icon: "checkmark" };
  if (status === "pending_sent") return { label: "Đã gửi lời mời", icon: "time-outline" };
  if (status === "pending_received") return { label: "Chấp nhận", icon: "person-add-outline" };
  return { label: "Thêm bạn bè", icon: "person-add-outline" };
}

export function PublicProfilePage({ userId }: PublicProfilePageProps) {
  const router = useRouter();
  const currentUser = useAppSelector((state) => state.auth.user);
  const isSelf = currentUser?.userId === userId;
  const { primary, foreground, muted, destructive } = useIconColors();

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
    isFetching: profileFetching,
  } = useGetUserByIdQuery(userId, { skip: !userId });
  const {
    data: postsPage,
    isLoading: postsLoading,
    refetch: refetchPosts,
    isFetching: postsFetching,
  } = useGetPostsByAuthorQuery({ authorId: userId, limit: 20 }, { skip: !userId });
  const {
    data: reelsPage,
    isLoading: reelsLoading,
    refetch: refetchReels,
    isFetching: reelsFetching,
  } = useGetReelsByAuthorQuery({ authorId: userId, limit: 12 }, { skip: !userId });
  const {
    data: friends = [],
    isLoading: friendsLoading,
    refetch: refetchFriends,
    isFetching: friendsFetching,
  } = useGetFriendsQuery(undefined, { skip: !isSelf });
  const { data: friendStatus = "none", refetch: refetchFriendStatus } =
    useGetFriendRequestStatusQuery(userId, { skip: isSelf || !userId });

  const [sendFriendRequest, { isLoading: sendingRequest }] = useSendUserFriendRequestMutation();
  const [cancelFriendRequest, { isLoading: cancellingRequest }] = useCancelFriendRequestMutation();
  const [acceptFriendRequest, { isLoading: acceptingRequest }] = useAcceptFriendRequestMutation();
  const [removeFriend, { isLoading: removingFriend }] = useRemoveFriendMutation();

  const posts = postsPage?.items ?? [];
  const reels = reelsPage?.items ?? [];
  const mediaUrls = useMemo(
    () =>
      posts
        .flatMap((post) => post.mediaUrls ?? [])
        .filter(Boolean)
        .slice(0, 12),
    [posts],
  );
  const actionLoading = sendingRequest || cancellingRequest || acceptingRequest || removingFriend;
  const friendMeta = friendActionMeta(friendStatus);
  const isRefreshing = profileFetching || postsFetching || reelsFetching || friendsFetching;

  const refreshAll = async () => {
    const jobs: Promise<unknown>[] = [refetchProfile(), refetchPosts(), refetchReels()];
    if (isSelf) jobs.push(refetchFriends());
    if (!isSelf) jobs.push(refetchFriendStatus());
    await Promise.all(jobs);
  };

  const handleFriendAction = async () => {
    if (isSelf || actionLoading) return;
    try {
      if (friendStatus === "friend") {
        await removeFriend({ friendId: userId }).unwrap();
      } else if (friendStatus === "pending_sent") {
        await cancelFriendRequest({ friendId: userId }).unwrap();
      } else if (friendStatus === "pending_received") {
        await acceptFriendRequest({ senderId: userId }).unwrap();
      } else {
        await sendFriendRequest({ friendId: userId }).unwrap();
      }
      await refetchFriendStatus();
    } catch (error) {
      const message =
        (error as { data?: { message?: string; error?: { message?: string } } })?.data?.message ??
        (error as { data?: { error?: { message?: string } } })?.data?.error?.message ??
        "Không thể cập nhật trạng thái bạn bè";
      toast.error(message);
    }
  };

  if (profileLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={["top"]}>
        <ActivityIndicator size="large" color={primary} />
        <Text className="mt-3 text-sm text-muted-foreground">Đang tải trang cá nhân...</Text>
      </SafeAreaView>
    );
  }

  if (profileError || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        <ScreenHeader title="Trang cá nhân" onBack={() => safeRouterBack("/(main)/(newsfeed)")} />
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle-outline" size={48} color={destructive} />
          <Text className="mt-4 text-center text-lg font-semibold text-foreground">
            Không thể tải hồ sơ
          </Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Người dùng không tồn tại hoặc hồ sơ đã bị ẩn.
          </Text>
          <Button label="Thử lại" onPress={() => void refetchProfile()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader
        title="Trang cá nhân"
        onBack={() => safeRouterBack("/(main)/(newsfeed)")}
        rightActions={[{ icon: "ellipsis-horizontal", onPress: () => undefined }]}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refreshAll} />}
      >
        <ProfileHero
          displayName={profile.displayName}
          avatar={profile.avatar}
          bio={profile.bio}
          postsCount={posts.length}
          friendsCount={isSelf ? friends.length : undefined}
          isSelf={isSelf}
          friendLabel={friendMeta.label}
          friendIcon={friendMeta.icon}
          actionLoading={actionLoading}
          primary={primary}
          foreground={foreground}
          onFriendAction={handleFriendAction}
          onEditProfile={() => router.push("/(main)/(profile)")}
          onMessage={() => router.push("/(main)/(chat)")}
        />

        <View className="border-b border-border/50 bg-card">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12 }}
          >
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                className={`mr-2 flex-row items-center gap-1.5 rounded-full px-4 py-2.5 ${
                  activeTab === tab.key ? "bg-primary" : "bg-muted/60"
                }`}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.key ? "#fff" : muted}
                />
                <Text
                  className={`text-sm font-semibold ${
                    activeTab === tab.key ? "text-white" : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="px-4 pt-4">
          <ProfileIntro createdAt={profile.createdAt} />
          <PhotoPreview mediaUrls={mediaUrls} onPressAll={() => setActiveTab("photos")} />
          {isSelf ? (
            <FriendsPreview
              friends={friends}
              loading={friendsLoading}
              onPressAll={() => setActiveTab("friends")}
            />
          ) : null}

          {activeTab === "posts" ? (
            <PostsSection
              posts={posts}
              loading={postsLoading}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              onCreatePost={isSelf ? () => router.push("/(main)/(newsfeed)/editor/new") : undefined}
            />
          ) : null}
          {activeTab === "about" ? (
            <AboutSection bio={profile.bio} createdAt={profile.createdAt} />
          ) : null}
          {activeTab === "reels" ? <ReelsSection reels={reels} loading={reelsLoading} /> : null}
          {activeTab === "photos" ? <PhotosSection mediaUrls={mediaUrls} /> : null}
          {activeTab === "friends" ? (
            <FriendsSection friends={friends} loading={friendsLoading} isSelf={isSelf} />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileHero({
  displayName,
  avatar,
  bio,
  postsCount,
  friendsCount,
  isSelf,
  friendLabel,
  friendIcon,
  actionLoading,
  primary,
  foreground,
  onFriendAction,
  onEditProfile,
  onMessage,
}: {
  displayName: string;
  avatar: string | null;
  bio: string | null;
  postsCount: number;
  friendsCount?: number;
  isSelf: boolean;
  friendLabel: string;
  friendIcon: ComponentProps<typeof Ionicons>["name"];
  actionLoading: boolean;
  primary: string;
  foreground: string;
  onFriendAction: () => void;
  onEditProfile: () => void;
  onMessage: () => void;
}) {
  return (
    <View className="bg-card">
      <View className="h-44 bg-primary">
        <View className="h-full w-full opacity-30" style={{ backgroundColor: "#0f172a" }} />
      </View>
      <View className="px-4 pb-5">
        <View className="-mt-16 flex-row items-end justify-between gap-3">
          <View className="size-32 items-center justify-center overflow-hidden rounded-full border-4 border-card bg-muted">
            {avatar ? (
              <Image source={{ uri: avatar }} className="size-full" resizeMode="cover" />
            ) : (
              <Text className="text-4xl font-bold text-muted-foreground">
                {getInitials(displayName)}
              </Text>
            )}
          </View>
          <View className="mb-2 flex-row gap-2">
            {isSelf ? (
              <Pressable
                onPress={onEditProfile}
                className="flex-row items-center gap-2 rounded-full bg-primary px-4 py-2.5 active:opacity-80"
              >
                <Ionicons name="pencil" size={16} color="#fff" />
                <Text className="font-semibold text-white">Chỉnh sửa</Text>
              </Pressable>
            ) : (
              <>
                <Pressable
                  onPress={onFriendAction}
                  disabled={actionLoading}
                  className="flex-row items-center gap-2 rounded-full bg-primary px-4 py-2.5 active:opacity-80 disabled:opacity-60"
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name={friendIcon} size={16} color="#fff" />
                  )}
                  <Text className="font-semibold text-white">{friendLabel}</Text>
                </Pressable>
                <Pressable
                  onPress={onMessage}
                  className="size-11 items-center justify-center rounded-full bg-muted active:opacity-80"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={foreground} />
                </Pressable>
              </>
            )}
          </View>
        </View>
        <Text className="mt-3 text-2xl font-bold text-foreground" numberOfLines={1}>
          {displayName}
        </Text>
        <Text className="mt-1 text-sm leading-5 text-muted-foreground">
          {bio?.trim() || "Chưa có tiểu sử."}
        </Text>
        <View className="mt-4 flex-row gap-3">
          <StatPill
            icon="heart-outline"
            label="Bài viết"
            value={String(postsCount)}
            color={primary}
          />
          <StatPill
            icon="people-outline"
            label={friendsCount === undefined ? "Hồ sơ" : "Bạn bè"}
            value={friendsCount === undefined ? "Cá nhân" : String(friendsCount)}
            color={primary}
          />
        </View>
      </View>
    </View>
  );
}

function StatPill({
  icon,
  label,
  value,
  color,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="min-w-0 flex-1 rounded-2xl bg-muted/40 p-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon} size={17} color={color} />
        <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
      </View>
      <Text className="mt-1 text-base font-bold text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ProfileIntro({ createdAt }: { createdAt?: string | null }) {
  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-4">
      <Text className="text-lg font-bold text-foreground">Thông tin cá nhân</Text>
      <InfoRow icon="briefcase-outline" text="Thành viên Zalogram" />
      <InfoRow icon="location-outline" text="Việt Nam" />
      <InfoRow icon="calendar-outline" text={`Tham gia ${formatJoinDate(createdAt)}`} />
    </View>
  );
}

function InfoRow({ icon, text }: { icon: ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View className="mt-3 flex-row items-center gap-3">
      <Ionicons name={icon} size={20} color="hsl(var(--muted-foreground) / 1)" />
      <Text className="flex-1 text-sm text-foreground">{text}</Text>
    </View>
  );
}

function PhotoPreview({ mediaUrls, onPressAll }: { mediaUrls: string[]; onPressAll: () => void }) {
  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-foreground">Ảnh</Text>
        <Pressable onPress={onPressAll}>
          <Text className="text-sm font-semibold text-primary">Xem tất cả</Text>
        </Pressable>
      </View>
      {mediaUrls.length ? (
        <View className="flex-row flex-wrap gap-2">
          {mediaUrls.slice(0, 6).map((url) => (
            <Image key={url} source={{ uri: url }} className="aspect-square w-[31%] rounded-xl" />
          ))}
        </View>
      ) : (
        <EmptyBlock icon="images-outline" text="Chưa có ảnh" />
      )}
    </View>
  );
}

function FriendsPreview({
  friends,
  loading,
  onPressAll,
}: {
  friends: FriendListItem[];
  loading: boolean;
  onPressAll: () => void;
}) {
  return (
    <View className="mb-4 rounded-2xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-foreground">Bạn bè</Text>
          <Text className="text-xs text-muted-foreground">{friends.length} người bạn</Text>
        </View>
        <Pressable onPress={onPressAll}>
          <Text className="text-sm font-semibold text-primary">Xem tất cả</Text>
        </Pressable>
      </View>
      <FriendsGrid friends={friends.slice(0, 6)} loading={loading} />
    </View>
  );
}

function PostsSection({
  posts,
  loading,
  viewMode,
  onChangeViewMode,
  onCreatePost,
}: {
  posts: Parameters<typeof FeedPostCard>[0]["post"][];
  loading: boolean;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  onCreatePost?: () => void;
}) {
  return (
    <View>
      {onCreatePost ? (
        <Pressable
          onPress={onCreatePost}
          className="mb-4 flex-row items-center gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-80"
        >
          <View className="size-10 items-center justify-center rounded-full bg-primary/10">
            <Ionicons name="add" size={22} color="hsl(var(--primary) / 1)" />
          </View>
          <Text className="flex-1 text-sm font-semibold text-muted-foreground">
            Bạn đang nghĩ gì?
          </Text>
        </Pressable>
      ) : null}

      <View className="mb-4 rounded-2xl border border-border bg-card p-3">
        <View className="mb-3 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-foreground">Bài viết</Text>
          <View className="flex-row rounded-full bg-muted/60 p-1">
            <SegmentButton
              icon="list-outline"
              active={viewMode === "list"}
              onPress={() => onChangeViewMode("list")}
            />
            <SegmentButton
              icon="grid-outline"
              active={viewMode === "grid"}
              onPress={() => onChangeViewMode("grid")}
            />
          </View>
        </View>
      </View>

      {loading ? (
        <LoadingBlocks />
      ) : posts.length ? (
        viewMode === "list" ? (
          <View>
            {posts.map((post) => (
              <FeedPostCard key={post.postId} post={post} />
            ))}
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3">
            {posts.map((post) => (
              <View
                key={post.postId}
                className="aspect-square w-[47%] overflow-hidden rounded-2xl bg-card"
              >
                {post.mediaUrls?.[0] ? (
                  <Image
                    source={{ uri: post.mediaUrls[0] }}
                    className="size-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="size-full items-center justify-center bg-muted/50 p-4">
                    <Text className="text-center text-sm text-muted-foreground" numberOfLines={5}>
                      {post.content}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )
      ) : (
        <EmptyBlock icon="newspaper-outline" text="Chưa có bài viết nào để hiển thị." />
      )}
    </View>
  );
}

function SegmentButton({
  icon,
  active,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`size-9 items-center justify-center rounded-full ${active ? "bg-primary" : ""}`}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? "#fff" : "hsl(var(--muted-foreground) / 1)"}
      />
    </Pressable>
  );
}

function AboutSection({ bio, createdAt }: { bio: string | null; createdAt?: string | null }) {
  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <Text className="text-xl font-bold text-foreground">Giới thiệu</Text>
      <Text className="mt-3 text-sm leading-6 text-muted-foreground">
        {bio?.trim() || "Chưa có tiểu sử."}
      </Text>
      <View className="mt-4 rounded-xl bg-muted/40 p-3">
        <Text className="text-xs font-semibold text-muted-foreground">Ngày tham gia</Text>
        <Text className="mt-1 font-semibold text-foreground">{formatJoinDate(createdAt)}</Text>
      </View>
    </View>
  );
}

function ReelsSection({
  reels,
  loading,
}: {
  reels: { reelId: string; thumbnailUrl: string | null; caption: string }[];
  loading: boolean;
}) {
  if (loading) return <LoadingBlocks />;
  if (!reels.length) return <EmptyBlock icon="play-circle-outline" text="Chưa có reel nào." />;
  return (
    <View className="flex-row flex-wrap gap-3">
      {reels.map((reel) => (
        <View
          key={reel.reelId}
          className="aspect-[9/16] w-[47%] overflow-hidden rounded-2xl bg-slate-900"
        >
          {reel.thumbnailUrl ? (
            <Image source={{ uri: reel.thumbnailUrl }} className="size-full" resizeMode="cover" />
          ) : (
            <View className="size-full items-center justify-center p-3">
              <Ionicons name="play" size={30} color="#fff" />
              <Text className="mt-2 text-center text-xs text-white" numberOfLines={3}>
                {reel.caption || "Reel"}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function PhotosSection({ mediaUrls }: { mediaUrls: string[] }) {
  if (!mediaUrls.length) return <EmptyBlock icon="images-outline" text="Chưa có ảnh." />;
  return (
    <View className="flex-row flex-wrap gap-2">
      {mediaUrls.map((url) => (
        <Image key={url} source={{ uri: url }} className="aspect-square w-[31%] rounded-xl" />
      ))}
    </View>
  );
}

function FriendsSection({
  friends,
  loading,
  isSelf,
}: {
  friends: FriendListItem[];
  loading: boolean;
  isSelf: boolean;
}) {
  if (!isSelf) return <EmptyBlock icon="lock-closed-outline" text="Chỉ hiển thị với chủ hồ sơ." />;
  return <FriendsGrid friends={friends} loading={loading} />;
}

function FriendsGrid({ friends, loading }: { friends: FriendListItem[]; loading: boolean }) {
  const router = useRouter();
  if (loading) return <LoadingBlocks />;
  if (!friends.length) return <EmptyBlock icon="people-outline" text="Chưa có dữ liệu bạn bè." />;
  return (
    <View className="flex-row flex-wrap gap-3">
      {friends.map((friend) => (
        <Pressable
          key={friend.userId}
          onPress={() => router.push(`/(main)/(newsfeed)/user/${friend.userId}`)}
          className="w-[30%] active:opacity-80"
        >
          <View className="aspect-square items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {friend.avatar ? (
              <Image source={{ uri: friend.avatar }} className="size-full" resizeMode="cover" />
            ) : (
              <Text className="text-xl font-bold text-muted-foreground">
                {getInitials(friend.displayName)}
              </Text>
            )}
          </View>
          <Text className="mt-1 text-xs font-semibold text-foreground" numberOfLines={1}>
            {friend.displayName}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function EmptyBlock({
  icon,
  text,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View className="items-center justify-center rounded-2xl border border-border bg-card p-8">
      <Ionicons name={icon} size={30} color="hsl(var(--muted-foreground) / 1)" />
      <Text className="mt-2 text-center text-sm text-muted-foreground">{text}</Text>
    </View>
  );
}

function LoadingBlocks() {
  return (
    <View className="gap-3">
      {[0, 1].map((item) => (
        <View key={item} className="h-36 rounded-2xl bg-muted/60" />
      ))}
    </View>
  );
}

export default PublicProfilePage;
