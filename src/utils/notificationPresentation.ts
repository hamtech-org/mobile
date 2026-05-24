import type { INotification, NotificationType } from "@/types/notification.types";

type DataRecord = Record<string, unknown>;

export type NotificationPresentationKind =
  | "chat_direct"
  | "chat_group"
  | "group_invite"
  | "friend_request"
  | "friend_accepted"
  | "post"
  | "reel"
  | "live"
  | "mention"
  | "ai"
  | "system";

export interface NotificationPresentation {
  kind: NotificationPresentationKind;
  label: string;
  who: string;
  title: string;
  body: string;
  avatar: string | null;
  fallback: string;
}

const TYPE_LABEL: Record<NotificationType, string> = {
  friend_request: "Lời mời kết bạn",
  friend_accepted: "Đã chấp nhận",
  message: "Tin nhắn",
  group_invite: "Lời mời nhóm",
  post_reaction: "Bài viết",
  post_comment: "Bình luận",
  mention: "Nhắc đến bạn",
  system: "Hệ thống",
  reel_new: "Reels",
  reel_comment: "Reels",
  live_started: "Livestream",
  comment_reply: "Trả lời bình luận",
  ai_job_done: "AI",
  stats_milestone: "Thống kê",
  call_missed: "Cuộc gọi nhỡ",
};

function asRecord(value: unknown): DataRecord {
  return value && typeof value === "object" ? (value as DataRecord) : {};
}

function extraOf(item: INotification): DataRecord {
  return asRecord(item.data?.extra);
}

function textFrom(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function boolFrom(...values: unknown[]): boolean {
  return values.some((value) => value === true || value === "true" || value === "group");
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[words.length - 1][0] ?? ""}`.toUpperCase();
  }
  return Array.from(name.trim()).slice(0, 2).join("").toUpperCase() || "?";
}

function stripActorPrefix(body: string, actorName: string | null): string {
  const text = body.trim();
  const actor = actorName?.trim();
  if (!actor) return text;

  const lowerText = text.toLocaleLowerCase("vi-VN");
  const lowerActor = actor.toLocaleLowerCase("vi-VN");
  if (lowerText.startsWith(`${lowerActor}:`)) {
    return text.slice(actor.length + 1).trim();
  }
  if (lowerText.startsWith(`${lowerActor} `)) {
    return text.slice(actor.length).trim();
  }
  return text;
}

function bodyWithActor(body: string, actorName: string | null): string {
  const text = body.trim();
  const actor = actorName?.trim();
  if (!actor) return text;
  if (text.toLocaleLowerCase("vi-VN").startsWith(`${actor.toLocaleLowerCase("vi-VN")}:`)) {
    return text;
  }
  return `${actor}: ${stripActorPrefix(text, actor)}`;
}

function actorName(data: DataRecord, extra: DataRecord): string | null {
  return textFrom(
    data.actorName,
    data.senderName,
    data.authorName,
    extra.actorName,
    extra.senderName,
    extra.authorName,
  );
}

function actorAvatar(data: DataRecord, extra: DataRecord): string | null {
  return textFrom(
    data.actorAvatar,
    data.senderAvatar,
    data.authorAvatar,
    extra.actorAvatar,
    extra.senderAvatar,
    extra.authorAvatar,
  );
}

function groupName(data: DataRecord, extra: DataRecord): string | null {
  return textFrom(
    data.conversationName,
    data.groupName,
    data.chatName,
    extra.conversationName,
    extra.groupName,
    extra.chatName,
  );
}

function groupAvatar(data: DataRecord, extra: DataRecord): string | null {
  return textFrom(
    data.conversationAvatar,
    data.groupAvatar,
    data.chatAvatar,
    extra.conversationAvatar,
    extra.groupAvatar,
    extra.chatAvatar,
  );
}

function isGroupChat(data: DataRecord, extra: DataRecord): boolean {
  return boolFrom(
    data.isGroup,
    data.chatScope,
    data.conversationType,
    extra.isGroup,
    extra.chatScope,
    extra.conversationType,
  );
}

export function getNotificationPresentation(item: INotification): NotificationPresentation {
  const data = asRecord(item.data);
  const extra = extraOf(item);
  const actor = actorName(data, extra);
  const actorAv = actorAvatar(data, extra);
  const fallbackWho = actor ?? textFrom(item.title) ?? "HamTech";

  if (item.type === "message") {
    const group = isGroupChat(data, extra);
    const chatName = groupName(data, extra) ?? (group ? "Nhóm chat" : null);
    const preview =
      textFrom(data.messagePreview, data.preview, extra.messagePreview, extra.preview, item.body) ??
      "Bạn có tin nhắn mới";
    const sender = actor ?? textFrom(item.title) ?? "Tin nhắn mới";

    if (group) {
      const who = chatName ?? "Nhóm chat";
      return {
        kind: "chat_group",
        label: "Tin nhắn nhóm",
        who,
        title: who,
        body: bodyWithActor(preview, sender),
        avatar: groupAvatar(data, extra) ?? actorAv,
        fallback: initials(who),
      };
    }

    return {
      kind: "chat_direct",
      label: "Tin nhắn 1:1",
      who: sender,
      title: sender,
      body: stripActorPrefix(preview, sender),
      avatar: actorAv,
      fallback: initials(sender),
    };
  }

  if (item.type === "friend_request" || item.type === "friend_accepted") {
    const who = actor ?? textFrom(item.title) ?? "Bạn bè";
    return {
      kind: item.type,
      label: TYPE_LABEL[item.type],
      who,
      title: who,
      body: stripActorPrefix(item.body || TYPE_LABEL[item.type], actor),
      avatar: actorAv,
      fallback: initials(who),
    };
  }

  if (item.type === "group_invite") {
    const who = groupName(data, extra) ?? actor ?? textFrom(item.title) ?? "Nhóm chat";
    return {
      kind: "group_invite",
      label: TYPE_LABEL[item.type],
      who,
      title: who,
      body: stripActorPrefix(item.body || "Bạn có lời mời vào nhóm", actor),
      avatar: groupAvatar(data, extra) ?? actorAv,
      fallback: initials(who),
    };
  }

  if (item.type === "reel_new" || item.type === "reel_comment") {
    const who = actor ?? textFrom(item.title) ?? "Reels";
    return {
      kind: "reel",
      label: TYPE_LABEL[item.type],
      who,
      title: who,
      body: stripActorPrefix(item.body || TYPE_LABEL[item.type], actor),
      avatar: actorAv,
      fallback: initials(who),
    };
  }

  if (item.type === "live_started") {
    const who = actor ?? textFrom(item.title) ?? "Livestream";
    return {
      kind: "live",
      label: TYPE_LABEL[item.type],
      who,
      title: who,
      body: stripActorPrefix(item.body || "đang phát live", actor),
      avatar: actorAv,
      fallback: initials(who),
    };
  }

  if (
    item.type === "post_reaction" ||
    item.type === "post_comment" ||
    item.type === "comment_reply"
  ) {
    const who = actor ?? textFrom(item.title) ?? TYPE_LABEL[item.type];
    return {
      kind: "post",
      label: TYPE_LABEL[item.type],
      who,
      title: who,
      body: stripActorPrefix(item.body || TYPE_LABEL[item.type], actor),
      avatar: actorAv,
      fallback: initials(who),
    };
  }

  if (item.type === "mention") {
    const who = actor ?? textFrom(item.title) ?? "Nhắc đến bạn";
    return {
      kind: "mention",
      label: TYPE_LABEL[item.type],
      who,
      title: who,
      body: stripActorPrefix(item.body || "đã nhắc đến bạn", actor),
      avatar: actorAv,
      fallback: initials(who),
    };
  }

  if (item.type === "ai_job_done") {
    return {
      kind: "ai",
      label: TYPE_LABEL[item.type],
      who: "AI",
      title: textFrom(item.title) ?? "AI",
      body: item.body,
      avatar: null,
      fallback: "AI",
    };
  }

  return {
    kind: "system",
    label: TYPE_LABEL[item.type] ?? "Thông báo",
    who: fallbackWho,
    title: textFrom(item.title) ?? fallbackWho,
    body: item.body,
    avatar: actorAv,
    fallback: initials(fallbackWho),
  };
}
