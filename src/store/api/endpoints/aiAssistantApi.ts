import { chatApi, type ApiEnvelope } from "../baseChatApi";

export type AiAssistantAction = {
  type: string;
  payload?: Record<string, unknown>;
};

export type AiAssistantThreadMessage = {
  messageId: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actions?: AiAssistantAction[];
};

export type AiAssistantThread = {
  threadId: string;
  messages: AiAssistantThreadMessage[];
};

export const aiAssistantApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getAiAssistantThread: builder.query<AiAssistantThread, string | undefined>({
      query: (threadId) => ({
        url: "/ai/assistant/thread",
        params: threadId ? { threadId } : undefined,
      }),
      transformResponse: (response: ApiEnvelope<AiAssistantThread>) => response.data,
    }),
  }),
  overrideExisting: false,
});

export const { useGetAiAssistantThreadQuery } = aiAssistantApi;
