import { useEffect } from "react";
import notifee, { EventType } from "@notifee/react-native";
import { router } from "expo-router";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useSocketContext } from "@/contexts/SocketContext";
import {
  answerCallFromNotificationData,
  callLifecycleKeyFromData,
  callPayloadFromNotificationData,
  callRouteParamsFromPayload,
  clearPendingIncomingCall,
  declineCallFromNotificationData,
  isCallLifecycleClosed,
  PENDING_INCOMING_CALL_KEY,
} from "@/utils/callNotificationActions";
import { hydrateIncomingCallFromNotification, setReturnTo } from "@/store/slices/callSlice";
import { store } from "@/store/store";
import { useDispatch } from "react-redux";
import { dismissCallSystemNotification } from "@/utils/localSystemNotification";

const PENDING_CALL_BOOTSTRAP_RETRIES = 3;
const PENDING_CALL_BOOTSTRAP_RETRY_MS = 600;

export function useCallNotificationBootstrap() {
  const socket = useSocketContext();
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("[Call Bootstrap] hook mounted");
    let disposed = false;
    const retryHandles: ReturnType<typeof setTimeout>[] = [];
    const handledCallKeys = new Set<string>();

    const callKey = (
      raw: Record<string, unknown>,
      action: "answer" | "decline" | "ringing",
    ): string =>
      `${callLifecycleKeyFromData(raw) ?? String(raw.channelName ?? raw.entityId ?? raw.id ?? "")}:${action}`;

    const schedulePendingCallRetry = (attempt: number) => {
      if (disposed) return;
      const handle = setTimeout(() => {
        void checkPendingCallRedirect(attempt);
      }, PENDING_CALL_BOOTSTRAP_RETRY_MS);
      retryHandles.push(handle);
    };

    const openRingingCall = (raw: Record<string, unknown>) => {
      const payload = callPayloadFromNotificationData(raw);
      if (!payload) {
        console.warn("[Call Bootstrap] Invalid ringing payload", raw);
        return false;
      }

      // Immediately dismiss system notification to silence system VoIP ringtone
      void dismissCallSystemNotification(payload.channelName);

      console.log("[Call Bootstrap] dispatch incoming ringing call", {
        channelName: payload.channelName,
        callerId: payload.callerId,
        callerName: payload.callerName,
        callType: payload.type,
      });
      dispatch(setReturnTo("/(main)/(chat)"));
      dispatch(hydrateIncomingCallFromNotification(payload));

      const currentCall = store.getState().call;
      const hydrated =
        currentCall.status === "incoming-ringing" &&
        currentCall.channelName === payload.channelName &&
        currentCall.callerId === payload.callerId;
      console.log("[Call Bootstrap] state after incoming hydrate", {
        hydrated,
        status: currentCall.status,
        channelName: currentCall.channelName,
        callerId: currentCall.callerId,
      });
      if (!hydrated) {
        console.warn("[Call Bootstrap] incoming hydrate skipped by current call state", {
          currentStatus: currentCall.status,
          currentChannelName: currentCall.channelName,
          incomingChannelName: payload.channelName,
        });
      }
      return hydrated;
    };

    const openAcceptedCall = async (raw: Record<string, unknown>) => {
      const payload = await answerCallFromNotificationData(raw);
      if (!payload) {
        console.warn("[Call Bootstrap] Answer action could not emit accept yet", raw);
        return false;
      }

      // Immediately dismiss system notification to clean up UI and stop ringtone
      void dismissCallSystemNotification(payload.channelName);

      console.log("[Call Bootstrap] route accepted call", {
        channelName: payload.channelName,
        callerId: payload.callerId,
      });
      router.push({
        pathname: "/call",
        params: callRouteParamsFromPayload(payload, "answer"),
      } as never);
      return true;
    };

    const handleCallNotificationData = async (
      raw: Record<string, unknown>,
      action: "answer" | "decline" | "ringing",
    ): Promise<boolean> => {
      const key = callKey(raw, action);
      if (key && handledCallKeys.has(key)) {
        console.log("[Call Bootstrap] duplicate call action ignored", {
          action,
          key,
        });
        return true;
      }

      console.log("[Call Bootstrap] handling pending call action", {
        action,
        channelName: raw.channelName,
        callerId: raw.callerId,
      });
      if (await isCallLifecycleClosed(raw)) {
        console.log("[Call Bootstrap] pending call action ignored because call is closed", {
          action,
          channelName: raw.channelName,
          sessionId: raw.sessionId,
        });
        return true;
      }
      let handled = false;
      if (action === "decline") {
        const declined = await declineCallFromNotificationData(raw);
        console.log("[Call Bootstrap] decline handled", { declined });
        handled = declined;
      } else if (action === "answer") {
        handled = await openAcceptedCall(raw);
      } else {
        handled = openRingingCall(raw);
      }

      if (handled && key) {
        handledCallKeys.add(key);
      }
      return handled;
    };

    // Helper function to check and redirect to call screen if there is a pending call
    const checkPendingCallRedirect = async (attempt = 0) => {
      if (disposed) return;
      try {
        const pendingCallStr = await AsyncStorage.getItem(PENDING_INCOMING_CALL_KEY);
        console.log("[Call Bootstrap] pending call storage read", {
          attempt,
          hasPendingCall: Boolean(pendingCallStr),
        });

        if (!pendingCallStr) {
          if (attempt < PENDING_CALL_BOOTSTRAP_RETRIES) {
            schedulePendingCallRetry(attempt + 1);
          }
          return;
        }

        const data = JSON.parse(pendingCallStr) as Record<string, unknown>;
        console.log("[Call Bootstrap] Found pending call in storage:", data);

        if (!data || !data.channelName) {
          console.warn("[Call Bootstrap] Pending call missing channelName; clearing", data);
          await clearPendingIncomingCall();
          return;
        }

        if (await isCallLifecycleClosed(data)) {
          console.log("[Call Bootstrap] Pending call already closed; clearing", {
            channelName: data.channelName,
            sessionId: data.sessionId,
          });
          await clearPendingIncomingCall();
          return;
        }

        const action =
          data.action === "answer" || data.action === "decline" ? data.action : "ringing";
        console.log("[Call Bootstrap] resolved pending call action", { action });

        const handled = await handleCallNotificationData(data, action);
        if (handled) {
          await clearPendingIncomingCall();
          console.log("[Call Bootstrap] pending call cleared after successful handling", {
            action,
            channelName: data.channelName,
          });
          return;
        }

        console.warn("[Call Bootstrap] pending call handling did not complete", {
          action,
          channelName: data.channelName,
        });
        if (attempt < PENDING_CALL_BOOTSTRAP_RETRIES) {
          schedulePendingCallRetry(attempt + 1);
        }
      } catch (error) {
        console.error("[Call Bootstrap] Failed to check pending call from storage:", error);
      }
    };

    // 1. Immediately check for pending calls (handles Killed State boot)
    void checkPendingCallRedirect();

    // 2. Listen to AppState transitions (handles Background State wake ups)
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "active") {
        console.log("[Call Bootstrap] App became active. Checking for pending calls...");
        void checkPendingCallRedirect();
      }
    };
    const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

    // 3. Handle notification that launched the app from KILLED state via manual click
    notifee.getInitialNotification().then(async (initialNotification) => {
      if (initialNotification) {
        console.log(
          "[Notifee Initial] App launched by notification interaction:",
          initialNotification,
        );
        const { notification, pressAction } = initialNotification;
        const data = notification.data;

        if (data && data.channelName) {
          // Immediately dismiss system notification to stop system ringtone as app takes over
          void dismissCallSystemNotification(data.channelName as string);

          const action = pressAction?.id === "answer" ? "answer" : "ringing";
          console.log("[Call Bootstrap] initial notification action", {
            action,
            channelName: data.channelName,
          });

          const handle = setTimeout(() => {
            void (async () => {
              const initialKey = callKey(data as Record<string, unknown>, action);
              if (await isCallLifecycleClosed(data as Record<string, unknown>)) {
                console.log("[Call Bootstrap] initial notification skipped; call is closed", {
                  initialKey,
                });
                return;
              }
              const pendingCallStr = await AsyncStorage.getItem(PENDING_INCOMING_CALL_KEY);
              if (pendingCallStr) {
                try {
                  const pendingData = JSON.parse(pendingCallStr) as Record<string, unknown>;
                  const pendingAction =
                    pendingData.action === "answer" || pendingData.action === "decline"
                      ? pendingData.action
                      : "ringing";
                  const pendingKey = callKey(pendingData, pendingAction);
                  if (pendingKey === initialKey) {
                    console.log(
                      "[Call Bootstrap] initial notification skipped; matching pending storage exists",
                      { initialKey },
                    );
                    return;
                  }
                } catch {
                  // Let normal handling continue if pending storage is malformed.
                }
              }

              const handled = await handleCallNotificationData(
                data as Record<string, unknown>,
                action,
              );
              if (handled) {
                await clearPendingIncomingCall();
                console.log("[Call Bootstrap] pending call cleared after initial notification");
              }
            })();
          }, 800);
          retryHandles.push(handle);
        }
      }
    });

    // 4. Handle notification events while app is in FOREGROUND / BACKGROUND (running)
    const unsubscribeForeground = notifee.onForegroundEvent(async ({ type, detail }) => {
      const { notification, pressAction } = detail;
      const data = notification?.data;

      if (!data || !data.channelName) return;

      if (
        type === EventType.PRESS ||
        (type === EventType.ACTION_PRESS && pressAction?.id === "answer")
      ) {
        console.log("[Notifee Foreground] Press / Answer clicked");
        const action = pressAction?.id === "answer" ? "answer" : "ringing";

        await notifee.cancelNotification(notification.id!);
        const handled = await handleCallNotificationData(data as Record<string, unknown>, action);
        if (handled) {
          await clearPendingIncomingCall();
          console.log("[Call Bootstrap] pending call cleared after foreground action", { action });
        }
      } else if (type === EventType.ACTION_PRESS && pressAction?.id === "decline") {
        console.log("[Notifee Foreground] Decline clicked");
        await notifee.cancelNotification(notification.id!);
        const handled = await handleCallNotificationData(
          data as Record<string, unknown>,
          "decline",
        );
        if (handled) {
          await clearPendingIncomingCall();
          console.log("[Call Bootstrap] pending call cleared after foreground decline");
        }
      }
    });

    return () => {
      console.log("[Call Bootstrap] hook cleanup");
      disposed = true;
      retryHandles.forEach((handle) => clearTimeout(handle));
      appStateSubscription.remove();
      unsubscribeForeground();
    };
  }, [socket, dispatch]);
}
