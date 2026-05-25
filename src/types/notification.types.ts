export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "message"
  | "group_invite"
  | "post_reaction"
  | "post_comment"
  | "mention"
  | "system"
  | "reel_new"
  | "reel_comment"
  | "live_started"
  | "comment_reply"
  | "ai_job_done"
  | "stats_milestone"
  | "call_missed";

export type NotificationRoute =
  | "chat"
  | "post"
  | "reel"
  | "friends"
  | "profile"
  | "notifications"
  | "call"
  | "live"
  | "ai";

export interface INotificationRouteData {
  route: NotificationRoute;
  id: string;
  deepLink?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string | null;
  messageId?: string;
  messagePreview?: string;
  conversationType?: "direct" | "group";
  chatScope?: "direct" | "group";
  conversationName?: string | null;
  conversationAvatar?: string | null;
  groupName?: string | null;
  groupAvatar?: string | null;
  extra?: Record<string, unknown>;
}

export interface INotification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: INotificationRouteData & Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}
