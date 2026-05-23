import type { IPost } from "./newsfeed.types";

export const COMMUNITY_CATEGORIES = [
  "general",
  "technology",
  "sports",
  "music",
  "education",
  "gaming",
  "lifestyle",
] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number];
export type CommunityType = "public" | "private";
export type CommunityJoinPolicy = "open" | "approval";
export type CommunityMemberRole = "owner" | "admin" | "moderator" | "member";
export type CommunityRequestStatus = "pending" | "approved" | "rejected";

export interface ICommunityRule {
  id: string;
  title: string;
  description: string;
}

export interface ICommunity {
  groupId: string;
  communityId: string;
  name: string;
  slug: string;
  description: string | null;
  avatar: string | null;
  coverUrl: string | null;
  category: CommunityCategory;
  rules?: ICommunityRule[];
  type: CommunityType;
  joinPolicy: CommunityJoinPolicy;
  ownerId: string;
  memberCount: number;
  postCount: number;
  isActive: boolean;
  status: "active" | "archived";
  viewerRole?: CommunityMemberRole | null;
  viewerStatus?: "active" | "banned" | null;
  joinRequestStatus?: CommunityRequestStatus | null;
  isPostApprovalRequired?: boolean;
  conversationId?: string | null;
  chatEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ICommunityMember {
  groupId: string;
  userId: string;
  role: CommunityMemberRole;
  status: "active" | "banned";
  joinedAt: string;
}

export interface ICommunityJoinRequest {
  groupId: string;
  userId: string;
  status: CommunityRequestStatus;
  requestedAt: string;
  message?: string;
}

export interface ICommunityListPage {
  items: ICommunity[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ICommunityContentPage<T extends IPost> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ICreateCommunityDto {
  name: string;
  description?: string | null;
  avatar?: string | null;
  coverUrl?: string | null;
  category?: CommunityCategory;
  type: CommunityType;
  joinPolicy?: CommunityJoinPolicy;
  rules?: ICommunityRule[];
  isPostApprovalRequired?: boolean;
}

export interface ISearchGroupResult {
  groupId: string;
  communityId?: string;
  name: string;
  description: string | null;
  slug?: string;
  avatar?: string | null;
  coverUrl?: string | null;
  category?: string;
  memberCount: number;
  type: string;
}

export type CommunityModerationAction =
  | "approve_join"
  | "reject_join"
  | "ban_member"
  | "unban_member"
  | "change_role"
  | "transfer_ownership"
  | "approve_post"
  | "reject_post"
  | "delete_post"
  | "pin_post"
  | "unpin_post"
  | "update_settings";

export type CommunityModerationTargetType = "member" | "post" | "community";

export interface ICommunityModerationLog {
  groupId: string;
  communityId: string;
  logId: string;
  actorId: string;
  action: CommunityModerationAction;
  targetId: string;
  targetType: CommunityModerationTargetType;
  targetName?: string;
  reason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  createdAtMs: number;
  actorInfo?: {
    userId: string;
    displayName: string;
    avatar: string | null;
  };
  targetUserInfo?: {
    userId: string;
    displayName: string;
    avatar: string | null;
  };
}

export interface ICommunityModerationLogsPage {
  items: ICommunityModerationLog[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ICommunityReport {
  PK: string;
  SK: string;
  reportId: string;
  groupId: string;
  entityType: "POST" | "CMT" | "GROUP";
  entityId: string;
  reporterId: string;
  targetAuthorId: string;
  reason: "spam" | "harassment" | "hate_speech" | "inappropriate" | "rules_violation" | "other";
  details?: string;
  status: "pending" | "resolved_deleted" | "resolved_dismissed" | "resolved_warned";
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
  commentPostId?: string;
  commentCreatedAt?: string;
  reporterInfo?: {
    userId: string;
    displayName: string;
    avatar: string | null;
  };
  targetAuthorInfo?: {
    userId: string;
    displayName: string;
    avatar: string | null;
  };
  contentPreview?: {
    text?: string;
    mediaUrls?: string[];
  };
}

export interface ICommunityReportsPage {
  items: ICommunityReport[];
  nextCursor: string | null;
  hasMore: boolean;
}
