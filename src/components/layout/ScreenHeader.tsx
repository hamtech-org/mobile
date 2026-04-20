import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  /** Component custom thay thế title (ví dụ: Avatar + tên cho chat header) */
  titleContent?: React.ReactNode;
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
  titleContent,
}: ScreenHeaderProps) => {
  const handleBack = onBack ?? (() => safeRouterBack("/(main)"));

  return (
    <View className="px-4 py-3 border-b border-border/40 bg-background flex-row items-center gap-3">
      {/* Nút back — chỉ hiển thị khi có onBack hoặc không phải root screen */}
      {onBack !== undefined ? (
        <Pressable
          onPress={handleBack}
          className="active:opacity-70 p-1 -ml-1"
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
            <Text
              className="text-foreground text-lg font-bold"
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* Right action buttons */}
      {rightActions.length > 0 ? (
        <View className="flex-row items-center gap-1">
          {rightActions.map((action, index) => (
            <Pressable
              key={index}
              onPress={action.onPress}
              className="p-2 active:opacity-70 rounded-full"
              hitSlop={6}
              accessibilityLabel={action.accessibilityLabel}
            >
              <Ionicons
                name={action.icon}
                size={22}
                color="hsl(var(--foreground) / 1)"
              />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
};
