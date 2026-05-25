import { NativeEventEmitter, NativeModules, Platform } from "react-native";

import { handleNotificationResponseAction } from "@/utils/notificationResponseActions";

type HamtechNotificationsNative = {
  addListener?: (event: string) => void;
  removeListeners?: (count: number) => void;
};

type NativeActionPayload = {
  actionIdentifier?: string;
  userText?: string;
  notificationId?: string;
  data?: Record<string, unknown>;
};

let subscribed = false;

/** Map payload native → format expo response listener. */
function toExpoLikeResponse(payload: NativeActionPayload): {
  actionIdentifier: string;
  userText?: string;
  notification: { request: { content: { data: Record<string, unknown> } } };
} {
  return {
    actionIdentifier: String(payload.actionIdentifier ?? ""),
    userText: payload.userText,
    notification: {
      request: {
        content: {
          data: (payload.data ?? {}) as Record<string, unknown>,
        },
      },
    },
  };
}

/**
 * Lắng nghe action từ HamtechNotifications (Android native banner có avatar).
 * Expo path vẫn dùng usePushNotifications listener.
 */
export function subscribeHamtechNotificationActions(): () => void {
  if (Platform.OS !== "android" || subscribed) return () => undefined;
  const native = NativeModules.HamtechNotifications as HamtechNotificationsNative | undefined;
  if (!native) return () => undefined;

  subscribed = true;
  const emitter = new NativeEventEmitter(NativeModules.HamtechNotifications);
  const sub = emitter.addListener("onNotificationAction", (payload: NativeActionPayload) => {
    void handleNotificationResponseAction(toExpoLikeResponse(payload));
  });

  return () => {
    subscribed = false;
    sub.remove();
  };
}
