import { Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, Eye } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { getLiveCategoryLabel, type LiveSessionListItem } from "@/store/api/liveApi";
import { formatLiveDuration, resolveLiveCoverBackground } from "@/utils/liveSessionUtils";
import { normalizeMediaUrl } from "@/utils/url";

interface LiveSessionCardProps {
  session: LiveSessionListItem;
  durationNowMs: number;
}

export function LiveSessionCard({ session, durationNowMs }: LiveSessionCardProps) {
  const cover = resolveLiveCoverBackground({
    coverImageUrl: session.coverImageUrl,
    coverColor: session.coverColor,
    hostUserId: session.hostUserId,
  });
  const duration = formatLiveDuration(session.startedAt, durationNowMs);
  const categoryLabel = getLiveCategoryLabel(session.category);

  const onJoin = () => {
    router.push(`/(main)/(live)/${session.sessionId}/watch`);
  };

  return (
    <View className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
      <View className="relative aspect-video w-full overflow-hidden">
        {cover.type === "image" ? (
          <Image
            source={{ uri: normalizeMediaUrl(cover.url) }}
            className="absolute inset-0 h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="absolute inset-0" style={{ backgroundColor: cover.color }} />
        )}
        <View className="absolute inset-0 bg-black/25" />

        <View className="absolute left-3 top-3 flex-row items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5">
          <View className="size-1.5 rounded-full bg-white" />
          <Text className="text-[10px] font-bold uppercase tracking-wide text-white">Live</Text>
        </View>

        <View className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-0.5">
          <Text className="text-[10px] font-medium text-white">{categoryLabel}</Text>
        </View>

        <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between px-3 py-2.5">
          <View className="flex-row items-center gap-1.5">
            <Eye size={14} color="#fff" />
            <Text className="text-xs font-medium text-white">{session.viewerCount} đang xem</Text>
          </View>
          <Text className="font-mono text-xs text-white">{duration}</Text>
        </View>
      </View>

      <View className="gap-3 p-4">
        <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
          {session.title}
        </Text>

        <View className="flex-row items-center gap-2.5">
          <Avatar
            uri={normalizeMediaUrl(session.hostAvatar)}
            name={session.hostDisplayName}
            size="sm"
          />
          <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>
            {session.hostDisplayName}
          </Text>
        </View>

        <Pressable
          onPress={onJoin}
          className="flex-row items-center justify-center gap-1 rounded-xl border border-border py-2.5 active:bg-muted/50"
        >
          <Text className="text-sm font-medium text-primary">Tham gia phòng</Text>
          <ChevronRight size={16} color="hsl(214 100% 50%)" />
        </Pressable>
      </View>
    </View>
  );
}
