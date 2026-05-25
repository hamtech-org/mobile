import type { INotification, NotificationType } from "@/types/notification.types";
import { getNotificationPresentation } from "@/utils/notificationPresentation";

export type NotificationFilterChip =
  | "all"
  | "unread"
  | "message"
  | "direct"
  | "group"
  | "friend"
  | "post"
  | "reel"
  | "live"
  | "community";

const MESSAGE_TYPES: NotificationType[] = ["message", "group_invite", "mention"];
const FRIEND_TYPES: NotificationType[] = ["friend_request", "friend_accepted"];
const POST_TYPES: NotificationType[] = ["post_reaction", "post_comment", "comment_reply"];
const REEL_TYPES: NotificationType[] = ["reel_new", "reel_comment"];
const COMMUNITY_TYPES: NotificationType[] = [
  "community_join_request",
  "community_request_resolved",
  "community_member_kicked",
  "community_role_changed",
  "community_ownership_transferred",
  "post_approved",
  "post_rejected",
  "community_invite",
  "community_invite_accepted",
  "community_chat_enabled",
];

export function filterNotifications(
  items: INotification[],
  chip: NotificationFilterChip,
  hiddenIds: Set<string>,
): INotification[] {
  let list = items.filter((n) => !hiddenIds.has(n.notificationId));

  switch (chip) {
    case "unread":
      list = list.filter((n) => !n.isRead);
      break;
    case "message":
      list = list.filter((n) => MESSAGE_TYPES.includes(n.type));
      break;
    case "direct":
      list = list.filter((n) => getNotificationPresentation(n).kind === "chat_direct");
      break;
    case "group":
      list = list.filter((n) => getNotificationPresentation(n).kind === "chat_group");
      break;
    case "friend":
      list = list.filter((n) => FRIEND_TYPES.includes(n.type));
      break;
    case "post":
      list = list.filter((n) => POST_TYPES.includes(n.type));
      break;
    case "community":
      list = list.filter((n) => COMMUNITY_TYPES.includes(n.type));
      break;
    case "reel":
      list = list.filter((n) => REEL_TYPES.includes(n.type));
      break;
    case "live":
      list = list.filter((n) => n.type === "live_started");
      break;
    default:
      break;
  }

  return list;
}
