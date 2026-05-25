import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface CreateTaskSubtaskInput {
  assigneeId: string;
  content: string;
}

export interface CreateTaskRequest {
  groupId: string;
  title: string;
  description?: string;
  assignees: string[];
  /** Khi true, máy chủ gán toàn bộ thành viên hiện tại (giống web). */
  assignToAll?: boolean;
  dueDate?: string;
  subtasks?: CreateTaskSubtaskInput[];
}

export interface UpdateTaskRequest extends Partial<Omit<CreateTaskRequest, "groupId">> {
  groupId: string;
  taskId: string;
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
      providesTags: (_result, _error, groupId) => [{ type: "Tasks", id: groupId }],
    }),

    createTask: builder.mutation<ApiEnvelope<unknown>, CreateTaskRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/tasks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [{ type: "Tasks", id: groupId }],
    }),

    updateTaskStatus: builder.mutation<ApiEnvelope<unknown>, UpdateTaskStatusRequest>({
      query: ({ groupId, taskId, ...body }) => ({
        url: `/chat/groups/${groupId}/tasks/${taskId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [{ type: "Tasks", id: groupId }],
    }),

    updateTask: builder.mutation<ApiEnvelope<unknown>, UpdateTaskRequest>({
      query: ({ groupId, taskId, ...body }) => ({
        url: `/chat/groups/${groupId}/tasks/${taskId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_result, _error, { groupId }) => [{ type: "Tasks", id: groupId }],
      async onQueryStarted(
        { groupId, taskId, title, description, assignees, assignToAll, dueDate, subtasks },
        { dispatch, queryFulfilled },
      ) {
        const patchResult = dispatch(
          (chatApi.util as any).updateQueryData(
            "getTasks",
            groupId,
            (draft: ApiEnvelope<unknown[]>) => {
              if (!draft?.data || !Array.isArray(draft.data)) return;
              const idx = draft.data.findIndex(
                (row) => String((row as { taskId?: string })?.taskId ?? "") === String(taskId),
              );
              if (idx < 0) return;
              const row = draft.data[idx] as Record<string, unknown>;
              if (title !== undefined) row.title = title;
              if (description !== undefined) row.description = description;
              if (assignees !== undefined) row.assignees = assignees;
              if (assignToAll !== undefined) {
                row.assignToAll = assignToAll;
                row.broadcast = assignToAll;
              }
              if (dueDate !== undefined) row.dueDate = dueDate;
              if (subtasks !== undefined) row.subtasks = subtasks;
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    deleteTask: builder.mutation<ApiEnvelope<unknown>, { groupId: string; taskId: string }>({
      query: ({ groupId, taskId }) => ({
        url: `/chat/groups/${groupId}/tasks/${taskId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { groupId }) => [{ type: "Tasks", id: groupId }],
    }),

    joinTask: builder.mutation<ApiEnvelope<unknown>, { groupId: string; taskId: string }>({
      query: ({ groupId, taskId }) => ({
        url: `/chat/groups/${groupId}/tasks/${taskId}/join`,
        method: "POST",
      }),
      invalidatesTags: (_result, _error, { groupId }) => [{ type: "Tasks", id: groupId }],
    }),

    triggerTaskDueReminder: builder.mutation<
      ApiEnvelope<{ sent: boolean }>,
      { groupId: string; taskId: string }
    >({
      query: ({ groupId, taskId }) => ({
        url: `/chat/groups/${groupId}/tasks/${taskId}/remind-due`,
        method: "POST",
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
  useJoinTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useTriggerTaskDueReminderMutation,
} = taskApi;
