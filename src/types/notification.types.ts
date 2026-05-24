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
  | "community_chat_enabled"
  | "post_approved"
  | "post_rejected"
  | "community_invite"
  | "community_invite_accepted";

export type NotificationRoute =
  | "chat"
  | "post"
  | "reel"
  | "friends"
  | "profile"
  | "notifications"
  | "live"
  | "ai"
  | "community";

export interface INotificationRouteData {
  route: NotificationRoute;
  id: string;
  deepLink?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string | null;
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
