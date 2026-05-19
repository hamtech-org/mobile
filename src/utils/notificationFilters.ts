import type { INotification, NotificationType } from "@/types/notification.types";

export type NotificationFilterChip = "all" | "unread" | "message" | "post";

const MESSAGE_TYPES: NotificationType[] = ["message", "group_invite", "mention"];
const POST_TYPES: NotificationType[] = [
  "post_reaction",
  "post_comment",
  "reel_new",
  "reel_comment",
  "comment_reply",
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
    case "post":
      list = list.filter((n) => POST_TYPES.includes(n.type));
      break;
    default:
      break;
  }

  return list;
}
