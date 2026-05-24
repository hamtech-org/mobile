import type { INotification, NotificationType } from "@/types/notification.types";

export interface NotificationActor {
  id: string | null;
  name: string;
  avatar: string | null;
}

export function getNotificationActor(item: INotification): NotificationActor {
  const data = item.data ?? {};
  const extra =
    data.extra && typeof data.extra === "object" ? (data.extra as Record<string, unknown>) : {};

  const avatarRaw =
    data.actorAvatar ?? extra.actorAvatar ?? extra.senderAvatar ?? extra.authorAvatar ?? null;
  const avatar = typeof avatarRaw === "string" && avatarRaw.trim() ? avatarRaw.trim() : null;

  const nameRaw =
    data.actorName ?? extra.actorName ?? extra.senderName ?? extra.authorName ?? item.title;
  const name = typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : "HamTech";

  const idRaw =
    data.actorId ?? extra.actorId ?? extra.senderId ?? extra.authorId ?? data.id ?? null;
  const id = typeof idRaw === "string" && idRaw.trim() ? idRaw.trim() : null;

  return { id, name, avatar };
}

const TYPE_INITIAL: Partial<Record<NotificationType, string>> = {
  message: "💬",
  friend_request: "👋",
  friend_accepted: "✓",
  post_reaction: "❤",
  post_comment: "💭",
  reel_new: "▶",
  reel_comment: "💭",
  live_started: "🔴",
  system: "🔔",
  mention: "@",
  community_invite: "👥",
  community_invite_accepted: "✅",
  community_join_request: "👥",
  community_request_resolved: "✅",
  community_member_kicked: "🚫",
  community_role_changed: "⭐",
  community_ownership_transferred: "👑",
  community_chat_enabled: "💬",
  post_approved: "✅",
  post_rejected: "❌",
};

export function getNotificationFallbackInitial(item: INotification): string {
  const actor = getNotificationActor(item);
  return actor.name.charAt(0).toUpperCase() || TYPE_INITIAL[item.type] || "?";
}
