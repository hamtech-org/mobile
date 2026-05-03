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

export interface IPost {
  postId: string;
  authorId: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface IComment {
  commentId: string;
  postId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  reactionsCount: Partial<Record<ReactionType, number>>;
  currentUserReaction?: ReactionType | null;
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
