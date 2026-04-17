import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 px-6 py-6 gap-4">
        <Text className="text-foreground text-2xl font-bold">Profile</Text>
        <View className="bg-card border border-border rounded-2xl p-4 gap-2">
          <Text className="text-muted-foreground text-sm">Module profile sẽ được triển khai ở Phase 7.</Text>
        </View>
        <Button label="Logout (test)" variant="secondary" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}
