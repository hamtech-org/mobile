import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import { useAppSelector } from "@/hooks/useAppStore";
import { navigateFromNotification } from "@/utils/notificationNavigation";
import {
  handleNotificationResponseAction,
  notificationRouteDataFromResponse,
} from "@/utils/notificationResponseActions";
import { ensureExpoNotificationHandlerInstalled } from "@/utils/notificationExpoHandler";
import { isRemotePushSupported } from "@/utils/pushNotificationsSupport";

type NotificationResponse = Notifications.NotificationResponse;

function responseKey(response: NotificationResponse): string {
  const requestId = response.notification.request.identifier;
  const action = response.actionIdentifier;
  return `${requestId}:${action}`;
}

export function useNotificationResponses(): void {
  const isBootstrapping = useAppSelector((state) => state.auth.isBootstrapping);
  const pendingResponseRef = useRef<NotificationResponse | null>(null);
  const handledLastResponseIdRef = useRef<string | null>(null);

  const processResponse = useCallback(async (response: NotificationResponse) => {
    const key = responseKey(response);
    if (handledLastResponseIdRef.current === key) return;
    handledLastResponseIdRef.current = key;

    try {
      if (await handleNotificationResponseAction(response)) return;
    } catch {
      /* fallback to opening route */
    }

    const data = notificationRouteDataFromResponse(response);
    if (data) navigateFromNotification(data);
    else router.push("/(main)/(notifications)");
  }, []);

  useEffect(() => {
    if (!isRemotePushSupported()) return;

    ensureExpoNotificationHandlerInstalled();

    const subResponse = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isBootstrapping) {
        pendingResponseRef.current = response;
        return;
      }
      void processResponse(response);
    });

    return () => {
      subResponse.remove();
    };
  }, [isBootstrapping, processResponse]);

  useEffect(() => {
    if (!isRemotePushSupported() || isBootstrapping) return;

    const pending = pendingResponseRef.current;
    if (pending) {
      pendingResponseRef.current = null;
      void processResponse(pending);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (cancelled || !response) return;

        await processResponse(response);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isBootstrapping, processResponse]);
}
