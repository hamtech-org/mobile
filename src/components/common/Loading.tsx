import { ActivityIndicator, Text, View } from "react-native";

interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
}

export const Loading = ({ fullScreen = false, message = "Đang tải..." }: LoadingProps) => {
  return (
    <View className={fullScreen ? "flex-1 bg-background items-center justify-center gap-3" : "items-center gap-2"}>
      <ActivityIndicator size="large" />
      <Text className="text-muted-foreground text-sm">{message}</Text>
    </View>
  );
};
