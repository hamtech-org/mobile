import { conversationApi } from "@/store/api/endpoints/conversationApi";
import { store } from "@/store/store";
import type { IncomingCallData } from "@/types/call.types";
import { fetchSenderAvatarUrl, resolveChatSenderAvatarUrl } from "@/utils/notificationAvatar";
import { pushChatNotificationStack, type ChatMessagingLine } from "@/utils/chatNotificationStack";
import {
  dismissCallSystemNotification,
  NOTIFICATION_DELIVERY_PUSH,
  NOTIFICATION_DELIVERY_SOCKET,
  showLocalSystemNotification,
  type LocalSystemNotificationInput,
} from "@/utils/localSystemNotification";
import { categoryForNotificationKind } from "@/utils/notificationCategoryActions";
import { getNotificationSpec, type NotificationKind } from "@/utils/notificationRegistry";
import {
  buildCallNotificationLayout,
  buildMessageNotificationLayout,
  type ChatNotificationScope,
} from "@/utils/systemNotificationLayout";

export interface ChatMessageNotificationOptions {
  avatarUrl?: string | null;
  senderAvatarUrl?: string | null;
  isGroup?: boolean;
  groupName?: string | null;
  messageId?: string;
}

export interface ConversationStackNotificationOptions {
  isGroup?: boolean;
  groupName?: string | null;
  avatarUrl?: string | null;
  senderAvatarUrl?: string | null;
  senderName?: string | null;
  messageId?: string;
  /** Khóa dedupe theo sự kiện (poll, task, …) — không gộp trùng dòng. */
  eventKey?: string;
  channel?: "messages" | "social" | "default";
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
  deliverySource: string = NOTIFICATION_DELIVERY_SOCKET,
): LocalSystemNotificationInput["data"] {
  const spec = getNotificationSpec(kind);
  return {
    route,
    id,
    notificationKind: kind,
    deliverySource,
    interaction: spec.interaction,
    ...extra,
  } as LocalSystemNotificationInput["data"];
}

function resolveGroupName(conversationId: string): string | null {
  const conv = conversationApi.endpoints.getConversations
    .select(undefined)(store.getState())
    ?.data?.find((c) => c.conversationId === conversationId);
  return conv?.name?.trim() ?? null;
}

function resolveConversationMeta(
  conversationId: string,
  options?: ConversationStackNotificationOptions,
): {
  isGroup: boolean;
  groupName: string | null;
  chatScope: ChatNotificationScope;
} {
  const conv = conversationApi.endpoints.getConversations
    .select(undefined)(store.getState())
    ?.data?.find((c) => c.conversationId === conversationId);
  const isGroup = options?.isGroup ?? conv?.type === "group";
  const rawName = options?.groupName ?? (isGroup ? resolveGroupName(conversationId) : null);
  const groupName =
    rawName && isGroup ? (rawName.startsWith("Nhóm:") ? rawName : `Nhóm: ${rawName}`) : null;
  return {
    isGroup,
    groupName,
    chatScope: isGroup ? "group" : "direct",
  };
}

function presentConversationStackNotification(
  conversationId: string,
  lineText: string,
  options?: ConversationStackNotificationOptions,
  deliverySource: string = NOTIFICATION_DELIVERY_SOCKET,
): void {
  const cid = conversationId.trim();
  if (!cid) return;

  const { isGroup, groupName, chatScope } = resolveConversationMeta(cid, options);
  const sender = options?.senderName?.trim() || "Tin nhắn mới";
  /** Nhóm: prefix hiển thị qua senderName; 1:1 chỉ nội dung tin. */
  const stackLine = lineText;

  const dedupeKey = options?.messageId?.trim() || options?.eventKey?.trim() || undefined;
  const snapshot = pushChatNotificationStack(cid, stackLine, {
    senderName: isGroup ? sender : undefined,
    dedupeKey,
  });
  if (!snapshot) return;

  const layout = buildMessageNotificationLayout({
    senderName: sender,
    preview: snapshot.latestLine.text,
    isGroup,
    groupName,
  });

  const kind: NotificationKind = "chat_message";
  const spec = getNotificationSpec(kind);
  const categoryIdentifier = categoryForNotificationKind(kind);
  const messageId = dedupeKey;

  void showLocalSystemNotification(
    {
      title: layout.title,
      body: snapshot.collapsedBody,
      subtitle: isGroup && snapshot.totalCount > 1 ? undefined : layout.subtitle,
      channel: options?.channel ?? spec.channel,
      categoryIdentifier,
      notificationId: snapshot.notificationId,
      avatarUrl: options?.avatarUrl,
      data: baseData(
        kind,
        "chat",
        cid,
        {
          chatScope,
          conversationType: chatScope,
          conversationName: groupName,
          messageCount: snapshot.totalCount,
          messagingLines: snapshot.lines,
          ...(snapshot.overflowSummary ? { stackFooter: snapshot.overflowSummary } : {}),
          ...(messageId ? { messageId } : {}),
          ...(options?.senderAvatarUrl
            ? { senderAvatar: options.senderAvatarUrl, actorAvatar: options.senderAvatarUrl }
            : options?.avatarUrl
              ? { senderAvatar: options.avatarUrl, actorAvatar: options.avatarUrl }
              : {}),
        },
        deliverySource,
      ),
    },
    { fromRemotePush: deliverySource === NOTIFICATION_DELIVERY_PUSH },
  );
}

/** Gộp Expo push tin nhắn vào một banner (cùng conversationId). */
export function presentChatNotificationFromRemotePush(content: {
  title?: string | null;
  body?: string | null;
  data?: Record<string, unknown>;
}): boolean {
  const data = content.data ?? {};
  if (String(data.route ?? "") !== "chat") return false;

  const conversationId = String(data.id ?? data.entityId ?? "").trim();
  if (!conversationId) return false;

  const preview = String(
    data.messagePreview ?? data.preview ?? content.body ?? "Bạn có tin nhắn mới",
  ).trim();
  const sender = String(
    data.senderName ?? data.actorName ?? content.title ?? "Tin nhắn mới",
  ).trim();
  const isGroup =
    data.conversationType === "group" || data.chatScope === "group" || data.isGroup === true;
  const groupName =
    typeof data.conversationName === "string"
      ? data.conversationName
      : typeof data.groupName === "string"
        ? data.groupName
        : null;

  presentConversationStackNotification(
    conversationId,
    preview,
    {
      isGroup,
      groupName,
      messageId: typeof data.messageId === "string" ? data.messageId : undefined,
      avatarUrl:
        (typeof data.actorAvatar === "string" ? data.actorAvatar : null) ??
        (typeof data.senderAvatar === "string" ? data.senderAvatar : null) ??
        (typeof data.imageUrl === "string" ? data.imageUrl : null),
      senderAvatarUrl: typeof data.senderAvatar === "string" ? data.senderAvatar : undefined,
      senderName: sender,
    },
    NOTIFICATION_DELIVERY_PUSH,
  );
  return true;
}

export function presentChatMessageNotification(
  senderName: string,
  preview: string,
  conversationId: string,
  options?: ChatMessageNotificationOptions,
): void {
  presentConversationStackNotification(conversationId, preview, {
    isGroup: options?.isGroup,
    groupName: options?.groupName,
    avatarUrl: options?.avatarUrl,
    senderAvatarUrl: options?.senderAvatarUrl,
    senderName,
    messageId: options?.messageId,
  });
}

/** Thông báo nhóm gộp chung banner `chat-{groupId}` (poll, task, ghim, …). */
export function presentGroupActivityNotification(
  conversationId: string,
  body: string,
  options?: Omit<ConversationStackNotificationOptions, "isGroup"> & {
    title?: string;
  },
): void {
  const cid = conversationId.trim();
  if (!cid) return;
  const { groupName } = resolveConversationMeta(cid, { ...options, isGroup: true });
  const conv = conversationApi.endpoints.getConversations
    .select(undefined)(store.getState())
    ?.data?.find((c) => c.conversationId === cid);

  presentConversationStackNotification(cid, body, {
    ...options,
    isGroup: true,
    groupName: options?.groupName ?? groupName,
    avatarUrl: options?.avatarUrl ?? conv?.avatar?.trim() ?? null,
    channel: options?.channel ?? "messages",
  });
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

export type { ChatMessagingLine };
