import { Image, Text, View } from "react-native";
import type { ISharedPostInfo } from "@/types/newsfeed.types";
import { formatRelativeTime } from "@/utils/time";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import { HashtagText } from "./HashtagText";

interface Props {
  sharedFrom: ISharedPostInfo;
}

export const SharedPostPreview = ({ sharedFrom }: Props) => {
  const displayName = sharedFrom.author?.displayName ?? sharedFrom.authorId;
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <View className="mt-2 overflow-hidden rounded-xl border border-border/40 bg-muted/30">
      {/* Author row */}
      <View className="flex-row items-center gap-2 px-3 py-2">
        <View className="size-7 items-center justify-center overflow-hidden rounded-full bg-muted/60">
          {sharedFrom.author?.avatar ? (
            <Image
              source={{ uri: sharedFrom.author.avatar }}
              className="h-full w-full"
              resizeMode="cover"
            />
          ) : (
            <Text className="text-xs font-bold text-muted-foreground">{initial}</Text>
          )}
        </View>
        <View>
          <Text className="text-sm font-semibold">{displayName}</Text>
          <Text className="text-xs text-muted-foreground">
            {formatRelativeTime(sharedFrom.createdAt)}
          </Text>
        </View>
      </View>

      {/* Content */}
      {sharedFrom.content ? (
        <View className="px-3 pb-2">
          {(() => {
            const text = extractTextFromTiptapJson(sharedFrom.content);
            return <HashtagText text={text.slice(0, 200) + (text.length > 200 ? "…" : "")} />;
          })()}
        </View>
      ) : null}

      {/* First media thumbnail */}
      {sharedFrom.mediaUrls && sharedFrom.mediaUrls.length > 0 && (
        <View className="relative aspect-video w-full bg-black/5">
          <Image
            source={{ uri: sharedFrom.mediaUrls[0] }}
            className="h-full w-full"
            resizeMode="cover"
          />
          {sharedFrom.mediaUrls.length > 1 && (
            <View className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5">
              <Text className="text-xs text-white">+{sharedFrom.mediaUrls.length - 1}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
