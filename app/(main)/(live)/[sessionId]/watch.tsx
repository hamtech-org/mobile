import Constants from "expo-constants";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

function ExpoGoLiveGuard() {
  useEffect(() => {
    router.replace("/(main)/(live)");
  }, []);
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
      <Text className="text-center text-base font-semibold text-foreground">
        Xem live cần dev build
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">
        Expo Go không có react-native-agora. Chạy{" "}
        <Text className="font-mono text-primary">npx expo run:android</Text> để xem trực tiếp.
      </Text>
    </SafeAreaView>
  );
}

export default function LiveWatchRoute() {
  const isExpoGo = Constants.appOwnership === "expo";

  if (isExpoGo) {
    return <ExpoGoLiveGuard />;
  }

  const { LiveWatchScreen } = require("@/screens/LiveWatchScreen") as {
    LiveWatchScreen: React.ComponentType;
  };

  return (
    <View className="flex-1 bg-black">
      <LiveWatchScreen />
    </View>
  );
}
