import { chatApi, type ApiEnvelope } from "../baseChatApi";

export const aiRecapApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getLatestAIRecap: builder.query<ApiEnvelope<unknown>, string>({
      query: (groupId) => `/chat/groups/${groupId}/ai-recap/latest`,
    }),

    generateAIRecap: builder.mutation<ApiEnvelope<unknown>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}/ai-recap`,
        method: "POST",
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useGetLatestAIRecapQuery, useGenerateAIRecapMutation } =
  aiRecapApi;
