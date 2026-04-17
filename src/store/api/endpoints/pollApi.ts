import { chatApi, type ApiEnvelope } from "../baseChatApi";

export interface CreatePollRequest {
  groupId: string;
  question: string;
  options: string[];
  isMultipleChoice?: boolean;
}

export const pollApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getPolls: builder.query<ApiEnvelope<unknown[]>, string>({
      query: (groupId) => `/chat/groups/${groupId}/polls`,
      providesTags: (_result, _error, groupId) => [
        { type: "Polls", id: groupId },
      ],
    }),

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
  }),
  overrideExisting: false,
});

export const {
  useGetPollsQuery,
  useCreatePollMutation,
  useVotePollMutation,
  useUnvotePollMutation,
} = pollApi;
