import Constants from "expo-constants";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

function ExpoGoLiveGuard() {
  useEffect(() => {
    router.replace("/(main)/(live)");
  }, []);
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-base font-semibold text-foreground">
        Live host cần dev build
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        Expo Go không có react-native-agora. Chạy{" "}
        <Text className="font-mono text-primary">npx expo run:android</Text> để phát trực tiếp.
      </Text>
    </SafeAreaView>
  );
}

export default function LiveHostRoute() {
  const isExpoGo = Constants.appOwnership === "expo";

  if (isExpoGo) {
    return <ExpoGoLiveGuard />;
  }

  const { LiveHostScreen } = require("@/screens/LiveHostScreen") as {
    LiveHostScreen: React.ComponentType;
  };

  return (
    <View className="flex-1 bg-black">
      <LiveHostScreen />
    </View>
  );
}
