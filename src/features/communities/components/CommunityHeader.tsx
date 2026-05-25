import { Image, Pressable, Text, View } from "react-native";
import {
  Globe2,
  Lock,
  Plus,
  ShieldCheck,
  MessageSquare,
  UserPlus,
  Sparkles,
} from "lucide-react-native";
import { type ICommunity } from "@/types/community.types";
import { useIconColors } from "@/hooks/useIconColors";
import { normalizeMediaUrl } from "@/utils/url";
import { CATEGORY_LABEL, type TabKey } from "../constants";
import { canManage } from "../utils/helpers";
import { TabButton } from "./TabButton";

const defaultAvatarGroup = require("../../../../assets/images/avatar-group-default.jpg");
const defaultCoverGroup = require("../../../../assets/images/cover-group-default.jpg");

export interface CommunityHeaderProps {
  community: ICommunity;
  isMember: boolean;
  joining: boolean;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  onJoin: () => void;
  onPost: () => void;
  onChatPress?: () => void;
  chatEnabled?: boolean;
  joiningChat?: boolean;
  canInvite?: boolean;
  onInvitePress?: () => void;
  onAcceptInvite?: () => void;
  onDeclineInvite?: () => void;
  inviteLoading?: boolean;
}

export function CommunityHeader({
  community,
  isMember,
  joining,
  tab,
  setTab,
  onJoin,
  onPost,
  onChatPress,
  chatEnabled,
  joiningChat,
  canInvite,
  onInvitePress,
  onAcceptInvite,
  onDeclineInvite,
  inviteLoading,
}: CommunityHeaderProps) {
  const { primary } = useIconColors();

  const normalizedCover = normalizeMediaUrl(community.coverUrl);
  const normalizedAvatar = normalizeMediaUrl(community.avatar);

  return (
    <View className="gap-5">
      {/* Cover Image Container */}
      <View
        className="relative w-full overflow-hidden rounded-b-[32px] bg-muted/20"
        style={{ height: 210 }}
      >
        <Image
          source={normalizedCover ? { uri: normalizedCover } : defaultCoverGroup}
          className="size-full"
          resizeMode="cover"
        />
        {/* Top gradient overlay to ensure white icons are visible */}
        <View className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent" />
      </View>

      {community.viewerInviteStatus === "pending" && (
        <View className="mx-4 mt-1 flex-row items-center justify-between gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="size-10 items-center justify-center rounded-xl bg-blue-600/10">
              <Sparkles size={20} color="#2563eb" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-bold text-foreground">Bạn được mời tham gia!</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
                Hãy tham gia ngay để bắt đầu trò chuyện và thảo luận cùng mọi người.
              </Text>
            </View>
          </View>
          <View className="shrink-0 flex-row gap-2">
            <Pressable
              onPress={onDeclineInvite}
              disabled={inviteLoading}
              className="rounded-xl bg-muted/40 px-3 py-2 active:bg-muted/70"
            >
              <Text className="text-xs font-bold text-foreground">Từ chối</Text>
            </Pressable>
            <Pressable
              onPress={onAcceptInvite}
              disabled={inviteLoading}
              className="rounded-xl bg-blue-600 px-3.5 py-2 active:bg-blue-700"
            >
              <Text className="text-xs font-bold text-white">Đồng ý</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Community Main Info */}
      <View className="gap-4 px-4">
        {/* Avatar & Title Row */}
        <View className="flex-row items-end gap-4">
          <View
            className="-mt-16 size-24 items-center justify-center border-4 border-background bg-card shadow-2xl"
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              overflow: "hidden",
              elevation: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
            }}
          >
            <Image
              source={normalizedAvatar ? { uri: normalizedAvatar } : defaultAvatarGroup}
              className="size-full"
              style={{ width: "100%", height: "100%", borderRadius: 48 }}
              resizeMode="cover"
            />
          </View>

          <View className="min-w-0 flex-1 pb-1">
            <View className="flex-row items-center gap-1.5">
              <Text
                className="flex-1 text-2xl font-extrabold tracking-tight text-foreground"
                numberOfLines={1}
              >
                {community.name}
              </Text>
              {canManage(community.viewerRole) && (
                <ShieldCheck size={20} color={primary} className="mt-1" />
              )}
            </View>

            <View className="mt-1 flex-row items-center gap-2">
              <View className="rounded-full bg-primary/10 px-2.5 py-0.5">
                <Text className="text-[11px] font-bold text-primary">
                  {CATEGORY_LABEL[community.category]}
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                {community.type === "private" ? (
                  <Lock size={12} color="#71717a" />
                ) : (
                  <Globe2 size={12} color="#71717a" />
                )}
                <Text className="text-xs text-muted-foreground">
                  {community.type === "public" ? "Công khai" : "Riêng tư"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description */}
        <Text className="text-[14px] leading-relaxed text-muted-foreground">
          {community.description ||
            "Cộng đồng chưa có mô tả. Chào mừng bạn tham gia không gian thảo luận này!"}
        </Text>

        {/* Stats Row (Premium horizontal redesign) */}
        <View className="flex-row items-center justify-around rounded-2xl border border-border/30 bg-muted/40 py-3.5">
          <View className="flex-1 items-center">
            <Text className="text-lg font-extrabold text-foreground">{community.memberCount}</Text>
            <Text className="mt-0.5 text-[11px] font-medium text-muted-foreground">thành viên</Text>
          </View>
          <View className="h-6 w-[1px] bg-border/40" />
          <View className="flex-1 items-center">
            <Text className="text-lg font-extrabold text-foreground">{community.postCount}</Text>
            <Text className="mt-0.5 text-[11px] font-medium text-muted-foreground">bài viết</Text>
          </View>
        </View>

        {/* Action Button */}
        {isMember ? (
          chatEnabled ? (
            <View className="flex-row gap-3">
              <Pressable
                onPress={onPost}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl border border-border/25 bg-muted py-3.5 transition-all active:scale-95"
              >
                <Plus size={18} color="#71717a" strokeWidth={2.5} />
                <Text className="text-[15px] font-bold text-foreground">Đăng bài</Text>
              </Pressable>
              <Pressable
                onPress={onChatPress}
                disabled={joiningChat}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-60"
              >
                <MessageSquare size={18} color="#fff" strokeWidth={2.5} />
                <Text className="text-[15px] font-bold text-primary-foreground">Trò chuyện</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={onPost}
              className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 shadow-lg shadow-primary/20 transition-all active:scale-95"
            >
              <Plus size={18} color="#fff" strokeWidth={2.5} />
              <Text className="text-[15px] font-bold text-primary-foreground">
                Đăng bài viết mới
              </Text>
            </Pressable>
          )
        ) : (
          <Pressable
            disabled={joining || community.joinRequestStatus === "pending"}
            onPress={onJoin}
            className="rounded-2xl bg-primary py-3.5 shadow-lg shadow-primary/25 transition-all active:scale-95 disabled:opacity-60"
          >
            <Text className="text-center text-[15px] font-bold text-primary-foreground">
              {community.joinRequestStatus === "pending"
                ? "Đang chờ duyệt yêu cầu..."
                : "Tham gia cộng đồng"}
            </Text>
          </Pressable>
        )}
        {canInvite && (
          <Pressable
            onPress={onInvitePress}
            className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-600/10 py-3.5 transition-all active:scale-95"
          >
            <UserPlus size={16} color="#2563eb" strokeWidth={2.5} />
            <Text className="text-[15px] font-bold text-blue-600">Mời bạn bè tham gia</Text>
          </Pressable>
        )}
      </View>

      {/* Tab Control */}
      <View className="px-4">
        <View className="flex-row rounded-full bg-muted/60 p-1">
          <TabButton active={tab === "posts"} label="Bài viết" onPress={() => setTab("posts")} />
          <TabButton active={tab === "about"} label="Giới thiệu" onPress={() => setTab("about")} />
        </View>
      </View>
    </View>
  );
}
