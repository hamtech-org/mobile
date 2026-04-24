import { useEffect } from "react";
import type { ComponentType } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from "react-redux";

import { resetCall } from "@/store/slices/callSlice";

/**
 * Expo Go không link native `react-native-agora`. Chỉ require màn Agora khi chạy dev build / standalone.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function ExpoGoCallNotice() {
  const dispatch = useDispatch();

  useEffect(() => {
    return () => {
      dispatch(resetCall());
    };
  }, [dispatch]);

  const onBack = () => {
    dispatch(resetCall());
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 justify-center bg-neutral-950 px-6" edges={["top", "bottom"]}>
      <Text className="mb-3 text-center text-xl font-bold text-white">
        Không gọi được trên Expo Go
      </Text>
      <Text className="mb-2 text-center text-[15px] leading-6 text-white/75">
        Module <Text className="font-mono text-white/90">react-native-agora</Text> chỉ có trong bản
        app đã build native (development build hoặc EAS), không có trong ứng dụng Expo Go.
      </Text>
      <Text className="mb-8 text-center text-sm text-white/60">
        Xem mobile/docs/CALL_ANDROID.md.
      </Text>
      <Pressable
        onPress={onBack}
        className="self-center rounded-xl bg-primary px-6 py-4 active:opacity-80"
      >
        <Text className="text-center font-semibold text-white">Quay lại</Text>
      </Pressable>
    </SafeAreaView>
  );
}

export default function CallScreen() {
  if (isExpoGo) {
    return <ExpoGoCallNotice />;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const CallAgoraScreen = require("@/screens/CallAgoraScreen").default as ComponentType;
  return <CallAgoraScreen />;
}
