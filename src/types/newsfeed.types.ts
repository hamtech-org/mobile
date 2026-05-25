import type { ReactionType } from "./reaction.types";

export type PostType = "text" | "image" | "video" | "link";
export type PostVisibility = "public" | "friends" | "private";
export type PostPublicationStatus = "draft" | "published";
export type ModerationStatus = "pending" | "approved" | "rejected";

export interface IAuthorInfo {
  userId: string;
  displayName: string;
  avatar: string | null;
}

export interface ICommunityInfo {
  groupId: string;
  name: string;
  avatar: string | null;
}

export interface ISharedPostInfo {
  postId: string;
  authorId: string;
  content?: string;
  mediaUrls?: string[];
  type?: PostType;
  author?: IAuthorInfo;
  createdAt: string;
}

export interface IPost {
  postId: string;
  authorId: string;
  groupId?: string;
  communityId?: string;
  content: string;
  mediaUrls: string[];
  type: PostType;
  visibility: PostVisibility;
  publicationStatus: PostPublicationStatus;
  categories: string[];
  tags: string[];
  author?: IAuthorInfo;
  reactionsCount: Partial<Record<ReactionType, number>>;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isModerated: boolean;
  moderationStatus: ModerationStatus;
  currentUserReaction?: ReactionType | null;
  isSaved?: boolean;
  isPinned?: boolean;
  sharedFrom?: ISharedPostInfo;
  createdAt: string;
  updatedAt: string;
  communityInfo?: ICommunityInfo;
}

export interface ISavedPost {
  userId: string;
  postId: string;
  savedAt: string;
  post?: IPost;
}

export interface ISavedPostsPage {
  items: ISavedPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface IComment {
  commentId: string;
  postId: string;
  authorId: string;
  content: string;
  mediaUrls?: string[];
  parentId: string | null;
  reactionsCount: Partial<Record<ReactionType, number>>;
  currentUserReaction?: ReactionType | null;
  repliesCount?: number;
  author?: IAuthorInfo;
  createdAt: string;
  updatedAt: string;
}

export interface IFeedPage {
  items: IPost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ICommentsPage {
  items: IComment[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── Reel (synced from backend newsfeed.types.ts) ──────────────────────────────

export type ReelAspectRatio = "9:16" | "1:1" | "4:5";
export type ReelProcessingStatus = "pending" | "ready" | "failed";
export type ReelFeedKind = "foryou" | "following";

export interface IReel {
  reelId: string;
  authorId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string;
  durationMs: number;
  width: number;
  height: number;
  aspectRatio: ReelAspectRatio;
  visibility: PostVisibility;
  processingStatus: ReelProcessingStatus;
  hashtags: string[];
  mentions: string[];
  viewsCount: number;
  reactionsCount: Partial<Record<ReactionType, number>>;
  commentsCount: number;
  sharesCount: number;
  savesCount: number;
  engagementScore?: number;
  createdAt: string;
  updatedAt: string;
  // Enriched from BE
  author?: IAuthorInfo;
  currentUserReaction?: ReactionType | null;
  isSaved?: boolean;
}

export interface IReelFeedPage {
  items: IReel[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ICreateReelDto {
  videoUrl: string;
  thumbnailUrl?: string | null;
  caption?: string;
  durationMs: number;
  width: number;
  height: number;
  aspectRatio?: ReelAspectRatio;
  visibility?: PostVisibility;
}

export type ReelReportReason = "spam" | "nudity" | "hate" | "violence" | "other";

export interface IReportReelDto {
  reason: ReelReportReason;
  details?: string;
}
