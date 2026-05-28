import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const AUTH_SLOGANS = [
  "Nhắn tin mọi lúc, riêng tư mọi nơi.",
  "Trò chuyện thật, kết nối thật.",
  "Gửi gắm tin nhắn, yên tâm từng chữ.",
] as const;

export const AuthHero = () => {
  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      className="-mx-6 gap-3 rounded-3xl border border-white/25 bg-background/70 px-6 pb-7 pt-4 dark:border-white/10 dark:bg-card/55"
    >
      <Text
        accessibilityRole="header"
        className="text-3xl font-extrabold tracking-tighter text-foreground"
      >
        Hamtech
      </Text>
      <View className="flex-row items-start gap-2 self-stretch rounded-2xl bg-muted/90 px-3 py-3 dark:bg-muted/70">
        <Ionicons
          name="shield-checkmark-outline"
          size={14}
          color="hsl(var(--primary) / 1)"
          style={{ marginTop: 2 }}
        />
        <View className="min-w-0 flex-1 gap-2">
          {AUTH_SLOGANS.map((line) => (
            <Text key={line} className="text-xs font-medium leading-snug text-muted-foreground">
              {line}
            </Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
};
