import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ReelItem } from "@/features/newsfeed/constants/newsfeed.constants";

interface Props {
  reels: ReelItem[];
}

export const ReelsStrip = ({ reels }: Props) => (
  <View className="pb-2">
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10 }}
    >
      <Pressable className="w-[126px] overflow-hidden rounded-2xl bg-card">
        <View className="h-[160px] items-center justify-center bg-muted/70">
          <View className="size-14 rounded-full bg-primary/20" />
        </View>
        <View className="absolute bottom-10 left-1/2 size-8 -translate-x-1/2 items-center justify-center rounded-full border-2 border-background bg-blue-600">
          <Ionicons name="add" size={18} color="#fff" />
        </View>
        <Text className="bg-background/70 py-2 text-center text-xs font-bold text-foreground">
          Tạo tin
        </Text>
      </Pressable>

      {reels.map((reel) => (
        <Pressable
          key={reel.id}
          className="relative h-[200px] w-[126px] overflow-hidden rounded-2xl"
        >
          <Image source={{ uri: reel.thumbnail }} className="h-full w-full" resizeMode="cover" />
          <View className="absolute inset-0 bg-black/35" />
          <View className="absolute left-2 top-2 size-8 rounded-full border-2 border-blue-500 bg-card/40" />
          <View className="absolute bottom-2 left-2 right-2">
            <View className="flex-row items-center gap-1">
              <Ionicons name="play" size={12} color="#fff" />
              <Text className="text-[11px] font-bold text-white">{reel.views}</Text>
            </View>
            <Text className="mt-1 text-sm font-bold text-white" numberOfLines={2}>
              {reel.name}
            </Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  </View>
);
