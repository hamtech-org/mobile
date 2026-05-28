import * as Notifications from "expo-notifications";
import { AppState } from "react-native";

import {
  isSocketLocalNotificationEnabled,
  NOTIFICATION_DELIVERY_SOCKET,
} from "@/utils/localSystemNotification";
import {
  presentCallNotificationFromRemotePush,
  presentChatNotificationFromRemotePush,
} from "@/utils/notificationPresenters";
import { shouldSuppressRemotePushInForeground } from "@/utils/notificationRegistry";

let handlerInstalled = false;

/** Một handler duy nhất — gộp push chat + ẩn push trùng khi foreground. */
export function ensureExpoNotificationHandlerInstalled(): void {
  if (handlerInstalled) return;
  handlerInstalled = true;

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const content = notification.request.content;
      const pushData = content.data as Record<string, unknown> | undefined;

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
