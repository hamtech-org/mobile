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
  reactionsCount: Record<string, number>;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isModerated: boolean;
  moderationStatus: ModerationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IComment {
  commentId: string;
  postId: string;
  authorId: string;
  content: string;
  parentId: string | null;
  reactionsCount: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}
