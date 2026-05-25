import type { NotificationKind, SystemNotificationCategory } from "@/utils/notificationRegistry";
import { NOTIFICATION_ACTION } from "@/utils/notificationRegistry";

/** Profile quyết định nút trên banner — social “bao quát” theo ngữ cảnh. */
export type NotificationActionProfile =
  | "message"
  | "call_incoming"
  | "call_missed"
  | "social_friend"
  | "social_view";

export function categoryForActionProfile(
  profile: NotificationActionProfile,
): SystemNotificationCategory {
  switch (profile) {
    case "message":
      return "hamtech_message";
    case "call_incoming":
      return "hamtech_call_direct";
    case "call_missed":
      return "hamtech_call_missed";
    case "social_friend":
      return "hamtech_social_friend";
    case "social_view":
    default:
      return "hamtech_social_view";
  }
}

export function actionProfileForKind(kind: NotificationKind): NotificationActionProfile {
  switch (kind) {
    case "chat_message":
    case "inbox_message":
      return "message";
    case "chat_call_direct":
    case "chat_call_group":
      return "call_incoming";
    case "chat_call_missed":
      return "call_missed";
    case "friend_request":
      return "social_friend";
    case "friend_accepted":
    case "reel_new":
    case "live_started":
    case "inbox_social":
    default:
      return "social_view";
  }
}

export function categoryForNotificationKind(kind: NotificationKind): SystemNotificationCategory {
  if (kind === "chat_call_group") return "hamtech_call_group";
  if (kind === "chat_call_direct") return "hamtech_call_direct";
  if (kind === "chat_call_missed") return "hamtech_call_missed";
  return categoryForActionProfile(actionProfileForKind(kind));
}

/** Action id gửi xuống native Android (khớp NOTIFICATION_ACTION). */
export function nativeActionIdsForProfile(profile: NotificationActionProfile): string[] {
  switch (profile) {
    case "message":
      return [NOTIFICATION_ACTION.REPLY, NOTIFICATION_ACTION.MUTE_1M];
    case "call_incoming":
      return [NOTIFICATION_ACTION.DECLINE, NOTIFICATION_ACTION.ANSWER];
    case "call_missed":
      return [NOTIFICATION_ACTION.MESSAGE, NOTIFICATION_ACTION.CALLBACK];
    case "social_friend":
      return [NOTIFICATION_ACTION.FRIEND_DECLINE, NOTIFICATION_ACTION.ACCEPT];
    case "social_view":
      return [NOTIFICATION_ACTION.VIEW];
    default:
      return [];
  }
}
