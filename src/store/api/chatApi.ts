/**
 * chatApi — Central API for all chat-related features.
 * This file consolidates modular APIs for better maintainability.
 */

// 1. Export types and base API instance
export * from "./baseChatApi";

// 2. Import hooks from modular APIs to trigger endpoint injection and re-export them
export {
  useGetConversationsQuery,
  useGetConversationMembersQuery,
  useCreateConversationMutation,
} from "./endpoints/conversationApi";

export {
  useGetMessagesQuery,
  useSendMessageMutation,
  useEditMessageMutation,
  useDeleteMessageMutation,
  useRecallMessageMutation,
  useMarkAsReadMutation,
  usePinMessageMutation,
  useUnpinMessageMutation,
  useReactMessageMutation,
} from "./endpoints/messageApi";

export {
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useAddMembersMutation,
  useRemoveMemberMutation,
  useChangeMemberRoleMutation,
  useGetGroupRequestsQuery,
} from "./endpoints/groupApi";

export {
  useGetPollsQuery,
  useCreatePollMutation,
  useVotePollMutation,
  useUnvotePollMutation,
} from "./endpoints/pollApi";

export {
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskStatusMutation,
} from "./endpoints/taskApi";

export {
  useGetLatestAIRecapQuery,
  useGenerateAIRecapMutation,
} from "./endpoints/aiRecapApi";

// 3. Re-export specific request interfaces for convenience
export type { CreateConversationRequest } from "./endpoints/conversationApi";
export type {
  SendMessageRequest,
  EditMessageRequest,
  DeleteMessageRequest,
  RecallMessageRequest,
  MarkAsReadRequest,
  PinMessageRequest,
  ReactMessageRequest,
} from "./endpoints/messageApi";
export { CHAT_MESSAGES_QUERY_LIMIT } from "./endpoints/messageApi";
export type {
  UpdateGroupRequest,
  AddMembersRequest,
  ChangeMemberRoleRequest,
} from "./endpoints/groupApi";
export type { CreatePollRequest } from "./endpoints/pollApi";
export type {
  CreateTaskRequest,
  UpdateTaskStatusRequest,
} from "./endpoints/taskApi";
