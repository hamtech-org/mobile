import { conversationApi } from "@/store/api/endpoints/conversationApi";
import { store } from "@/store/store";
import type { IncomingCallData } from "@/types/call.types";
import { fetchSenderAvatarUrl, resolveChatSenderAvatarUrl } from "@/utils/notificationAvatar";
import {
  dismissCallSystemNotification,
  NOTIFICATION_DELIVERY_SOCKET,
  showLocalSystemNotification,
  type LocalSystemNotificationInput,
} from "@/utils/localSystemNotification";
import { getNotificationSpec, type NotificationKind } from "@/utils/notificationRegistry";
import {
  buildCallNotificationLayout,
  buildMessageNotificationLayout,
} from "@/utils/systemNotificationLayout";

export interface ChatMessageNotificationOptions {
  avatarUrl?: string | null;
  senderAvatarUrl?: string | null;
  isGroup?: boolean;
  groupName?: string | null;
  messageId?: string;
}

function baseData(
  kind: NotificationKind,
  route: LocalSystemNotificationInput["data"] extends infer D
    ? D extends { route: infer R }
      ? R
      : never
    : never,
  id: string,
  extra?: Record<string, unknown>,
): LocalSystemNotificationInput["data"] {
  const spec = getNotificationSpec(kind);
  return {
    route,
    id,
    notificationKind: kind,
    deliverySource: NOTIFICATION_DELIVERY_SOCKET,
    interaction: spec.interaction,
    ...extra,
  } as LocalSystemNotificationInput["data"];
}

export function presentChatMessageNotification(
  senderName: string,
  preview: string,
  conversationId: string,
  options?: ChatMessageNotificationOptions,
): void {
  const kind: NotificationKind = "chat_message";
  const spec = getNotificationSpec(kind);
  const layout = buildMessageNotificationLayout({
    senderName,
    preview,
    isGroup: Boolean(options?.isGroup),
    groupName: options?.groupName,
  });
  const messageId = options?.messageId?.trim();

  void showLocalSystemNotification({
    title: layout.title,
    body: layout.body,
    subtitle: layout.subtitle,
    channel: spec.channel,
    categoryIdentifier: spec.categoryId,
    notificationId: `chat-${conversationId}`,
    avatarUrl: options?.avatarUrl,
    data: baseData(kind, "chat", conversationId, {
      chatScope: layout.chatScope,
      conversationType: layout.chatScope,
      conversationName: options?.groupName ?? null,
      ...(messageId ? { messageId } : {}),
      ...(options?.senderAvatarUrl
        ? { senderAvatar: options.senderAvatarUrl, actorAvatar: options.senderAvatarUrl }
        : options?.avatarUrl
          ? { senderAvatar: options.avatarUrl, actorAvatar: options.avatarUrl }
          : {}),
    }),
  });
}

function resolveGroupName(conversationId: string): string | null {
  const conv = conversationApi.endpoints.getConversations
    .select(undefined)(store.getState())
    ?.data?.find((c) => c.conversationId === conversationId);
  return conv?.name?.trim() ?? null;
}

export function showIncomingCallSystemNotification(payload: IncomingCallData): void {
  const groupName = payload.scope === "group" ? resolveGroupName(payload.conversationId) : null;
  const layout = buildCallNotificationLayout(payload, groupName);

  void (async () => {
    const payloadWithAvatar = payload as IncomingCallData & { callerAvatar?: string | null };
    let avatarUrl: string | null = payloadWithAvatar.callerAvatar?.trim() || null;
    const conv = conversationApi.endpoints.getConversations
      .select(undefined)(store.getState())
      ?.data?.find((c) => c.conversationId === payload.conversationId);
    if (!avatarUrl && payload.scope === "group") {
      avatarUrl = conv?.avatar ?? null;
    }
    if (!avatarUrl && payload.callerId) {
      avatarUrl = await fetchSenderAvatarUrl(payload.callerId);
    }
    if (!avatarUrl && conv && payload.callerId) {
      avatarUrl = resolveChatSenderAvatarUrl(conv, payload.callerId, null);
    }

    const kind: NotificationKind =
      layout.callScope === "group" ? "chat_call_group" : "chat_call_direct";
    const spec = getNotificationSpec(kind);
    void showLocalSystemNotification({
      title: layout.title,
      body: layout.body,
      subtitle: layout.subtitle,
      channel: spec.channel,
      categoryIdentifier: spec.categoryId,
      notificationId: layout.notificationId,
      avatarUrl,
      data: baseData(kind, "call", payload.channelName, {
        deepLink: "/call",
        entityType: "call",
        entityId: payload.channelName,
        conversationId: payload.conversationId,
        callScope: layout.callScope,
        channelName: payload.channelName,
        callType: payload.type,
        callStatus: "incoming",
        callerId: payload.callerId,
        callerName: payload.callerName,
        hostId: payload.hostId,
      }),
    });
  })();
}

export { dismissCallSystemNotification };
