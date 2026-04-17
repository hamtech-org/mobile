import { chatApi, type ApiEnvelope } from "../baseChatApi";

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

export const taskApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getTasks: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (groupId) => `/chat/groups/${groupId}/tasks`,
      providesTags: (_result, _error, groupId) => [
        { type: "Tasks", id: groupId },
      ],
    }),

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
  }),
  overrideExisting: false,
});

export const {
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
} = taskApi;
