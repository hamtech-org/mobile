import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps } from "@react-native-firebase/app";

import { getMessaging } from "@react-native-firebase/messaging";

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
import { getStablePushDeviceId } from "@/utils/pushDeviceId";
import { getNativeFirebaseAppsDebugInfo } from "@/utils/firebaseNativeApps";
import {
  getNativeFcmTokenFallbackAsync,
  getNativeMessagingDebugInfo,
} from "@/utils/nativeFcmToken";

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

async function getNativeFcmTokenAsync(): Promise<string | null> {
  if (Platform.OS !== "android" || !isRemotePushSupported()) return null;

  console.log(
    `[PushToken] RNFirebase native apps before lookup: ${getNativeFirebaseAppsDebugInfo()}`,
  );
  console.log(`[PushToken] Native messaging modules: ${getNativeMessagingDebugInfo()}`);

  try {
    const firebaseApp = getApp();
    console.log(
      `[PushToken] RNFirebase default app resolved: ${firebaseApp.name}; JS apps=${getApps().length}`,
    );
    await getMessaging().registerDeviceForRemoteMessages();
    return await getMessaging().getToken();
  } catch (error) {
    const errorDetails =
      error && typeof error === "object" && "code" in error
        ? `${String((error as { code?: unknown }).code)}: ${
            error instanceof Error ? error.message : String(error)
          }`
        : error instanceof Error
          ? error.message
          : String(error);
    console.warn(
      "[PushToken] Native FCM token registration failed:",
      errorDetails,
      `Native apps: ${getNativeFirebaseAppsDebugInfo()}`,
      `Messaging modules: ${getNativeMessagingDebugInfo()}`,
    );
    return getNativeFcmTokenFallbackAsync();
  }
}

/**
 * Đăng ký push token + listener tap notification.
 * Trên Expo Go: no-op (in-app socket vẫn hoạt động).
 */
export function usePushNotifications(): void {
  console.log("[PushToken] usePushNotifications hook running...");
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const isAuthenticated = Boolean(accessToken);
  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const [registerToken] = useRegisterDeviceTokenMutation();
  const [removeToken] = useRemoveDeviceTokenMutation();
  const registeredTokensRef = useRef<string[]>([]);

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
          const [deviceId, expoToken, fcmToken] = await Promise.all([
            getStablePushDeviceId(),
            registerForPushNotificationsAsync(),
            getNativeFcmTokenAsync(),
          ]);
          console.log(`[PushToken] Expo push token retrieved: ${expoToken}`);
          console.log(`[PushToken] Native FCM token retrieved: ${fcmToken ? "[present]" : "null"}`);
          if (cancelled) {
            console.log("[PushToken] Registration cancelled due to unmount.");
            return;
          }
          if (!expoToken && !fcmToken) {
            console.log("[PushToken] No token retrieved — fallback banner local từ socket.");
            clearPushTokenRegistered();
            return;
          }
          const platform =
            Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
          try {
            console.log(`[PushToken] Sending token to backend for user. Platform: ${platform}`);
            const registered: string[] = [];
            if (expoToken) {
              await registerToken({
                token: expoToken,
                platform,
                provider: "expo",
                deviceId,
              }).unwrap();
              registered.push(expoToken);
            }
            if (fcmToken && platform === "android") {
              await registerToken({
                token: fcmToken,
                platform,
                provider: "fcm",
                deviceId,
              }).unwrap();
              registered.push(fcmToken);
            }
            registeredTokensRef.current = registered;
            await AsyncStorage.setItem(
              "hamtech_registered_push_tokens",
              JSON.stringify(registered),
            );
            if (expoToken) markPushTokenRegistered();
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

      // ONLY remove token from backend and local storage if the user explicitly logs out (isAuthenticated becomes false)
      if (!isAuthenticatedRef.current) {
        clearPushTokenRegistered();
        const tokens = registeredTokensRef.current;
        if (tokens.length > 0) {
          console.log(
            "[PushToken] User logged out. Cleaning up and removing token from backend...",
          );
          tokens.forEach((token) => {
            void removeToken({ token, accessToken }).catch(() => undefined);
          });
          registeredTokensRef.current = [];
          void AsyncStorage.removeItem("hamtech_registered_push_tokens").catch(() => undefined);
        }
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
