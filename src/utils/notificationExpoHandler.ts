import * as Notifications from "expo-notifications";
import { AppState } from "react-native";

import {
  isCallLifecycleClosed,
  isTerminalCallLifecycleData,
  markCallLifecycleClosed,
  savePendingIncomingCall,
} from "@/utils/callNotificationActions";
import { showFullScreenCallNotification } from "@/utils/fullScreenCallNotification";
import {
  dismissCallSystemNotification,
  isSocketLocalNotificationEnabled,
  NOTIFICATION_DELIVERY_SOCKET,
} from "@/utils/localSystemNotification";
import {
  presentCallNotificationFromRemotePush,
  presentChatNotificationFromRemotePush,
} from "@/utils/notificationPresenters";
import { shouldSuppressRemotePushInForeground } from "@/utils/notificationRegistry";

let handlerInstalled = false;

function toStringPushData(
  data: Record<string, unknown> | undefined,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value == null) continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
}

/** Một handler duy nhất — gộp push chat + ẩn push trùng khi foreground. */
export function ensureExpoNotificationHandlerInstalled(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const content = notification.request.content;
      const pushData = content.data as Record<string, unknown> | undefined;
      if (pushData && isTerminalCallLifecycleData(pushData)) {
        await markCallLifecycleClosed(pushData, String(pushData.callStatus ?? "terminal"));
        if (typeof pushData.channelName === "string") {
          await dismissCallSystemNotification(pushData.channelName);
        }
        if (String(pushData.route ?? "") === "call") {
          return {
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldShowAlert: false,
          };
        }
      }

      const isBackgroundCall =
        AppState.currentState !== "active" &&
        String(pushData?.route ?? "") === "call" &&
        String(pushData?.callStatus ?? "incoming") === "incoming";
      if (isBackgroundCall) {
        const callData = {
          ...toStringPushData(pushData),
          pushTitle: String(pushData?.pushTitle ?? content.title ?? ""),
          pushBody: String(pushData?.pushBody ?? content.body ?? ""),
        };
        if (await isCallLifecycleClosed(callData)) {
          return {
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
            shouldShowAlert: false,
          };
        }
        await savePendingIncomingCall(callData, "ringing");
        await showFullScreenCallNotification(callData);
        return {
          shouldPlaySound: false,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldShowAlert: false,
        };
      }

      const callMerged =
        AppState.currentState !== "active" &&
        presentCallNotificationFromRemotePush({
          title: content.title,
          body: content.body,
          data: pushData,
        });
      if (callMerged) {
        return {
          shouldPlaySound: false,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldShowAlert: false,
        };
      }

      const merged = presentChatNotificationFromRemotePush({
        title: content.title,
        body: content.body,
        data: pushData,
      });
      if (merged) {
        return {
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: false,
          shouldShowList: false,
          shouldShowAlert: false,
        };
      }

      const data = content.data as Record<string, unknown> | undefined;
      const delivery = String(data?.deliverySource ?? "");
      const route = String(data?.route ?? "");
      const kind = String(data?.notificationKind ?? "");
      const isForeground = AppState.currentState === "active";

      if (isForeground && route === "call") {
        return {
          shouldPlaySound: false,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
          shouldShowAlert: true,
        };
      }

      const isSocketLocal = delivery === NOTIFICATION_DELIVERY_SOCKET;
      const suppressRemote =
        isSocketLocalNotificationEnabled() === false &&
        isForeground &&
        !isSocketLocal &&
        (shouldSuppressRemotePushInForeground(kind) || (route === "chat" && !kind));

      if (suppressRemote) {
        return {
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      return {
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
      };
    },
  });
}
