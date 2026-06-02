import { getMessaging } from "@react-native-firebase/messaging";
import notifee, { EventType } from "@notifee/react-native";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  declineCallFromNotificationData,
  isCallLifecycleClosed,
  isTerminalCallLifecycleData,
  markCallLifecycleClosed,
  PENDING_INCOMING_CALL_KEY,
  savePendingIncomingCall,
} from "@/utils/callNotificationActions";
import { showFullScreenCallNotification } from "@/utils/fullScreenCallNotification";
import { dismissCallSystemNotification } from "@/utils/localSystemNotification";
import {
  getNativeFirebaseAppCount,
  getNativeFirebaseAppsDebugInfo,
} from "@/utils/firebaseNativeApps";
import { presentChatNotificationFromRemotePush } from "@/utils/notificationPresenters";

const MAX_FCM_HANDLER_REGISTRATION_ATTEMPTS = 10;
const FCM_HANDLER_REGISTRATION_RETRY_MS = 300;

let isFirebaseMessagingHandlerSetup = false;
let isNotifeeBackgroundEventSetup = false;
let firebaseMessagingHandlerAttempts = 0;
let firebaseMessagingRetryHandle: ReturnType<typeof setTimeout> | null = null;

function scheduleFirebaseMessagingHandlerRetry(reason: string): void {
  if (firebaseMessagingHandlerAttempts >= MAX_FCM_HANDLER_REGISTRATION_ATTEMPTS) {
    console.warn(
      `[FCM] Background handler registration stopped after ${firebaseMessagingHandlerAttempts} attempts. ${reason}`,
    );
    return;
  }

  if (firebaseMessagingRetryHandle) return;

  firebaseMessagingRetryHandle = setTimeout(() => {
    firebaseMessagingRetryHandle = null;
    setupFirebaseMessagingHandlers();
  }, FCM_HANDLER_REGISTRATION_RETRY_MS);
}

function setupFirebaseMessagingHandlers(): void {
  if (isFirebaseMessagingHandlerSetup) return;
  firebaseMessagingHandlerAttempts += 1;

  const nativeAppCount = getNativeFirebaseAppCount();
  if (nativeAppCount === 0) {
    scheduleFirebaseMessagingHandlerRetry(
      `[FCM] Native Firebase app is not ready. Native apps: ${getNativeFirebaseAppsDebugInfo()}`,
    );
    return;
  }

  try {
    console.log(
      `[FCM] Registering messaging handlers. Native apps: ${getNativeFirebaseAppsDebugInfo()}`,
    );
    // Foreground FCM handler (mostly for chat messages since ExpoFirebaseMessagingService is removed)
    getMessaging().onMessage(async (remoteMessage) => {
      console.log("[FCM Foreground] Message received:", remoteMessage);
      const data = remoteMessage.data;
      if (!data) return;

      if (isTerminalCallLifecycleData(data as Record<string, unknown>)) {
        await markCallLifecycleClosed(
          data as Record<string, unknown>,
          String(data.callStatus ?? "terminal"),
        );
        await AsyncStorage.removeItem(PENDING_INCOMING_CALL_KEY);
        if (typeof data.channelName === "string") {
          await dismissCallSystemNotification(data.channelName);
        }
      }

      if (data.route === "chat") {
        presentChatNotificationFromRemotePush({
          title: remoteMessage.notification?.title || (data.senderName as string) || "Tin nhắn mới",
          body:
            remoteMessage.notification?.body ||
            (data.messagePreview as string) ||
            "Bạn có tin nhắn mới",
          data: data as Record<string, unknown>,
        });
      }
      // Note: In-app incoming calls are already handled via WebSocket inside CallContext.tsx
    });

    // Listen to background messages
    getMessaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log("[FCM Background] Message received:", remoteMessage);
      const data = remoteMessage.data;
      if (!data) return;

      if (isTerminalCallLifecycleData(data as Record<string, unknown>)) {
        await markCallLifecycleClosed(
          data as Record<string, unknown>,
          String(data.callStatus ?? "terminal"),
        );
        await AsyncStorage.removeItem(PENDING_INCOMING_CALL_KEY);
        if (typeof data.channelName === "string") {
          await dismissCallSystemNotification(data.channelName);
        }
      }

      if (data.route === "call" && data.callStatus === "incoming") {
        if (await isCallLifecycleClosed(data as Record<string, unknown>)) {
          console.log("[Call Fullscreen] incoming call ignored because it is already closed", {
            channelName: data.channelName,
            sessionId: data.sessionId,
          });
          return;
        }
        console.log("[Call Fullscreen] savePendingIncomingCall start", {
          route: data.route,
          callStatus: data.callStatus,
          channelName: data.channelName,
          callerName: data.callerName,
          callType: data.callType,
        });
        try {
          await savePendingIncomingCall(data as Record<string, unknown>, "ringing");
          console.log("[Call Fullscreen] pending call saved", {
            channelName: data.channelName,
            callerId: data.callerId,
          });
        } catch (e) {
          console.error("[Call Fullscreen] pending call save failed", e);
        }
        console.log("[Call Fullscreen] showFullScreenCallNotification start");
        await showFullScreenCallNotification(data as Record<string, string | undefined>);
        console.log("[Call Fullscreen] showFullScreenCallNotification completed");
      } else if (data.route === "chat") {
        presentChatNotificationFromRemotePush({
          title: remoteMessage.notification?.title || (data.senderName as string) || "Tin nhắn mới",
          body:
            remoteMessage.notification?.body ||
            (data.messagePreview as string) ||
            "Bạn có tin nhắn mới",
          data: data as Record<string, unknown>,
        });
      }
    });

    isFirebaseMessagingHandlerSetup = true;
    console.log("[FCM] Messaging handlers registered.");
  } catch (error) {
    console.error("[FCM] Failed to set message handlers:", error);
    scheduleFirebaseMessagingHandlerRetry(error instanceof Error ? error.message : String(error));
  }
}

function setupNotifeeBackgroundEventHandler(): void {
  if (isNotifeeBackgroundEventSetup) return;

  try {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      const data = notification?.data;

      if (!data) return;

      if (type === EventType.ACTION_PRESS) {
        if (pressAction?.id === "decline") {
          console.log("[Notifee Background] Decline pressed");
          if (notification.id) {
            await notifee.cancelNotification(notification.id);
          }
          const declined = await declineCallFromNotificationData(data as Record<string, unknown>);
          console.log("[Notifee Background] Decline handled", {
            emitted: declined,
            channelName: data.channelName,
          });
          if (declined) {
            await AsyncStorage.removeItem(PENDING_INCOMING_CALL_KEY);
          } else {
            await savePendingIncomingCall(data as Record<string, unknown>, "decline");
          }
        } else if (pressAction?.id === "answer") {
          console.log("[Notifee Background] Answer pressed");
          await savePendingIncomingCall(data as Record<string, unknown>, "answer");
          // Android will bring the app to foreground via launchActivity; bootstrap emits accept.
        }
      }
    });
    isNotifeeBackgroundEventSetup = true;
  } catch (error) {
    console.error("[Notifee] Failed to set background event handler:", error);
  }
}

// Background FCM Message Handler
export function setupBackgroundCallHandler() {
  if (Platform.OS === "web") return;

  setupFirebaseMessagingHandlers();
  setupNotifeeBackgroundEventHandler();
}
