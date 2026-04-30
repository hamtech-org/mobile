import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "@/store/api/baseQueryWithReauth";
import type {
  IComment,
  ICommentsPage,
  IFeedPage,
  IPost,
  PostPublicationStatus,
  PostVisibility,
} from "@/types/newsfeed.types";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface CreatePostBody {
  content: string;
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

export interface CommentsQueryParams {
  postId: string;
  limit?: number;
  cursor?: string | null;
}

export const newsfeedApi = createApi({
  reducerPath: "newsfeedApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Feed", "Posts", "PostDetail", "Comments"],
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

    addComment: builder.mutation<IComment, { postId: string; content: string; parentId?: string }>({
      query: ({ postId, content, parentId }) => ({
        url: `/newsfeed/posts/${postId}/comments`,
        method: "POST",
        body: { content, parentId },
      }),
      transformResponse: (response: ApiEnvelope<IComment>) => response.data,
      async onQueryStarted({ postId, content }, { dispatch, queryFulfilled, getState }) {
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
          parentId: null,
          reactionsCount: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const patch = dispatch(
          newsfeedApi.util.updateQueryData(
            "getComments",
            { postId, limit: 5, cursor: null },
            (draft) => {
              draft.items.push(tempComment);
            },
          ),
        );

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
          if (data) {
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
          patch.undo();
          feedPatch.undo();
        }
      },
    }),

    reactToPost: builder.mutation<null, { postId: string; type: string }>({
      query: ({ postId, type }) => ({
        url: `/newsfeed/posts/${postId}/react`,
        method: "POST",
        body: { type },
      }),
      transformResponse: () => null,
      invalidatesTags: ["Posts"],
    }),
  }),
});

export const {
  useGetFeedQuery,
  useLazyGetFeedQuery,
  useGetPostByIdQuery,
  useCreatePostMutation,
  useUpdatePostMutation,
  useDeletePostMutation,
  useGetCommentsQuery,
  useLazyGetCommentsQuery,
  useAddCommentMutation,
  useReactToPostMutation,
} = newsfeedApi;
