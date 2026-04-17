import "../src/theme/global.css";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { AuthProvider } from "@/contexts/AuthContext";
import { CallProvider } from "@/contexts/CallContext";
import { SocketProvider } from "@/contexts/SocketContext";
import { store } from "@/store/store";

export default function RootLayout() {
  return (
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
  );
}
