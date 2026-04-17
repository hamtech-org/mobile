import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useIconColors } from "@/hooks/useIconColors";
import { Button } from "@/components/common/Button";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

interface EmptyStateProps {
  /** Ionicons icon name */
  icon: IoniconName;
  title: string;
  description?: string;
  /** Nút hành động tùy chọn */
  action?: EmptyStateAction;
}

/**
 * EmptyState — hiển thị trạng thái rỗng cho list, search, feed...
 * Dùng trong ListEmptyComponent của FlatList.
 */
export const EmptyState = ({ icon, title, description, action }: EmptyStateProps) => {
  const { muted } = useIconColors();
  return (
    <View className="flex-1 items-center justify-center px-8 gap-4 py-12">
      {/* Icon container */}
      <View className="size-20 rounded-full bg-muted items-center justify-center">
        <Ionicons name={icon} size={36} color={muted} />
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
