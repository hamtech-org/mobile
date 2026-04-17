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
    <View className="flex-1 items-center justify-center px-8 gap-4 py-12">
      {/* Icon container */}
      <View className="size-20 rounded-full bg-muted items-center justify-center">
        <Icon size={36} color={muted} strokeWidth={1.2} />
      </View>

      {/* Text content */}
      <View className="gap-1.5 items-center">
        <Text className="text-foreground text-base font-semibold text-center">{title}</Text>
        {description ? <Text className="text-muted-foreground text-sm text-center leading-5">{description}</Text> : null}
      </View>

      {/* Optional action button */}
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" /> : null}
    </View>
  );
};
