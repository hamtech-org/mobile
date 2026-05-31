import * as Notifications from "expo-notifications";
import { router, type Href } from "expo-router";

import { conversationApi } from "@/store/api/endpoints/conversationApi";
import { messageApi } from "@/store/api/endpoints/messageApi";
import { userApi } from "@/store/api/userApi";
import { store } from "@/store/store";
import type { INotification } from "@/types/notification.types";
import { getSocketClient, normalizeSocketAuthToken } from "@/services/socket";
import { toast } from "@/utils/appToast";
import { clearChatNotificationStack } from "@/utils/chatNotificationStack";
import { clearConversationNotificationState } from "@/utils/chatNotificationState";
import {
  answerCallFromNotificationData,
  callRouteParamsFromPayload,
  declineCallFromNotificationData,
} from "@/utils/callNotificationActions";
import { navigateFromNotification } from "@/utils/notificationNavigation";
import { NOTIFICATION_ACTION } from "@/utils/notificationRegistry";
import { buildPatchForMutePayload, describeMuteSuccess } from "@/utils/muteNotifications";

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
  const nativeNotification = objectRecord(detail?.notification);
  const nativeData = objectRecord(nativeNotification?.data);
  if (nativeData) return nativeData;

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

async function emitSocketEvent(event: string, payload: Record<string, unknown>): Promise<boolean> {
  const socket = getSocketClient();
  const token = normalizeSocketAuthToken(store.getState().auth.accessToken);
  if (!token) return false;
  if (token) socket.auth = { token };
  if (socket.connected) {
    socket.emit(event, payload);
    return true;
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      resolve(ok);
    };
    const onConnect = () => {
      socket.emit(event, payload);
      finish(true);
    };
    const onError = () => finish(false);
    const timeout = setTimeout(() => finish(false), 8000);

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });
}

function pushCallScreen(payload: Parameters<typeof callRouteParamsFromPayload>[0]): void {
  router.replace({
    pathname: "/call",
    params: callRouteParamsFromPayload(payload, "answer"),
  } as Href);
}

async function handleAnswerCall(data: Record<string, unknown>): Promise<boolean> {
  const payload = await answerCallFromNotificationData(data);
  if (!payload) return false;
  pushCallScreen(payload);
  return true;
}

async function handleDeclineCall(data: Record<string, unknown>): Promise<boolean> {
  return declineCallFromNotificationData(data);
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

  return emitSocketEvent("call:initiate", payload);
}

async function handleOpenMessage(data: Record<string, unknown>): Promise<boolean> {
  const conversationId = text(data.conversationId || data.entityId || data.id);
  if (!conversationId) return false;

  clearConversationNotificationState(conversationId);
  router.replace(`/(main)/(chat)/${conversationId}` as Href);
  return true;
}

async function dismissNotificationById(data: Record<string, unknown>): Promise<void> {
  const nid = text(data.notificationId);
  if (!nid) return;
  try {
    await Notifications.dismissNotificationAsync(nid);
  } catch {
    /* ignore */
  }
}

async function handleMuteOneMinute(data: Record<string, unknown>): Promise<boolean> {
  const route = text(data.route);
  const conversationId = text(data.conversationId ?? data.entityId ?? data.id);
  const notificationId = text(data.notificationId);

  /** Chỉ tin nhắn 1:1 / nhóm — không áp dụng social. */
  if (route !== "chat" || !conversationId) return false;

  try {
    await store
      .dispatch(
        conversationApi.endpoints.patchConversationPreferences.initiate(
          buildPatchForMutePayload(conversationId, { kind: "muteFor", muteFor: "1m" }),
        ),
      )
      .unwrap();
    clearChatNotificationStack(conversationId);
    toast.info(describeMuteSuccess({ kind: "muteFor", muteFor: "1m" }));
  } catch {
    toast.info("Không tắt được thông báo hội thoại");
    return false;
  }

  if (notificationId) {
    await dismissNotificationById({ notificationId });
  } else {
    await dismissNotificationById({ notificationId: `chat-${conversationId}` });
  }
  return true;
}

async function handleAcceptFriend(data: Record<string, unknown>): Promise<boolean> {
  const senderId = text(data.actorId ?? data.senderId ?? data.id);
  if (!senderId) return false;
  try {
    await store.dispatch(userApi.endpoints.acceptFriendRequest.initiate({ senderId })).unwrap();
    toast.success("Đã chấp nhận lời mời kết bạn");
    await dismissNotificationById(data);
    return true;
  } catch {
    toast.info("Không chấp nhận được lời mời");
    return false;
  }
}

async function handleDeclineFriend(data: Record<string, unknown>): Promise<boolean> {
  const senderId = text(data.actorId ?? data.senderId ?? data.id);
  if (!senderId) return false;
  try {
    await store.dispatch(userApi.endpoints.rejectFriendRequest.initiate({ senderId })).unwrap();
    toast.info("Đã từ chối lời mời kết bạn");
    await dismissNotificationById(data);
    return true;
  } catch {
    toast.info("Không từ chối được lời mời");
    return false;
  }
}

async function handleViewNotification(data: Record<string, unknown>): Promise<boolean> {
  const route = text(data.route);
  const id = text(data.id);
  if (!route) return false;
  navigateFromNotification({ route, id, ...data } as INotification["data"]);
  await dismissNotificationById(data);
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
  if (action === NOTIFICATION_ACTION.MUTE_1M) {
    return handleMuteOneMinute(data);
  }
  if (action === NOTIFICATION_ACTION.ACCEPT) {
    return handleAcceptFriend(data);
  }
  if (action === NOTIFICATION_ACTION.FRIEND_DECLINE) {
    return handleDeclineFriend(data);
  }
  if (action === NOTIFICATION_ACTION.VIEW) {
    return handleViewNotification(data);
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
