import type { CallType, IncomingCallData } from "@/types/call.types";
import type { SystemNotificationCategory } from "@/utils/notificationRegistry";

export type { SystemNotificationCategory } from "@/utils/notificationRegistry";

export type ChatNotificationScope = "direct" | "group";

export function sanitizeNotificationText(text: string, fallback: string): string {
  const t = text.trim();
  if (!t) return fallback;
  if (t.startsWith("{") || t.startsWith("[")) return fallback;
  if (t.includes('"kind"') && t.includes("{")) return fallback;
  return t;
}

export interface MessageNotificationLayout {
  title: string;
  body: string;
  subtitle?: string;
  categoryIdentifier: SystemNotificationCategory;
  chatScope: ChatNotificationScope;
}

export interface CallNotificationLayout {
  title: string;
  body: string;
  subtitle?: string;
  categoryIdentifier: SystemNotificationCategory;
  callScope: ChatNotificationScope;
  notificationId: string;
}

export function buildMessageNotificationLayout(input: {
  senderName: string;
  preview: string;
  isGroup: boolean;
  groupName?: string | null;
}): MessageNotificationLayout {
  const sender = sanitizeNotificationText(input.senderName, "Tin nhắn mới");
  const preview = sanitizeNotificationText(input.preview, "Bạn có tin nhắn mới");

  if (input.isGroup) {
    const group = input.groupName?.trim() || "Nhóm chat";
    return {
      title: group,
      body: `${sender}: ${preview}`,
      subtitle: sender,
      categoryIdentifier: "hamtech_message",
      chatScope: "group",
    };
  }

  return {
    title: sender,
    body: preview,
    categoryIdentifier: "hamtech_message",
    chatScope: "direct",
  };
}

function callBody(type: CallType, isGroup: boolean, callerName: string): string {
  const video = type === "video";
  if (isGroup) {
    const who = callerName.trim() || "Ai đó";
    return video ? `${who} - cuộc gọi video nhóm` : `${who} - đang gọi nhóm`;
  }
  return video ? "Cuộc gọi video đến" : "Đang gọi đến";
}

export function buildCallNotificationLayout(
  payload: IncomingCallData,
  groupName?: string | null,
): CallNotificationLayout {
  const scope = payload.scope === "group" ? "group" : "direct";
  const isGroup = scope === "group";
  const caller = sanitizeNotificationText(payload.callerName ?? "", "Ai đó");
  const customBody =
    typeof (payload as IncomingCallData & { pushBody?: unknown }).pushBody === "string"
      ? String((payload as IncomingCallData & { pushBody?: string }).pushBody).trim()
      : "";
  const body = sanitizeNotificationText(
    customBody || callBody(payload.type, isGroup, caller),
    "Đang gọi đến",
  );
  const notificationId = `call-${payload.channelName}`;

  if (isGroup) {
    const group = groupName?.trim() || "Nhóm chat";
    return {
      title: group,
      body,
      subtitle: caller,
      categoryIdentifier: "hamtech_call_group",
      callScope: "group",
      notificationId,
    };
  }

  return {
    title: caller,
    body,
    categoryIdentifier: "hamtech_call_direct",
    callScope: "direct",
    notificationId,
  };
}
