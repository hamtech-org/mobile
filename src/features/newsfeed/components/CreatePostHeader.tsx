import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  name: string;
  avatar: string;
  initial: string;
  onPressCreate: () => void;
}

export const CreatePostHeader = ({ name, avatar, initial, onPressCreate }: Props) => (
  <View className="px-4 pb-2">
    <View className="rounded-3xl border border-border/40 bg-card px-3 py-3">
      <View className="flex-row items-center gap-3">
        <View className="size-10 items-center justify-center overflow-hidden rounded-full bg-muted/40">
          {avatar ? (
            <Image source={{ uri: avatar }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-sm font-bold text-muted-foreground">{initial}</Text>
          )}
        </View>
        <Pressable onPress={onPressCreate} className="flex-1 rounded-full bg-muted/50 px-4 py-2.5">
          <Text className="text-sm text-muted-foreground">{name} ơi, bạn đang nghĩ gì thế?</Text>
        </Pressable>
        <Ionicons name="videocam" size={20} color="#e11d48" />
        <Ionicons name="image" size={20} color="#16a34a" />
        <Ionicons name="happy" size={20} color="#f59e0b" />
      </View>
    </View>
  </View>
);
