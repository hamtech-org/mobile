import "../src/theme/global.css";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { store } from "@/store/store";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Provider store={store}>
          <AuthProvider>
            <SocketProvider>
              <CallProvider>
                <KeyboardProvider>
                  <Stack screenOptions={{ headerShown: false }} />
                </KeyboardProvider>
              </CallProvider>
            </SocketProvider>
          </AuthProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
