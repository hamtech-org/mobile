import type { NotificationType } from "@/types/notification.types";
import type { SystemNotificationChannel } from "@/utils/localSystemNotification";

export type NotificationInteraction = "view" | "reply" | "call_actions" | "alert_only";

export type SystemNotificationCategory =
  | "hamtech_message"
  | "hamtech_call_direct"
  | "hamtech_call_group"
  | "hamtech_call_missed"
  | "hamtech_social"
  | "hamtech_social_friend"
  | "hamtech_social_view";

export type NotificationKind =
  | "chat_message"
  | "chat_call_direct"
  | "chat_call_group"
  | "chat_call_missed"
  | "inbox_message"
  | "inbox_social"
  | "friend_request"
  | "friend_accepted"
  | "reel_new"
  | "live_started";

export const NOTIFICATION_ACTION = {
  REPLY: "reply",
  ANSWER: "answer",
  DECLINE: "decline",
  CALLBACK: "callback",
  MESSAGE: "message",
  /** Tắt thông báo hội thoại / social trong 1 phút */
  MUTE_1M: "mute_1m",
  /** Mở nội dung (bài, reel, live, hộp thông báo) */
  VIEW: "view",
  /** Chấp nhận lời mời kết bạn */
  ACCEPT: "accept",
  /** Từ chối lời mời kết bạn */
  FRIEND_DECLINE: "friend_decline",
} as const;

export type NotificationActionId = (typeof NOTIFICATION_ACTION)[keyof typeof NOTIFICATION_ACTION];

export interface NotificationKindSpec {
  kind: NotificationKind;
  label: string;
  channel: SystemNotificationChannel;
  categoryId: SystemNotificationCategory;
  interaction: NotificationInteraction;
  behaviorHint: string;
  suppressRemoteWhenForeground: boolean;
}

const SPECS: Record<NotificationKind, NotificationKindSpec> = {
  chat_message: {
    kind: "chat_message",
    label: "Tin nhắn chat",
    channel: "messages",
    categoryId: "hamtech_message",
    interaction: "reply",
    behaviorHint: "Trả lời nhanh trên thông báo; chạm mở hội thoại",
    suppressRemoteWhenForeground: true,
  },
  chat_call_direct: {
    kind: "chat_call_direct",
    label: "Cuộc gọi 1:1",
    channel: "calls",
    categoryId: "hamtech_call_direct",
    interaction: "call_actions",
    behaviorHint: "Trả lời / Từ chối; chạm mở màn gọi",
    suppressRemoteWhenForeground: true,
  },
  chat_call_group: {
    kind: "chat_call_group",
    label: "Cuộc gọi nhóm",
    channel: "calls",
    categoryId: "hamtech_call_group",
    interaction: "call_actions",
    behaviorHint: "Trả lời / Từ chối; chạm mở màn gọi nhóm",
    suppressRemoteWhenForeground: true,
  },
  chat_call_missed: {
    kind: "chat_call_missed",
    label: "Cuộc gọi bị nhỡ",
    channel: "messages",
    categoryId: "hamtech_call_missed",
    interaction: "call_actions",
    behaviorHint: "Gọi lại hoặc nhắn tin nhanh; chạm mở hội thoại",
    suppressRemoteWhenForeground: false,
  },
  inbox_message: {
    kind: "inbox_message",
    label: "Hộp thông báo - tin nhắn",
    channel: "messages",
    categoryId: "hamtech_message",
    interaction: "reply",
    behaviorHint: "Giống tin nhắn chat; từ notification:new",
    suppressRemoteWhenForeground: true,
  },
  inbox_social: {
    kind: "inbox_social",
    label: "Hộp thông báo - xã hội",
    channel: "social",
    categoryId: "hamtech_social_view",
    interaction: "view",
    behaviorHint: "Xem",
    suppressRemoteWhenForeground: true,
  },
  friend_request: {
    kind: "friend_request",
    label: "Lời mời kết bạn",
    channel: "social",
    categoryId: "hamtech_social_friend",
    interaction: "reply",
    behaviorHint: "Chấp nhận / Từ chối",
    suppressRemoteWhenForeground: true,
  },
  friend_accepted: {
    kind: "friend_accepted",
    label: "Chấp nhận kết bạn",
    channel: "social",
    categoryId: "hamtech_social_view",
    interaction: "view",
    behaviorHint: "Xem",
    suppressRemoteWhenForeground: true,
  },
  reel_new: {
    kind: "reel_new",
    label: "Reel mới",
    channel: "social",
    categoryId: "hamtech_social_view",
    interaction: "view",
    behaviorHint: "Xem",
    suppressRemoteWhenForeground: true,
  },
  live_started: {
    kind: "live_started",
    label: "Livestream",
    channel: "social",
    categoryId: "hamtech_social_view",
    interaction: "view",
    behaviorHint: "Xem",
    suppressRemoteWhenForeground: true,
  },
};

export function getNotificationSpec(kind: NotificationKind): NotificationKindSpec {
  return SPECS[kind];
}

export function inboxTypeToNotificationKind(
  type: NotificationType,
  route?: string,
): NotificationKind {
  if (type === "call_missed") return "chat_call_missed";
  if (type === "message" || route === "chat") return "inbox_message";
  if (type === "friend_request") return "friend_request";
  if (type === "friend_accepted") return "friend_accepted";
  if (type === "reel_new" || type === "reel_comment") return "reel_new";
  if (type === "live_started") return "live_started";
  return "inbox_social";
}

export function shouldSuppressRemotePushInForeground(kind: string): boolean {
  const spec = SPECS[kind as NotificationKind];
  return spec?.suppressRemoteWhenForeground === true;
}

export function listNotificationSpecs(): NotificationKindSpec[] {
  return Object.values(SPECS);
}
