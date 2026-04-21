// ─── Message & Conversation Types ──────────────────────────────────────────────
// Đồng bộ với web frontend types — backend là source of truth.

export type MessageType =
  | "system"
  | "text"
  | "image"
  | "video"
  | "file"
  | "sticker"
  | "emoji"
  | "location"
  | "poll"
  | "schedule"
  | "call";

export type MessageStatus = "sent" | "delivered" | "read" | "sending" | "failed";
export type ConversationType = "direct" | "group";
export type MemberRole = "owner" | "admin" | "member";

export interface ILastMessage {
  messageId?: string;
  content: string;
  senderId: string;
  type: MessageType;
  createdAt: string;
  senderDisplayName?: string | null;
}

export interface IGroupMemberPermissions {
  changeNameAvatar: boolean;
  pinMessages: boolean;
  createNotesReminders: boolean;
  createPolls: boolean;
  sendMessages: boolean;
}

export interface IGroupAdminSettings {
  approvalRequired: boolean;
  highlightLeaderMessages: boolean;
  newMembersReadRecent: boolean;
  allowJoinLink: boolean;
}

export interface IGroupSettings {
  memberPermissions: IGroupMemberPermissions;
  adminSettings: IGroupAdminSettings;
  joinLinkSuffix?: string;
}

export interface IConversation {
  conversationId: string;
  type: ConversationType;
  name: string | null;
  avatar: string | null;
  lastMessage: ILastMessage | null;
  memberCount: number;
  unreadCount: number;
  updatedAt?: string;
  otherUserId?: string;
  /** Theo MEMBER# của user đang đăng nhập (danh sách hội thoại). */
  isMuted?: boolean;
  isPinnedToTop?: boolean;
  notificationsMutedUntil?: string | null;
}

export interface IReplyToDetails {
  messageId: string;
  senderId: string;
  senderDisplayName: string | null;
  content: string;
  type: MessageType;
}

export interface IMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  senderDisplayName?: string | null;
  position?: "left" | "right" | "center";
  type: MessageType;
  content: string;
  mediaUrl: string | null;
  mediaType?: string | null;
  mediaSize?: number | null;
  mediaOriginalName?: string | null;
  thumbnailUrl: string | null;
  replyTo: string | null;
  replyToDetails?: IReplyToDetails | null;
  isPinned: boolean;
  isEdited: boolean;
  isRecalled: boolean;
  isDeleted?: boolean;
  reactions: Record<string, string[]>;
  status: MessageStatus;
  createdAt: string;
}

export interface IGroupMember {
  userId: string;
  displayName: string;
  avatar?: string | null;
  role: MemberRole;
  joinedAt?: string;
}

export interface TypingUserEntry {
  userId: string;
  displayName: string;
}
