import "../src/theme/global.css";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Provider } from "react-redux";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { ToastHost } from "@/components/common/ToastHost";
import { NotificationResponseBootstrap } from "@/components/notifications/NotificationResponseBootstrap";
import { CallNotificationBootstrap } from "@/components/notifications/CallNotificationBootstrap";
import { store } from "@/store/store";
import { requestStartupPermissionsAsync } from "@/utils/startupPermissions";
import { View } from "react-native";
export default function RootLayout() {
  useEffect(() => {
    void requestStartupPermissionsAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AuthProvider>
            <SocketProvider>
              <CallProvider>
                <KeyboardProvider>
                  <View style={{ flex: 1 }}>
                    <NotificationResponseBootstrap />
                    <CallNotificationBootstrap />
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
