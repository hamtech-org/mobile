import { router, type Href } from "expo-router";

import { messageApi } from "@/store/api/endpoints/messageApi";
import { resetCall, setCallAccepted, setIncomingCall, setReturnTo } from "@/store/slices/callSlice";
import { store } from "@/store/store";
import type { CallScope, CallType, IncomingCallData } from "@/types/call.types";
import type { INotification } from "@/types/notification.types";
import { getSocketClient, normalizeSocketAuthToken } from "@/services/socket";
import { dismissCallSystemNotification } from "@/utils/localSystemNotification";
import { NOTIFICATION_ACTION } from "@/utils/notificationRegistry";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function dataRecord(response: unknown): Record<string, unknown> {
  const content = (response as { notification?: { request?: { content?: { data?: unknown } } } })
    ?.notification?.request?.content;
  const expoData = objectRecord(content?.data);
  if (expoData) return expoData;

  const detail = objectRecord((response as { detail?: unknown })?.detail);
  const notifeeNotification = objectRecord(detail?.notification);
  const notifeeData = objectRecord(notifeeNotification?.data);
  if (notifeeData) return notifeeData;

  const directNotification = objectRecord((response as { notification?: unknown })?.notification);
  const directData = objectRecord(directNotification?.data);
  return directData ?? {};
}

function actionId(response: unknown): string {
  const expoAction = text((response as { actionIdentifier?: unknown })?.actionIdentifier);
  if (expoAction) return expoAction;

  const detail = objectRecord((response as { detail?: unknown })?.detail);
  const pressAction = objectRecord(detail?.pressAction);
  return text(pressAction?.id);
}

function userText(response: unknown): string {
  return (
    text((response as { userText?: unknown })?.userText) ||
    text(objectRecord((response as { detail?: unknown })?.detail)?.input)
  );
}

function emitSocketEvent(event: string, payload: Record<string, unknown>): void {
  const socket = getSocketClient();
  const token = normalizeSocketAuthToken(store.getState().auth.accessToken);
  if (token) socket.auth = { token };
  if (socket.connected) {
    socket.emit(event, payload);
    return;
  }
  socket.once("connect", () => {
    socket.emit(event, payload);
  });
  socket.connect();
}

function callPayloadFromData(data: Record<string, unknown>): IncomingCallData | null {
  const channelName = text(data.channelName ?? data.entityId ?? data.id);
  const conversationId = text(data.conversationId);
  const callerId = text(data.callerId);
  if (!channelName || !conversationId || !callerId) return null;

  const callType = text(data.callType) === "video" ? "video" : "audio";
  const scope: CallScope = text(data.callScope) === "group" ? "group" : "direct";
  return {
    channelName,
    conversationId,
    callerId,
    callerName: text(data.callerName) || "Cuộc gọi đến",
    type: callType,
    scope,
    hostId: text(data.hostId) || callerId,
  };
}

function pushCallScreen(payload: IncomingCallData): void {
  router.push({
    pathname: "/call",
    params: {
      channel: payload.channelName,
      type: payload.type,
      conversationId: payload.conversationId,
      returnTo: encodeURIComponent("/(main)/(chat)"),
      scope: payload.scope ?? "direct",
      ...(payload.hostId ? { hostId: payload.hostId } : {}),
    },
  } as Href);
}

async function handleAnswerCall(data: Record<string, unknown>): Promise<boolean> {
  const payload = callPayloadFromData(data);
  if (!payload) return false;

  emitSocketEvent("call:accept", {
    channelName: payload.channelName,
    callerId: payload.callerId,
    conversationId: payload.conversationId,
    type: payload.type,
  });

  store.dispatch(setReturnTo("/(main)/(chat)"));
  store.dispatch(setIncomingCall(payload));
  store.dispatch(setCallAccepted());
  await dismissCallSystemNotification(payload.channelName);
  pushCallScreen(payload);
  return true;
}

async function handleDeclineCall(data: Record<string, unknown>): Promise<boolean> {
  const payload = callPayloadFromData(data);
  if (!payload) return false;

  emitSocketEvent("call:reject", {
    channelName: payload.channelName,
    callerId: payload.callerId,
    conversationId: payload.conversationId,
    type: payload.type,
  });

  await dismissCallSystemNotification(payload.channelName);
  store.dispatch(resetCall());
  return true;
}

async function handleInlineReply(data: Record<string, unknown>, body: string): Promise<boolean> {
  const content = body.trim();
  const conversationId = text(data.conversationId ?? data.entityId ?? data.id);
  if (!conversationId || !content) return false;

  await store
    .dispatch(
      messageApi.endpoints.sendMessage.initiate({
        conversationId,
        type: "text",
        content,
      }),
    )
    .unwrap();
  return true;
}

async function handleCallbackCall(data: Record<string, unknown>): Promise<boolean> {
  const conversationId = text(data.conversationId);
  const callerId = text(data.callerId);
  const callType = text(data.callType) === "video" ? "video" : "audio";
  const scope = text(data.callScope) === "group" ? "group" : "direct";

  if (!conversationId) return false;

  const payload: Record<string, unknown> = {
    type: callType,
    conversationId,
    scope,
  };

  if (scope === "direct" && callerId) {
    payload.calleeId = callerId;
  }

  emitSocketEvent("call:initiate", payload);
  return true;
}

async function handleOpenMessage(data: Record<string, unknown>): Promise<boolean> {
  const conversationId = text(data.conversationId || data.entityId || data.id);
  if (!conversationId) return false;

  router.push(`/(main)/(chat)/${conversationId}` as Href);
  return true;
}

export async function handleNotificationResponseAction(response: unknown): Promise<boolean> {
  const action = actionId(response);
  if (!action) return false;

  const data = dataRecord(response);
  if (action === NOTIFICATION_ACTION.ANSWER) {
    return handleAnswerCall(data);
  }
  if (action === NOTIFICATION_ACTION.DECLINE) {
    return handleDeclineCall(data);
  }
  if (action === NOTIFICATION_ACTION.REPLY) {
    return handleInlineReply(data, userText(response));
  }
  if (action === NOTIFICATION_ACTION.CALLBACK) {
    return handleCallbackCall(data);
  }
  if (action === NOTIFICATION_ACTION.MESSAGE) {
    return handleOpenMessage(data);
  }

  return false;
}

export function notificationRouteDataFromResponse(response: unknown): INotification["data"] | null {
  const data = dataRecord(response);
  const route = text(data.route);
  const id = text(data.id);
  if (!route || !id) return null;
  return data as INotification["data"];
}
