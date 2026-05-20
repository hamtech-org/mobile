import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";

import { useAuth } from "@/hooks/useAuth";
import {
  useRegisterDeviceTokenMutation,
  useRemoveDeviceTokenMutation,
} from "@/store/api/notificationApi";
import { navigateFromNotification } from "@/utils/notificationNavigation";
import { isRemotePushSupported } from "@/utils/pushNotificationsSupport";
import type { INotificationRouteData } from "@/types/notification.types";

function parseRouteData(raw: unknown): INotificationRouteData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const route = d.route;
  const id = d.id;
  if (typeof route !== "string" || typeof id !== "string") return null;
  return {
    route: route as INotificationRouteData["route"],
    id,
    extra:
      typeof d.extra === "object" && d.extra ? (d.extra as Record<string, unknown>) : undefined,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web" || !isRemotePushSupported()) return null;

  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "HamTech",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

/**
 * Đăng ký push token + listener tap notification.
 * Trên Expo Go: no-op (in-app socket vẫn hoạt động).
 */
export function usePushNotifications(): void {
  const { isAuthenticated } = useAuth();
  const [registerToken] = useRegisterDeviceTokenMutation();
  const [removeToken] = useRemoveDeviceTokenMutation();
  const registeredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !isRemotePushSupported()) return;

    let cancelled = false;

    void (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (cancelled || !token) return;
        registeredTokenRef.current = token;
        const platform =
          Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
        try {
          await registerToken({ token, platform }).unwrap();
        } catch {
          /* backend optional in dev */
        }
      } catch {
        /* Expo Go / thiếu credential push */
      }
    })();

    return () => {
      cancelled = true;
      const token = registeredTokenRef.current;
      if (token) {
        void removeToken({ token }).catch(() => undefined);
        registeredTokenRef.current = null;
      }
    };
  }, [isAuthenticated, registerToken, removeToken]);

  useEffect(() => {
    if (!isRemotePushSupported()) return;

    let subReceived: { remove: () => void } | undefined;
    let subResponse: { remove: () => void } | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const Notifications = await import("expo-notifications");
        if (cancelled) return;

        subReceived = Notifications.addNotificationReceivedListener(() => {
          /* foreground: socket/toast */
        });

        subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = parseRouteData(response.notification.request.content.data);
          if (data) navigateFromNotification(data);
          else router.push("/(main)/(notifications)");
        });

        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          const data = parseRouteData(response.notification.request.content.data);
          if (data) navigateFromNotification(data);
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
      subReceived?.remove();
      subResponse?.remove();
    };
  }, []);
}
