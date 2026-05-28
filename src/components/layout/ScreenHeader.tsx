import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { safeRouterBack } from "@/utils/navigation";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface HeaderAction {
  /** Ionicons icon name */
  icon: IoniconName;
  onPress: () => void;
  /** Label dùng cho accessibility */
  accessibilityLabel?: string;
}

interface ScreenHeaderProps {
  title: string;
  /** Subtitle - hiện dưới title, dùng cho online status / số thành viên */
  subtitle?: string;
  /** Nếu undefined, ẩn nút back (màn hình root) */
  onBack?: () => void;
  /** Các nút action phải header (tối đa 3) */
  rightActions?: HeaderAction[];
  /** Slot tùy chỉnh bên phải (ưu tiên hơn rightActions) */
  rightSlot?: React.ReactNode;
  /** Component custom thay thế title (ví dụ: Avatar + tên cho chat header) */
  titleContent?: React.ReactNode;
  /** Hiển thị shortcut Trợ lý HAMTECH ở header */
  showAiButton?: boolean;
}

/**
 * ScreenHeader — header chuẩn hóa cho tất cả screens Hamtech.
 * Tuân theo mobile-ui.md pattern:
 * - border-b border-border/40
 * - Back button Android với Ionicons
 * - Slot rightActions tối đa 3 icon buttons
 */
export const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  rightActions = [],
  rightSlot,
  titleContent,
  showAiButton = false,
}: ScreenHeaderProps) => {
  const handleBack = onBack ?? (() => safeRouterBack("/(main)"));
  const handleOpenAssistant = () => {
    router.push("/(main)/ai-assistant");
  };

  return (
    <View className="flex-row items-center gap-3 border-b border-border/40 bg-background px-4 py-3">
      {/* Nút back — chỉ hiển thị khi có onBack hoặc không phải root screen */}
      {onBack !== undefined ? (
        <Pressable
          onPress={handleBack}
          className="-ml-1 p-1 active:opacity-70"
          hitSlop={8}
          accessibilityLabel="Quay lại"
        >
          <Ionicons name="arrow-back" size={24} color="hsl(var(--foreground) / 1)" />
        </Pressable>
      ) : null}

      {/* Title area — custom content hoặc text */}
      <View className="flex-1">
        {titleContent ?? (
          <>
            <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {showAiButton ? (
        <Pressable
          onPress={handleOpenAssistant}
          className="rounded-full bg-primary/10 p-2 active:opacity-70"
          hitSlop={6}
          accessibilityLabel="Mở Trợ lý HAMTECH"
        >
          <Ionicons name="sparkles-outline" size={22} color="hsl(var(--primary) / 1)" />
        </Pressable>
      ) : null}
      {rightSlot ? (
        <View className="flex-row items-center">{rightSlot}</View>
      ) : rightActions.length > 0 ? (
        <View className="flex-row items-center gap-1">
          {rightActions.map((action, index) => (
            <Pressable
              key={index}
              onPress={action.onPress}
              className="rounded-full p-2 active:opacity-70"
              hitSlop={6}
              accessibilityLabel={action.accessibilityLabel}
            >
              <Ionicons name={action.icon} size={22} color="hsl(var(--foreground) / 1)" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};
