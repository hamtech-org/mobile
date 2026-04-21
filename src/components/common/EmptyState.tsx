import { Text, View } from "react-native";
import { LucideIcon } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import { Button } from "@/components/common/Button";

interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

interface EmptyStateProps {
  /** Lucide icon component */
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Nút hành động tùy chọn */
  action?: EmptyStateAction;
}

/**
 * EmptyState — hiển thị trạng thái rỗng cho list, search, feed...
 * Dùng trong ListEmptyComponent của FlatList.
 */
export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => {
  const { muted } = useIconColors();
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8 py-12">
      {/* Icon container */}
      <View className="size-20 items-center justify-center rounded-full bg-muted">
        <Icon size={36} color={muted} strokeWidth={1.2} />
      </View>

      {/* Text content */}
      <View className="items-center gap-1.5">
        <Text className="text-center text-base font-semibold text-foreground">{title}</Text>
        {description ? (
          <Text className="text-center text-sm leading-5 text-muted-foreground">{description}</Text>
        ) : null}
      </View>

      {/* Optional action button */}
      {action ? (
        <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" />
      ) : null}
    </View>
  );
};
