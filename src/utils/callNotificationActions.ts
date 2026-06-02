import AsyncStorage from "@react-native-async-storage/async-storage";

import { env } from "@/config/env";
import { getSocketClient, normalizeSocketAuthToken } from "@/services/socket";
import { secureStorage } from "@/services/storage";
import { setSessionTokens } from "@/store/slices/authSlice";
import { resetCall, setCallAccepted, setIncomingCall, setReturnTo } from "@/store/slices/callSlice";
import { store } from "@/store/store";
import type { CallScope, IncomingCallData } from "@/types/call.types";
import { dismissCallSystemNotification } from "@/utils/localSystemNotification";

export const PENDING_INCOMING_CALL_KEY = "pending_incoming_call";
const CLOSED_CALLS_KEY = "closed_call_lifecycle_keys";
const CLOSED_CALL_SESSION_TTL_MS = 10 * 60 * 1000;
const CLOSED_CALL_FALLBACK_TTL_MS = 90 * 1000;

export type CallNotificationAction = "answer" | "decline" | "ringing";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type ClosedCallRecord = {
  reason: string;
  expiresAt: number;
};

type ClosedCallMap = Record<string, ClosedCallRecord>;

export function callLifecycleKeyFromData(data: Record<string, unknown>): string | null {
  const sessionId = text(data.sessionId ?? data.callSessionId);
  if (sessionId) return `session:${sessionId}`;

  const channelName = text(data.channelName ?? data.entityId ?? data.id);
  const conversationId = text(data.conversationId);
  if (channelName && conversationId) return `channel:${channelName}:${conversationId}`;
  if (channelName) return `channel:${channelName}`;
  return null;
}

async function readClosedCallMap(): Promise<ClosedCallMap> {
  const now = Date.now();
  try {
    const raw = await AsyncStorage.getItem(CLOSED_CALLS_KEY);
    const parsed = raw ? (JSON.parse(raw) as ClosedCallMap) : {};
    const pruned: ClosedCallMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value && typeof value.expiresAt === "number" && value.expiresAt > now) {
        pruned[key] = value;
      }
    }
    if (Object.keys(pruned).length !== Object.keys(parsed).length) {
      await AsyncStorage.setItem(CLOSED_CALLS_KEY, JSON.stringify(pruned));
    }
    return pruned;
  } catch {
    return {};
  }
}

export async function isCallLifecycleClosed(data: Record<string, unknown>): Promise<boolean> {
  const key = callLifecycleKeyFromData(data);
  if (!key) return false;
  const closed = await readClosedCallMap();
  const isClosed = Boolean(closed[key]);
  if (isClosed && __DEV__) {
    console.log("[CallLifecycle] stale call ignored", {
      key,
      reason: closed[key]?.reason,
    });
  }
  return isClosed;
}

export function isTerminalCallLifecycleData(data: Record<string, unknown>): boolean {
  const status = text(data.callStatus);
  const kind = text(data.notificationKind);
  return (
    status === "accepted" ||
    status === "rejected" ||
    status === "ended" ||
    status === "missed" ||
    status === "cancelled" ||
    kind === "chat_call_missed"
  );
}

export async function markCallLifecycleClosed(
  data: Record<string, unknown>,
  reason: string,
): Promise<void> {
  const key = callLifecycleKeyFromData(data);
  if (!key) return;
  const ttl = key.startsWith("session:") ? CLOSED_CALL_SESSION_TTL_MS : CLOSED_CALL_FALLBACK_TTL_MS;
  const closed = await readClosedCallMap();
  closed[key] = {
    reason,
    expiresAt: Date.now() + ttl,
  };
  await AsyncStorage.setItem(CLOSED_CALLS_KEY, JSON.stringify(closed));
  if (__DEV__) {
    console.log("[CallLifecycle] call marked closed", { key, reason });
  }
}

export async function clearPendingIncomingCall(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_INCOMING_CALL_KEY);
}

type NotificationActionToken = {
  source: "redux" | "refresh" | "secure-store";
  token: string;
};

type RefreshTokenEnvelope = {
  data?: {
    accessToken?: unknown;
    refreshToken?: unknown;
  };
};

export function callPayloadFromNotificationData(
  data: Record<string, unknown>,
): IncomingCallData | null {
  const channelName = text(data.channelName ?? data.entityId ?? data.id);
  const conversationId = text(data.conversationId);
  const callerId = text(data.callerId);
  if (!channelName || !conversationId || !callerId) return null;

  const type = text(data.callType) === "video" ? "video" : "audio";
  const scope: CallScope = text(data.callScope) === "group" ? "group" : "direct";
  const callerName =
    text(data.callerName) || text(data.pushTitle) || text(data.actorName) || "Cuộc gọi đến";
  const hostId = text(data.hostId) || callerId;
  const sessionId = text(data.sessionId);

  return {
    channelName,
    conversationId,
    callerId,
    callerName,
    type,
    scope,
    hostId,
    ...(sessionId ? { sessionId } : {}),
  };
}

export function callRouteParamsFromPayload(
  payload: IncomingCallData,
  action: CallNotificationAction = "answer",
): Record<string, string> {
  return {
    channel: payload.channelName,
    conversationId: payload.conversationId,
    callerId: payload.callerId,
    callerName: payload.callerName,
    type: payload.type,
    scope: payload.scope ?? "direct",
    hostId: payload.hostId ?? payload.callerId,
    action,
    returnTo: encodeURIComponent("/(main)/(chat)"),
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
  };
}

async function refreshSocketAuthTokenForNotificationAction(): Promise<NotificationActionToken | null> {
  let refreshToken: string | null = null;
  try {
    refreshToken = await secureStorage.getRefreshToken();
  } catch {
    // SecureStore may throw errors in background Headless JS context when device is locked
  }
  if (!refreshToken) {
    try {
      refreshToken = await secureStorage.getBackgroundRefreshToken();
    } catch {
      // ignore
    }
  }
  const normalizedRefreshToken = normalizeSocketAuthToken(refreshToken);
  if (!normalizedRefreshToken) return null;

  try {
    const res = await fetch(`${env.apiBaseUrl}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: normalizedRefreshToken }),
    });
    if (!res.ok) {
      if (__DEV__) {
        console.warn("[CallNotificationAction] refresh token request failed", {
          status: res.status,
        });
      }
      return null;
    }

    const envelope = (await res.json()) as RefreshTokenEnvelope;
    const accessToken = normalizeSocketAuthToken(envelope.data?.accessToken as string | undefined);
    const nextRefreshToken = normalizeSocketAuthToken(
      envelope.data?.refreshToken as string | undefined,
    );
    if (!accessToken || !nextRefreshToken) return null;

    await secureStorage.setTokens(accessToken, nextRefreshToken);
    store.dispatch(setSessionTokens({ accessToken, refreshToken: nextRefreshToken }));
    return { source: "refresh", token: accessToken };
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[CallNotificationAction] refresh token request errored",
        error instanceof Error ? error.message : String(error),
      );
    }
    return null;
  }
}

async function getSocketAuthTokenForNotificationAction(): Promise<NotificationActionToken | null> {
  const reduxToken = normalizeSocketAuthToken(store.getState().auth.accessToken);
  if (reduxToken) return { source: "redux", token: reduxToken };

  const refreshedToken = await refreshSocketAuthTokenForNotificationAction();
  if (refreshedToken) return refreshedToken;

  let storedAccessToken: string | null = null;
  try {
    storedAccessToken = await secureStorage.getAccessToken();
  } catch {
    // ignore
  }
  if (!storedAccessToken) {
    try {
      storedAccessToken = await secureStorage.getBackgroundAccessToken();
    } catch {
      // ignore
    }
  }
  const normalizedToken = normalizeSocketAuthToken(storedAccessToken);
  if (normalizedToken) return { source: "secure-store", token: normalizedToken };

  return null;
}

async function emitCallActionHttp(
  event: "accept" | "decline",
  payload: IncomingCallData,
): Promise<boolean> {
  const authToken = await getSocketAuthTokenForNotificationAction();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken.token}`;
  }

  const bodyPayload = {
    channelName: payload.channelName,
    callerId: payload.callerId,
    conversationId: payload.conversationId,
    type: payload.type,
    ...(payload.sessionId ? { sessionId: payload.sessionId } : {}),
  };

  try {
    console.log(
      `[CallNotificationAction] Sending HTTP call ${event} request:`,
      bodyPayload.channelName,
    );
    const res = await fetch(`${env.apiBaseUrl}/call/${event}`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
    });

    if (res.ok) {
      console.log(`[CallNotificationAction] HTTP call ${event} success`);
      return true;
    }

    if (res.status === 400 || res.status === 401 || res.status === 404) {
      console.log(
        `[CallNotificationAction] HTTP call ${event} terminal error status: ${res.status}. Cleaning up.`,
      );
      return true;
    }

    console.warn(`[CallNotificationAction] HTTP call ${event} failed with status: ${res.status}`);
    return false;
  } catch (error) {
    console.error(`[CallNotificationAction] HTTP call ${event} error:`, error);
    return false;
  }
}

export async function savePendingIncomingCall(
  data: Record<string, unknown>,
  action: CallNotificationAction,
): Promise<boolean> {
  if (await isCallLifecycleClosed(data)) return false;
  const payload = callPayloadFromNotificationData(data);
  if (!payload) return false;
  await AsyncStorage.setItem(
    PENDING_INCOMING_CALL_KEY,
    JSON.stringify({
      ...data,
      channelName: payload.channelName,
      conversationId: payload.conversationId,
      callerId: payload.callerId,
      callerName: payload.callerName,
      callType: payload.type,
      callScope: payload.scope ?? "direct",
      hostId: payload.hostId ?? payload.callerId,
      sessionId: payload.sessionId,
      action,
    }),
  );
  return true;
}

export async function answerCallFromNotificationData(
  data: Record<string, unknown>,
): Promise<IncomingCallData | null> {
  const payload = callPayloadFromNotificationData(data);
  if (!payload) return null;

  const emitted = await emitCallActionHttp("accept", payload);
  if (!emitted) return null;

  await markCallLifecycleClosed(payload as unknown as Record<string, unknown>, "accepted");
  store.dispatch(setReturnTo("/(main)/(chat)"));
  store.dispatch(setIncomingCall(payload));
  store.dispatch(setCallAccepted());
  await dismissCallSystemNotification(payload.channelName);
  return payload;
}

export async function declineCallFromNotificationData(
  data: Record<string, unknown>,
): Promise<boolean> {
  const payload = callPayloadFromNotificationData(data);
  if (!payload) return false;

  const emitted = await emitCallActionHttp("decline", payload);
  if (!emitted && __DEV__) {
    console.warn("[CallNotificationAction] call:decline HTTP failed", payload);
  }
  if (emitted) {
    await markCallLifecycleClosed(payload as unknown as Record<string, unknown>, "rejected");
  }
  await dismissCallSystemNotification(payload.channelName);
  store.dispatch(resetCall());
  return emitted;
}
