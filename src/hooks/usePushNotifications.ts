import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useAppSelector } from "@/hooks/useAppStore";
import {
  useRegisterDeviceTokenMutation,
  useRemoveDeviceTokenMutation,
} from "@/store/api/notificationApi";
import {
  clearPushTokenRegistered,
  ensureNotificationCategories,
  ensureSystemNotificationChannels,
  markPushTokenRegistered,
} from "@/utils/localSystemNotification";
import { ensureExpoNotificationHandlerInstalled } from "@/utils/notificationExpoHandler";
import { requestNotificationPermissionAsync } from "@/utils/notificationPermission";
import { isRemotePushSupported } from "@/utils/pushNotificationsSupport";

console.log("[PushToken] usePushNotifications.ts module loaded globally!");

async function registerForPushNotificationsAsync(): Promise<string | null> {
  console.log("[PushToken] registerForPushNotificationsAsync invoked");
  if (Platform.OS === "web" || !isRemotePushSupported()) return null;

  ensureExpoNotificationHandlerInstalled();

  const granted = await requestNotificationPermissionAsync();
  if (!granted) {
    console.warn("[PushToken] Notification permission not granted — không thể đăng ký push token.");
    return null;
  }

  await ensureSystemNotificationChannels();
  await ensureNotificationCategories();
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "HamTech",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const Constants = (await import("expo-constants")).default;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

  if (!projectId) {
    console.warn("[PushToken] Project ID not found in app.json configuration.");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (error) {
    console.log(
      "[PushToken] getExpoPushTokenAsync failed. FCM credentials may not be configured in this build. Details:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Đăng ký push token + listener tap notification.
 * Trên Expo Go: no-op (in-app socket vẫn hoạt động).
 */
export function usePushNotifications(): void {
  console.log("[PushToken] usePushNotifications hook running...");
  const isAuthenticated = useAppSelector((state) => Boolean(state.auth.accessToken));
  const [registerToken] = useRegisterDeviceTokenMutation();
  const [removeToken] = useRemoveDeviceTokenMutation();
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const isSupported = isRemotePushSupported();
    console.log(
      `[PushToken] Hook effect triggered. isAuthenticated=${isAuthenticated}, isSupported=${isSupported}`,
    );
    if (!isAuthenticated) {
      clearPushTokenRegistered();
      return;
    }
    if (!isSupported) {
      console.log(
        "[PushToken] Expo Go / môi trường không hỗ trợ push — dùng banner local từ socket.",
      );
      clearPushTokenRegistered();
      return;
    }

    let cancelled = false;

    const register = () => {
      void (async () => {
        try {
          console.log("[PushToken] Requesting device token from Expo...");
          const token = await registerForPushNotificationsAsync();
          console.log(`[PushToken] Expo push token retrieved: ${token}`);
          if (cancelled) {
            console.log("[PushToken] Registration cancelled due to unmount.");
            return;
          }
          if (!token) {
            console.log("[PushToken] No token retrieved — fallback banner local từ socket.");
            clearPushTokenRegistered();
            return;
          }
          registeredTokenRef.current = token;
          const platform =
            Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
          try {
            console.log(`[PushToken] Sending token to backend for user. Platform: ${platform}`);
            await registerToken({ token, platform }).unwrap();
            markPushTokenRegistered();
            console.log("[PushToken] Token registered successfully on backend!");
          } catch (err) {
            clearPushTokenRegistered();
            console.error("[PushToken] Backend token registration failed:", err);
          }
        } catch (err) {
          console.error("[PushToken] Error during push notification registration flow:", err);
        }
      })();
    };

    register();
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") register();
    });

    return () => {
      cancelled = true;
      appStateSub.remove();
      clearPushTokenRegistered();
      const token = registeredTokenRef.current;
      if (token) {
        console.log("[PushToken] Cleaning up and removing token from backend...");
        void removeToken({ token }).catch(() => undefined);
        registeredTokenRef.current = null;
      }
    };
  }, [isAuthenticated, registerToken, removeToken]);

  useEffect(() => {
    if (!isRemotePushSupported()) return;

    ensureExpoNotificationHandlerInstalled();

    const subReceived = Notifications.addNotificationReceivedListener((notification) => {
      if (__DEV__) {
        const c = notification.request.content;
        console.log("[PushToken] Push received:", c.title, c.body, c.data);
      }
    });

    return () => {
      subReceived.remove();
    };
  }, []);
}
