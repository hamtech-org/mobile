import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";
import type {
  IComment,
  ICommentsPage,
  ICreateReelDto,
  IFeedPage,
  IPost,
  IReel,
  IReelFeedPage,
  IReportReelDto,
  ISavedPostsPage,
  PostPublicationStatus,
  PostVisibility,
  ReelFeedKind,
} from "@/types/newsfeed.types";
import type { ReactionType, IReactionSummary } from "@/types/reaction.types";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface CreatePostBody {
  content: string;
  groupId?: string;
  communityId?: string;
  type: "text" | "image" | "video" | "link";
  visibility: PostVisibility;
  publicationStatus: PostPublicationStatus;
  categories?: string[];
  tags?: string[];
  mediaUrls?: string[];
}

export interface UpdatePostBody {
  content?: string;
  visibility?: PostVisibility;
  publicationStatus?: PostPublicationStatus;
  categories?: string[];
  tags?: string[];
  type?: "text" | "image" | "video" | "link";
  mediaUrls?: string[];
}

export interface FeedQueryParams {
  limit?: number;
  cursor?: string | null;
}

export interface SharePostBody {
  content?: string;
  visibility?: PostVisibility;
}

export interface CommentsQueryParams {
  postId: string;
  limit?: number;
  cursor?: string | null;
}

export interface ReelsFeedQueryParams {
  feed?: ReelFeedKind;
  limit?: number;
  cursor?: string | null;
}

export interface ReelCommentsQueryParams {
  reelId: string;
  limit?: number;
  cursor?: string | null;
}

export const newsfeedApi = createApi({
  reducerPath: "newsfeedApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Feed",
    "Posts",
    "PostDetail",
    "Comments",
    "ReelsFeed",
    "ReelDetail",
    "ReelComments",
    "ReelCommentReplies",
  ],
  endpoints: (builder) => ({
    getFeed: builder.query<IFeedPage, FeedQueryParams | void>({
      query: (params) => ({
        url: "/newsfeed/feed",
        params: {
          limit: params?.limit,
          cursor: params?.cursor ?? undefined,
        },
      }),
      transformResponse: (response: ApiEnvelope<IFeedPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: ["Feed"],
    }),

    getPostById: builder.query<IPost, string>({
      query: (postId) => `/newsfeed/posts/${postId}`,
      transformResponse: (response: ApiEnvelope<IPost>) => response.data,
      providesTags: (_res, _err, postId) => [{ type: "PostDetail", id: postId }],
    }),

    getPostsByAuthor: builder.query<IFeedPage, { authorId: string; limit?: number }>({
      query: ({ authorId, limit }) => ({
        url: `/newsfeed/posts/by-author/${encodeURIComponent(authorId)}`,
        params: { limit },
      }),
      transformResponse: (response: ApiEnvelope<IFeedPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: (_res, _err, arg) => [{ type: "Posts", id: `AUTHOR-${arg.authorId}` }],
    }),

    createPost: builder.mutation<IPost, CreatePostBody>({
      query: (body) => ({
        url: "/newsfeed/posts",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<IPost>) => response.data,
      invalidatesTags: ["Feed", "Posts"],
    }),

    updatePost: builder.mutation<null, { postId: string; data: UpdatePostBody }>({
      query: ({ postId, data }) => ({
        url: `/newsfeed/posts/${postId}`,
        method: "PUT",
        body: data,
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, arg) => [
        { type: "PostDetail", id: arg.postId },
        "Feed",
        "Posts",
      ],
    }),

    deletePost: builder.mutation<null, string>({
      query: (postId) => ({
        url: `/newsfeed/posts/${postId}`,
        method: "DELETE",
      }),
      transformResponse: () => null,
      async onQueryStarted(postId, { dispatch, queryFulfilled }) {
        const feedPatch = dispatch(
          newsfeedApi.util.updateQueryData("getFeed", undefined, (draft) => {
            if (draft?.items) {
              draft.items = draft.items.filter((p) => p.postId !== postId);
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          feedPatch.undo();
        }
      },
      invalidatesTags: (_res, _err, postId) => ["Feed", { type: "PostDetail", id: postId }],
    }),

    getComments: builder.query<ICommentsPage, CommentsQueryParams>({
      query: ({ postId, limit, cursor }) => ({
        url: `/newsfeed/posts/${postId}/comments`,
        params: {
          limit,
          cursor: cursor ?? undefined,
        },
      }),
      transformResponse: (response: ApiEnvelope<ICommentsPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: (_res, _err, arg) => [{ type: "Comments", id: arg.postId }],
    }),

    addComment: builder.mutation<
      IComment,
      { postId: string; content: string; parentId?: string; mediaUrls?: string[] }
    >({
      query: ({ postId, content, parentId, mediaUrls }) => ({
        url: `/newsfeed/posts/${postId}/comments`,
        method: "POST",
        body: { content, parentId, mediaUrls },
      }),
      transformResponse: (response: ApiEnvelope<IComment>) => response.data,
      async onQueryStarted({ postId, content, parentId }, { dispatch, queryFulfilled, getState }) {
        const currentUser = (
          getState() as {
            auth?: { user?: { userId?: string; displayName?: string; avatar?: string | null } };
          }
        )?.auth?.user;
        const tempId = `temp-${Date.now()}`;
        const tempComment: IComment = {
          commentId: tempId,
          postId,
          authorId: currentUser?.userId ?? "me",
          author: {
            userId: currentUser?.userId ?? "me",
            displayName: currentUser?.displayName ?? "Bạn",
            avatar: currentUser?.avatar ?? null,
          },
          content,
          parentId: parentId ?? null,
          reactionsCount: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Chỉ cập nhật cache root comments khi đây là comment gốc (không phải reply)
        const patch = !parentId
          ? dispatch(
              newsfeedApi.util.updateQueryData(
                "getComments",
                { postId, limit: 5, cursor: null },
                (draft) => {
                  draft.items.push(tempComment);
                },
              ),
            )
          : null;

        const feedPatch = dispatch(
          newsfeedApi.util.updateQueryData("getFeed", undefined, (draft) => {
            draft.items = draft.items.map((item) =>
              item.postId === postId
                ? { ...item, commentsCount: (item.commentsCount ?? 0) + 1 }
                : item,
            );
          }),
        );

        try {
          const { data } = await queryFulfilled;
          if (data && !parentId) {
            dispatch(
              newsfeedApi.util.updateQueryData(
                "getComments",
                { postId, limit: 5, cursor: null },
                (draft) => {
                  const index = draft.items.findIndex((item) => item.commentId === tempId);
                  if (index >= 0) {
                    draft.items[index] = data;
                  }
                },
              ),
            );
          }
        } catch {
          patch?.undo();
          feedPatch.undo();
        }
      },
    }),

    reactToPost: builder.mutation<IReactionSummary, { postId: string; type: ReactionType }>({
      query: ({ postId, type }) => ({
        url: `/newsfeed/posts/${postId}/react`,
        method: "POST",
        body: { type },
      }),
      transformResponse: (response: ApiEnvelope<IReactionSummary>) => response.data,
    }),

    reactToComment: builder.mutation<
      IReactionSummary,
      { postId: string; commentId: string; type: ReactionType }
    >({
      query: ({ postId, commentId, type }) => ({
        url: `/newsfeed/comments/${commentId}/react`,
        method: "POST",
        body: { type, postId },
      }),
      transformResponse: (response: ApiEnvelope<IReactionSummary>) => response.data,
      async onQueryStarted({ postId, commentId, type }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          newsfeedApi.util.updateQueryData(
            "getComments",
            { postId, limit: 5, cursor: null },
            (draft) => {
              const comment = draft.items.find((c) => c.commentId === commentId);
              if (comment) {
                const oldType = comment.currentUserReaction;
                if (oldType === type) {
                  comment.currentUserReaction = null;
                  if (comment.reactionsCount[type] && comment.reactionsCount[type]! > 0) {
                    comment.reactionsCount[type]! -= 1;
                  }
                } else {
                  if (
                    oldType &&
                    comment.reactionsCount[oldType] &&
                    comment.reactionsCount[oldType]! > 0
                  ) {
                    comment.reactionsCount[oldType]! -= 1;
                  }
                  comment.currentUserReaction = type;
                  comment.reactionsCount[type] = (comment.reactionsCount[type] ?? 0) + 1;
                }
              }
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    getCommentReplies: builder.query<
      ICommentsPage,
      { postId: string; commentId: string; cursor?: string | null }
    >({
      query: ({ postId, commentId, cursor }) => ({
        url: `/newsfeed/posts/${postId}/comments`,
        params: { parentId: commentId, limit: 5, cursor: cursor ?? undefined },
      }),
      transformResponse: (response: ApiEnvelope<ICommentsPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
    }),

    reactToReel: builder.mutation<IReactionSummary, { reelId: string; type: ReactionType }>({
      query: ({ reelId, type }) => ({
        url: `/newsfeed/reels/${reelId}/react`,
        method: "POST",
        body: { type },
      }),
      transformResponse: (response: ApiEnvelope<IReactionSummary>) => response.data,
      invalidatesTags: ["ReelsFeed", "ReelDetail"],
    }),

    sharePost: builder.mutation<IPost, { postId: string } & SharePostBody>({
      query: ({ postId, ...body }) => ({
        url: `/newsfeed/posts/${postId}/share`,
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<IPost>) => response.data,
      invalidatesTags: ["Feed"],
    }),

    toggleSavePost: builder.mutation<{ isSaved: boolean }, string>({
      query: (postId) => ({
        url: `/newsfeed/posts/${postId}/save`,
        method: "POST",
      }),
      transformResponse: (response: ApiEnvelope<{ isSaved: boolean }>) => response.data,
      async onQueryStarted(postId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          newsfeedApi.util.updateQueryData("getFeed", undefined, (draft) => {
            const post = draft.items.find((p) => p.postId === postId);
            if (post) post.isSaved = !post.isSaved;
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    getSavedPosts: builder.query<ISavedPostsPage, FeedQueryParams | void>({
      query: (params) => ({
        url: "/newsfeed/feed/saved",
        params: {
          limit: params?.limit,
          cursor: params?.cursor ?? undefined,
        },
      }),
      transformResponse: (response: ApiEnvelope<ISavedPostsPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: ["Feed"],
    }),

    // ─── Reels ──────────────────────────────────────────────────────────────

    getReelsFeed: builder.query<IReelFeedPage, ReelsFeedQueryParams | void>({
      query: (params) => ({
        url: "/newsfeed/reels",
        params: {
          feed: params?.feed ?? "foryou",
          limit: params?.limit ?? 10,
          cursor: params?.cursor ?? undefined,
        },
      }),
      transformResponse: (response: ApiEnvelope<IReelFeedPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: ["ReelsFeed"],
    }),

    getReelById: builder.query<IReel, string>({
      query: (reelId) => `/newsfeed/reels/${reelId}`,
      transformResponse: (response: ApiEnvelope<IReel>) => response.data,
      providesTags: (_res, _err, reelId) => [{ type: "ReelDetail", id: reelId }],
    }),

    getReelsByAuthor: builder.query<
      IReelFeedPage,
      { authorId: string; limit?: number; cursor?: string | null }
    >({
      query: ({ authorId, limit, cursor }) => ({
        url: `/newsfeed/reels/by-author/${authorId}`,
        params: { limit, cursor: cursor ?? undefined },
      }),
      transformResponse: (response: ApiEnvelope<IReelFeedPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
    }),

    createReel: builder.mutation<IReel, ICreateReelDto>({
      query: (body) => ({
        url: "/newsfeed/reels",
        method: "POST",
        body,
      }),
      transformResponse: (response: ApiEnvelope<IReel>) => response.data,
      invalidatesTags: ["ReelsFeed"],
    }),

    deleteReel: builder.mutation<null, string>({
      query: (reelId) => ({
        url: `/newsfeed/reels/${reelId}`,
        method: "DELETE",
      }),
      transformResponse: () => null,
      invalidatesTags: (_res, _err, reelId) => ["ReelsFeed", { type: "ReelDetail", id: reelId }],
    }),

    recordReelView: builder.mutation<
      null,
      { reelId: string; watchedMs: number; completed?: boolean }
    >({
      query: ({ reelId, ...body }) => ({
        url: `/newsfeed/reels/${reelId}/view`,
        method: "POST",
        body,
      }),
      transformResponse: () => null,
    }),

    toggleSaveReel: builder.mutation<{ isSaved: boolean }, string>({
      query: (reelId) => ({
        url: `/newsfeed/reels/${reelId}/save`,
        method: "POST",
      }),
      transformResponse: (response: ApiEnvelope<{ isSaved: boolean }>) => response.data,
      invalidatesTags: ["ReelsFeed", "ReelDetail"],
    }),

    reportReel: builder.mutation<null, { reelId: string } & IReportReelDto>({
      query: ({ reelId, ...body }) => ({
        url: `/newsfeed/reels/${reelId}/report`,
        method: "POST",
        body,
      }),
      transformResponse: () => null,
    }),

    getReelComments: builder.query<ICommentsPage, ReelCommentsQueryParams>({
      query: ({ reelId, limit, cursor }) => ({
        url: `/newsfeed/reels/${reelId}/comments`,
        params: { limit: limit ?? 20, cursor: cursor ?? undefined },
      }),
      transformResponse: (response: ApiEnvelope<ICommentsPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: (_res, _err, arg) => [{ type: "ReelComments", id: arg.reelId }],
    }),

    addReelComment: builder.mutation<
      IComment,
      { reelId: string; content: string; parentId?: string; mediaUrls?: string[] }
    >({
      query: ({ reelId, content, parentId, mediaUrls }) => ({
        url: `/newsfeed/reels/${reelId}/comments`,
        method: "POST",
        body: { content, parentId, mediaUrls },
      }),
      transformResponse: (response: ApiEnvelope<IComment>) => response.data,
      invalidatesTags: (_res, _err, arg) => [
        { type: "ReelComments", id: arg.reelId },
        ...(arg.parentId ? [{ type: "ReelCommentReplies" as const, id: arg.parentId }] : []),
      ],
    }),

    reactToReelComment: builder.mutation<
      IReactionSummary,
      { reelId: string; commentId: string; type: ReactionType }
    >({
      query: ({ reelId, commentId, type }) => ({
        url: `/newsfeed/reels/${reelId}/comments/${commentId}/react`,
        method: "POST",
        body: { type },
      }),
      transformResponse: (response: ApiEnvelope<IReactionSummary>) => response.data,
      async onQueryStarted({ reelId, commentId, type }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          newsfeedApi.util.updateQueryData("getReelComments", { reelId, limit: 20 }, (draft) => {
            const comment = draft.items.find((c) => c.commentId === commentId);
            if (comment) {
              const oldType = comment.currentUserReaction;
              if (oldType === type) {
                comment.currentUserReaction = null;
                if (comment.reactionsCount[type] && comment.reactionsCount[type]! > 0) {
                  comment.reactionsCount[type]! -= 1;
                }
              } else {
                if (
                  oldType &&
                  comment.reactionsCount[oldType] &&
                  comment.reactionsCount[oldType]! > 0
                ) {
                  comment.reactionsCount[oldType]! -= 1;
                }
                comment.currentUserReaction = type;
                comment.reactionsCount[type] = (comment.reactionsCount[type] ?? 0) + 1;
              }
            }
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    getReelCommentReplies: builder.query<
      ICommentsPage,
      { reelId: string; commentId: string; cursor?: string | null }
    >({
      query: ({ reelId, commentId, cursor }) => ({
        url: `/newsfeed/reels/${reelId}/comments`,
        params: { parentId: commentId, limit: 5, cursor: cursor ?? undefined },
      }),
      transformResponse: (response: ApiEnvelope<ICommentsPage>) => ({
        items: Array.isArray(response?.data?.items) ? response.data.items : [],
        nextCursor: response?.data?.nextCursor ?? null,
        hasMore: Boolean(response?.data?.hasMore),
      }),
      providesTags: (_res, _err, arg) => [{ type: "ReelCommentReplies", id: arg.commentId }],
    }),
  }),
});

export const {
  useGetFeedQuery,
  useLazyGetFeedQuery,
  useGetPostByIdQuery,
  useGetPostsByAuthorQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useGetCommentsQuery,
  useLazyGetCommentsQuery,
  useAddCommentMutation,
  useReactToPostMutation,
  useReactToCommentMutation,
  useReactToReelMutation,
  useGetCommentRepliesQuery,
  useLazyGetCommentRepliesQuery,
  useSharePostMutation,
  useToggleSavePostMutation,
  useGetSavedPostsQuery,
  // Reels
  useGetReelsFeedQuery,
  useLazyGetReelsFeedQuery,
  useGetReelByIdQuery,
  useGetReelsByAuthorQuery,
  useCreateReelMutation,
  useDeleteReelMutation,
  useRecordReelViewMutation,
  useToggleSaveReelMutation,
  useReportReelMutation,
  useGetReelCommentsQuery,
  useLazyGetReelCommentsQuery,
  useAddReelCommentMutation,
  useReactToReelCommentMutation,
  useLazyGetReelCommentRepliesQuery,
  useGetReelCommentRepliesQuery,
} = newsfeedApi;
