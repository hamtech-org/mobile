import type { INotification, NotificationType } from "@/types/notification.types";

/** Tin nhắn dùng badge tab Chat — không cộng vào chuông. */
const BELL_EXCLUDED: NotificationType[] = ["message"];

export function countsTowardBell(type: NotificationType): boolean {
  return !BELL_EXCLUDED.includes(type);
}

export function countBellUnread(notifications: INotification[]): number {
  return notifications.filter((n) => !n.isRead && countsTowardBell(n.type)).length;
}
