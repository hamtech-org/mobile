import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { env } from "@/config/env";
import type {
  IConversation,
  IMessage,
  ConversationType,
  MessageType,
  MemberRole,
} from "@/types/chat.types";

// ─── API envelope ────────────────────────────────────────────────────────────
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message: string;
}

// ─── Request types ───────────────────────────────────────────────────────────
export interface CreateConversationRequest {
  type: ConversationType;
  name?: string;
  memberIds: string[];
}

export interface SendMessageRequest {
  conversationId: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaId?: string;
  replyTo?: string;
}

export interface EditMessageRequest {
  messageId: string;
  content: string;
  conversationId: string;
  createdAt: string;
}

export interface DeleteMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface RecallMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface MarkAsReadRequest {
  conversationId: string;
  messageId: string;
}

export interface PinMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
}

export interface ReactMessageRequest {
  messageId: string;
  conversationId: string;
  createdAt: string;
  emoji: string;
}

export interface UpdateGroupRequest {
  groupId: string;
  name?: string;
  avatar?: string;
}

export interface AddMembersRequest {
  groupId: string;
  memberIds: string[];
}

export interface ChangeMemberRoleRequest {
  groupId: string;
  userId: string;
  role: MemberRole;
}

export interface CreatePollRequest {
  groupId: string;
  question: string;
  options: string[];
  isMultipleChoice?: boolean;
}

export interface CreateTaskRequest {
  groupId: string;
  title: string;
  description?: string;
  assignees: string[];
  dueDate?: string;
}

export interface UpdateTaskStatusRequest {
  groupId: string;
  taskId: string;
  status: "todo" | "in_progress" | "done";
}

// ─── API ─────────────────────────────────────────────────────────────────────
export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({
    baseUrl: env.apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const state = getState() as { auth?: { accessToken?: string | null } };
      const token = state.auth?.accessToken;
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ["Conversations", "Messages", "Polls", "Tasks", "GroupRequests"],
  endpoints: (builder) => ({
    // ─── Queries ──────────────────────────────────────────────────────────
    getConversations: builder.query<IConversation[], void>({
      query: () => "/chat/conversations",
      transformResponse: (response: ApiEnvelope<IConversation[]>) =>
        response.data,
      providesTags: ["Conversations"],
    }),

    getMessages: builder.query<
      IMessage[],
      { conversationId: string; limit?: number }
    >({
      query: ({ conversationId, limit = 40 }) =>
        `/chat/conversations/${conversationId}/messages?limit=${limit}`,
      transformResponse: (response: ApiEnvelope<IMessage[]>) => response.data,
      providesTags: (_result, _error, arg) => [
        { type: "Messages", id: arg.conversationId },
      ],
    }),

    getConversationMembers: builder.query<
      ApiEnvelope<unknown[]>,
      string
    >({
      query: (conversationId) =>
        `/chat/conversations/${conversationId}/members`,
      providesTags: (_result, _error, conversationId) => [
        { type: "Conversations", id: `MEMBERS-${conversationId}` },
      ],
    }),

    getPolls: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (groupId) => `/chat/groups/${groupId}/polls`,
      providesTags: (_result, _error, groupId) => [
        { type: "Polls", id: groupId },
      ],
    }),

    getTasks: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (groupId) => `/chat/groups/${groupId}/tasks`,
      providesTags: (_result, _error, groupId) => [
        { type: "Tasks", id: groupId },
      ],
    }),

    getGroupRequests: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (groupId) => `/chat/groups/${groupId}/requests`,
      providesTags: (_result, _error, groupId) => [
        { type: "GroupRequests", id: groupId },
      ],
    }),

    getLatestAIRecap: builder.query<ApiEnvelope<unknown>, string>({
      query: (groupId) => `/chat/groups/${groupId}/ai-recap/latest`,
    }),

    // ─── Mutations ────────────────────────────────────────────────────────
    createConversation: builder.mutation<
      ApiEnvelope<IConversation>,
      CreateConversationRequest
    >({
      query: (body) => ({
        url: "/chat/conversations",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    sendMessage: builder.mutation<ApiEnvelope<IMessage>, SendMessageRequest>({
      query: ({ conversationId, ...body }) => ({
        url: `/chat/conversations/${conversationId}/messages`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),

    editMessage: builder.mutation<ApiEnvelope<null>, EditMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
    }),

    deleteMessage: builder.mutation<ApiEnvelope<null>, DeleteMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
    }),

    recallMessage: builder.mutation<ApiEnvelope<null>, RecallMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/recall`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
        "Conversations",
      ],
    }),

    markAsRead: builder.mutation<ApiEnvelope<null>, MarkAsReadRequest>({
      query: ({ conversationId, messageId }) => ({
        url: `/chat/conversations/${conversationId}/read`,
        method: "POST",
        body: { messageId },
      }),
      invalidatesTags: ["Conversations"],
    }),

    pinMessage: builder.mutation<ApiEnvelope<null>, PinMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/pin`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),

    unpinMessage: builder.mutation<ApiEnvelope<null>, PinMessageRequest>({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/pin`,
        method: "DELETE",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),

    reactMessage: builder.mutation<
      ApiEnvelope<Record<string, string[]>>,
      ReactMessageRequest
    >({
      query: ({ messageId, ...body }) => ({
        url: `/chat/messages/${messageId}/react`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),

    // ─── Group Management ──────────────────────────────────────────────
    updateGroup: builder.mutation<ApiEnvelope<unknown>, UpdateGroupRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    deleteGroup: builder.mutation<ApiEnvelope<null>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversations"],
    }),

    leaveGroup: builder.mutation<ApiEnvelope<null>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}/leave`,
        method: "POST",
      }),
      invalidatesTags: ["Conversations"],
    }),

    addMembers: builder.mutation<ApiEnvelope<unknown>, AddMembersRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/members`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    removeMember: builder.mutation<
      ApiEnvelope<null>,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/chat/groups/${groupId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversations"],
    }),

    changeMemberRole: builder.mutation<
      ApiEnvelope<null>,
      ChangeMemberRoleRequest
    >({
      query: ({ groupId, userId, ...body }) => ({
        url: `/chat/groups/${groupId}/members/${userId}/role`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    // ─── Polls ──────────────────────────────────────────────────────────
    createPoll: builder.mutation<ApiEnvelope<unknown>, CreatePollRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/polls`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Polls", id: groupId },
      ],
    }),

    votePoll: builder.mutation<
      ApiEnvelope<unknown>,
      { groupId: string; pollId: string; optionIndex: number }
    >({
      query: ({ groupId, pollId, optionIndex }) => ({
        url: `/chat/groups/${groupId}/polls/${pollId}/vote`,
        method: "POST",
        body: { optionIndex },
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Polls", id: groupId },
      ],
    }),

    unvotePoll: builder.mutation<
      ApiEnvelope<unknown>,
      { groupId: string; pollId: string }
    >({
      query: ({ groupId, pollId }) => ({
        url: `/chat/groups/${groupId}/polls/${pollId}/unvote`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Polls", id: groupId },
      ],
    }),

    // ─── Tasks ──────────────────────────────────────────────────────────
    createTask: builder.mutation<ApiEnvelope<unknown>, CreateTaskRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/tasks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Tasks", id: groupId },
      ],
    }),

    updateTaskStatus: builder.mutation<
      ApiEnvelope<unknown>,
      UpdateTaskStatusRequest
    >({
      query: ({ groupId, taskId, ...body }) => ({
        url: `/chat/groups/${groupId}/tasks/${taskId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [
        { type: "Tasks", id: groupId },
      ],
    }),

    // ─── AI Recap ───────────────────────────────────────────────────────
    generateAIRecap: builder.mutation<ApiEnvelope<unknown>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}/ai-recap`,
        method: "POST",
      }),
    }),
  }),
});

export const {
  useGetConversationsQuery,
  useGetMessagesQuery,
  useGetConversationMembersQuery,
  useGetPollsQuery,
  useGetTasksQuery,
  useGetGroupRequestsQuery,
  useGetLatestAIRecapQuery,
  useCreateConversationMutation,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useRecallMessageMutation,
  useMarkAsReadMutation,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useReactMessageMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useAddMembersMutation,
  useRemoveMemberMutation,
  useChangeMemberRoleMutation,
  useCreatePollMutation,
  useVotePollMutation,
  useUnvotePollMutation,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
  useGenerateAIRecapMutation,
} = chatApi;
