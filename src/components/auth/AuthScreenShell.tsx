import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthHero } from "./AuthHero";
import { safeRouterBack } from "@/utils/navigation";

interface AuthScreenShellProps {
  title: string;
  description?: string;
  badge?: string;
  /** Mặc định true — ẩn trên OTP nếu cần tập trung. */
  showHero?: boolean;
  /** Mặc định: hiện nút back khi stack có thể quay lại. */
  showBack?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

export const AuthScreenShell = ({
  title,
  description,
  badge,
  showHero = true,
  showBack,
  footer,
  children,
}: AuthScreenShellProps) => {
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const resolvedShowBack = showBack ?? canGoBack;

  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow px-6 py-8 gap-6"
          showsVerticalScrollIndicator={false}
        >
          {resolvedShowBack ? (
            <Pressable
              onPress={() => safeRouterBack("/(auth)/login")}
              className="flex-row items-center gap-1 self-start py-2 pr-3 active:opacity-70"
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
            >
              <Ionicons name="chevron-back" size={22} color="hsl(var(--foreground) / 1)" />
              <Text className="text-foreground text-base">Quay lại</Text>
            </Pressable>
          ) : null}

          {showHero ? <AuthHero /> : null}

          <View className="bg-card rounded-3xl border border-border/40 p-6 gap-6">
            {badge ? (
              <View className="self-start rounded-lg bg-muted px-3 py-1">
                <Text className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{badge}</Text>
              </View>
            ) : null}
            <View className="gap-2">
              <Text className="text-3xl font-bold text-foreground">{title}</Text>
              {description ? <Text className="text-base leading-relaxed text-muted-foreground">{description}</Text> : null}
            </View>
            {children}
          </View>
          {footer ? <View className="pb-4">{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
