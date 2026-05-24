import "../src/theme/global.css";
import "@/utils/notifeeBackgroundEvents";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ToastHost } from "@/components/common/ToastHost";
import { store } from "@/store/store";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AuthProvider>
            <SocketProvider>
              <CallProvider>
                <KeyboardProvider>
                  <View style={{ flex: 1 }}>
                    <Stack screenOptions={{ headerShown: false }} />
                    <ToastHost />
                  </View>
                </KeyboardProvider>
              </CallProvider>
            </SocketProvider>
          </AuthProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
