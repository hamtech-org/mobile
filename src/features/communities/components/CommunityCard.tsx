import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { type ICommunity } from "@/types/community.types";
import { CATEGORY_LABEL } from "../constants";
import { normalizeMediaUrl } from "@/utils/url";

const defaultAvatarGroup = require("../../../../assets/images/avatar-group-default.jpg");

export function CommunityCard({ item }: { item: ICommunity }) {
  const isSearchItem = !(item as any).isActive && !(item as any).ownerId;
  const postCount = isSearchItem ? 0 : (item.postCount ?? 0);

  const normalizedAvatar = normalizeMediaUrl(item.avatar);

  return (
    <Pressable
      onPress={() => router.push(`/(main)/(communities)/${item.groupId}`)}
      className="flex-row items-center rounded-2xl border border-border bg-card p-3 active:opacity-80"
    >
      <View style={{ width: 48, height: 48, borderRadius: 24, overflow: "hidden" }}>
        <Image
          source={normalizedAvatar ? { uri: normalizedAvatar } : defaultAvatarGroup}
          className="size-full bg-muted"
          style={{ width: "100%", height: "100%", borderRadius: 24 }}
          resizeMode="cover"
        />
      </View>
      <View className="ml-3 min-w-0 flex-1 gap-0.5">
        <Text className="text-base font-bold text-card-foreground" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {item.description || "Cộng đồng chưa có mô tả."}
        </Text>
        <Text className="text-[11px] text-muted-foreground">
          {item.memberCount ?? 0} thành viên • {postCount} bài viết
        </Text>
      </View>
      <View className="ml-2 rounded-full bg-muted px-2.5 py-0.5">
        <Text className="text-[10px] font-semibold text-muted-foreground">
          {CATEGORY_LABEL[item.category] || "Chung"}
        </Text>
      </View>
    </Pressable>
  );
}
