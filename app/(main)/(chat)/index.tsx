import { Text, View } from "react-native";

import { Button } from "@/components/common/Button";
import { useAuth } from "@/hooks/useAuth";

export default function ChatListScreen() {
  const { logout } = useAuth();

  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <View className="bg-card border border-border rounded-2xl p-6 w-full max-w-md gap-4">
        <Text className="text-foreground text-xl font-bold">Chat</Text>
        <Text className="text-muted-foreground text-sm">Danh sách hội thoại sẽ được triển khai ở Phase 4.</Text>
        <Button label="Logout (test)" variant="secondary" onPress={logout} />
      </View>
    </View>
  );
}
