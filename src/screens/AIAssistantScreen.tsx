import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { AiAssistantMarkdown } from "@/components/chat/AiAssistantMarkdown";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useIconColors } from "@/hooks/useIconColors";
import { useSocket } from "@/hooks/useSocket";
import {
  useCreateConversationMutation,
  useGetAiAssistantThreadQuery,
  useGetConversationsQuery,
  type AiAssistantAction,
} from "@/store/api/chatApi";
import { toast } from "@/utils/appToast";

type AIAssistantTextMessage = {
  id: string;
  role: "assistant" | "user";
  kind: "text";
  content: string;
};

type ShowUserCardsAction = {
  type: "show_user_cards";
  payload: {
    source: "search_users" | "search_users_contacts";
    query: string;
    users: {
      userId: string;
      displayName: string;
      email?: string | null;
      phone?: string | null;
      avatar?: string | null;
      bio?: string | null;
      isFriend?: boolean;
      friendshipStatus?: string;
    }[];
  };
};

type ShowMessageResultsAction = {
  type: "show_message_results";
  payload: {
    source: "search_messages";
    query: string;
    messages: {
      resultKey?: string;
      messageId: string;
      conversationId: string;
      conversationName?: string | null;
      senderId: string;
      senderDisplayName?: string | null;
      content: string;
      createdAt: string;
    }[];
  };
};

type ShowGroupResultsAction = {
  type: "show_group_results";
  payload: {
    source: "search_groups";
    query: string;
    groups: {
      groupId: string;
      name: string;
      description: string | null;
      memberCount: number;
      type: string;
    }[];
  };
};

type ShowCommunityResultsAction = {
  type: "show_community_results";
  payload: {
    source: "search_communities";
    query: string;
    communities: {
      resultKey?: string;
      groupId: string;
      communityId: string;
      name: string;
      description: string | null;
      category?: string | null;
      memberCount: number;
      type: string;
      slug?: string | null;
      avatar?: string | null;
    }[];
  };
};

type ConfirmToolAction = {
  type: "confirm_tool";
  payload: {
    pendingId: string;
    toolName: string;
    question: string;
    confirmText: string;
    cancelText: string;
    confirmToken?: string;
    cancelToken?: string;
  };
};

type AIAssistantUserCardsMessage = {
  id: string;
  role: "assistant";
  kind: "user_cards";
  users: ShowUserCardsAction["payload"]["users"];
  query: string;
};

type AIAssistantMessageResultsMessage = {
  id: string;
  role: "assistant";
  kind: "message_results";
  messages: ShowMessageResultsAction["payload"]["messages"];
  query: string;
};

type AIAssistantGroupResultsMessage = {
  id: string;
  role: "assistant";
  kind: "group_results";
  groups: ShowGroupResultsAction["payload"]["groups"];
  query: string;
};

type AIAssistantCommunityResultsMessage = {
  id: string;
  role: "assistant";
  kind: "community_results";
  communities: ShowCommunityResultsAction["payload"]["communities"];
  query: string;
};

type AIAssistantChatItem =
  | AIAssistantTextMessage
  | AIAssistantUserCardsMessage
  | AIAssistantMessageResultsMessage
  | AIAssistantGroupResultsMessage
  | AIAssistantCommunityResultsMessage;

type AiMessageDonePayload = {
  threadId: string;
  requestId?: string;
  reply: string;
  actions: AiAssistantAction[];
  userMessageId?: string;
  assistantMessageId?: string;
};

type AiStatusPayload = {
  requestId?: string;
  label?: string;
  detail?: string;
};

const WELCOME: AIAssistantTextMessage = {
  id: "welcome",
  role: "assistant",
  kind: "text",
  content:
    "Chào bạn, mình là trợ lý HAMTECH. Bạn có thể hỏi hoặc nhờ mình tìm tin nhắn, bạn bè, nhóm hoặc gợi ý cộng đồng.",
};

function isStoredWelcomeEcho(content: string): boolean {
  const t = content.trim();
  return (
    t.includes("Chào bạn, mình là trợ lý HAMTECH") &&
    t.includes("tin nhắn, bạn bè") &&
    t.length < 220
  );
}

const COMMUNITY_CATEGORY_LABELS: Record<string, string> = {
  general: "Chung",
  technology: "Công nghệ",
  sports: "Thể thao",
  music: "Âm nhạc",
  education: "Giáo dục",
  gaming: "Game",
  lifestyle: "Đời sống",
};

function formatCommunityCategory(category: string | null | undefined): string | null {
  if (!category?.trim()) return null;
  const key = category.trim().toLowerCase();
  return COMMUNITY_CATEGORY_LABELS[key] ?? category;
}

function createAiRequestId(): string {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function unwrapAiReply(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") || !trimmed.includes('"reply"')) return content;
  try {
    const parsed = JSON.parse(trimmed) as { reply?: unknown };
    return typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : content;
  } catch {
    return content;
  }
}

function formatResultTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function isUserCardsAction(action: AiAssistantAction): action is ShowUserCardsAction {
  return action.type === "show_user_cards" && Array.isArray(action.payload?.users);
}

function isMessageResultsAction(action: AiAssistantAction): action is ShowMessageResultsAction {
  return action.type === "show_message_results" && Array.isArray(action.payload?.messages);
}

function isGroupResultsAction(action: AiAssistantAction): action is ShowGroupResultsAction {
  return action.type === "show_group_results" && Array.isArray(action.payload?.groups);
}

function isCommunityResultsAction(action: AiAssistantAction): action is ShowCommunityResultsAction {
  return action.type === "show_community_results" && Array.isArray(action.payload?.communities);
}

function isConfirmToolAction(action: AiAssistantAction): action is ConfirmToolAction {
  return action.type === "confirm_tool" && typeof action.payload?.question === "string";
}

function chatItemsFromAssistantActions(
  actions: AiAssistantAction[] | undefined,
  baseId: string,
): AIAssistantChatItem[] {
  if (!actions?.length) return [];
  const items: AIAssistantChatItem[] = [];

  for (const [index, action] of actions.entries()) {
    if (isUserCardsAction(action) && action.payload.users.length > 0) {
      items.push({
        id: `assistant-cards-${baseId}-${index}-${action.payload.source}`,
        role: "assistant",
        kind: "user_cards",
        query: action.payload.query,
        users: action.payload.users.slice(0, 8),
      });
    }

    if (isMessageResultsAction(action) && action.payload.messages.length > 0) {
      items.push({
        id: `assistant-messages-${baseId}-${index}`,
        role: "assistant",
        kind: "message_results",
        query: action.payload.query,
        messages: action.payload.messages.slice(0, 8),
      });
    }

    if (isGroupResultsAction(action) && action.payload.groups.length > 0) {
      items.push({
        id: `assistant-groups-${baseId}-${index}`,
        role: "assistant",
        kind: "group_results",
        query: action.payload.query,
        groups: action.payload.groups.slice(0, 8),
      });
    }

    if (isCommunityResultsAction(action) && action.payload.communities.length > 0) {
      items.push({
        id: `assistant-communities-${baseId}-${index}`,
        role: "assistant",
        kind: "community_results",
        query: action.payload.query,
        communities: action.payload.communities.slice(0, 8),
      });
    }
  }

  return items;
}

export function AIAssistantScreen() {
  const socket = useSocket();
  const insets = useSafeAreaInsets();
  const { foreground, muted, primary } = useIconColors();
  const listRef = useRef<FlatList<AIAssistantChatItem>>(null);
  const currentRequestId = useRef<string | null>(null);
  const lastSentUserText = useRef("");
  const cancelledRequestIds = useRef(new Set<string>());

  const { data: threadData, isFetching } = useGetAiAssistantThreadQuery(undefined);
  const { data: conversations = [] } = useGetConversationsQuery();
  const [createConversation] = useCreateConversationMutation();

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIAssistantChatItem[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingStatus, setSendingStatus] = useState("");
  const [lastActions, setLastActions] = useState<ConfirmToolAction[]>([]);

  const canSend = useMemo(() => draft.trim().length > 0 && !sending, [draft, sending]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  useEffect(() => {
    if (!threadData) return;
    setThreadId(threadData.threadId);
    if (threadData.messages.length === 0) {
      setMessages([WELCOME]);
      return;
    }

    const hydrated: AIAssistantChatItem[] = [];
    for (const message of threadData.messages) {
      const content =
        message.role === "assistant" ? unwrapAiReply(message.content) : message.content;
      if (message.role === "assistant" && isStoredWelcomeEcho(content)) continue;
      hydrated.push({
        id: message.messageId,
        role: message.role,
        kind: "text",
        content,
      });
      if (message.role === "assistant") {
        hydrated.push(...chatItemsFromAssistantActions(message.actions, message.messageId));
      }
    }
    setMessages(hydrated);
  }, [threadData]);

  useEffect(() => {
    if (!socket || !threadId) return;
    socket.emit("ai:thread_join", { threadId });
  }, [socket, threadId]);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, sending, sendingStatus, lastActions.length, scrollToEnd]);

  useEffect(() => {
    if (!socket) return;

    const onDone = (raw: unknown) => {
      const data = raw as AiMessageDonePayload;
      if (!data?.reply) return;
      if (data.requestId && cancelledRequestIds.current.has(data.requestId)) return;
      if (
        data.requestId &&
        currentRequestId.current &&
        data.requestId !== currentRequestId.current
      ) {
        return;
      }

      setThreadId(data.threadId);
      setSending(false);
      setSendingStatus("");
      currentRequestId.current = null;

      const userText = lastSentUserText.current;
      const confirmActions = (data.actions ?? []).filter(isConfirmToolAction);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => !m.id.startsWith("temp-user-"));
        const next: AIAssistantChatItem[] =
          data.userMessageId && userText
            ? [
                ...withoutTemp,
                { id: data.userMessageId, role: "user", kind: "text", content: userText },
              ]
            : withoutTemp;
        const assistantId = data.assistantMessageId ?? `assistant-${Date.now()}`;
        next.push({
          id: assistantId,
          role: "assistant",
          kind: "text",
          content: unwrapAiReply(data.reply),
        });
        next.push(...chatItemsFromAssistantActions(data.actions, assistantId));
        return next;
      });
      setLastActions(confirmActions);
    };

    const onError = (raw: unknown) => {
      setSending(false);
      setSendingStatus("");
      currentRequestId.current = null;
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-user-")));
      const message =
        raw && typeof raw === "object" && "error" in raw
          ? String((raw as { error?: string }).error ?? "")
          : "";
      toast.error(message || "Lỗi kết nối AI");
    };

    const onStatus = (raw: unknown) => {
      const data = raw as AiStatusPayload;
      if (
        data.requestId &&
        currentRequestId.current &&
        data.requestId !== currentRequestId.current
      ) {
        return;
      }
      const next = [data.label, data.detail].filter(Boolean).join(" - ");
      if (next) setSendingStatus(next);
    };

    const onCancelled = () => {
      setSending(false);
      setSendingStatus("");
      currentRequestId.current = null;
    };

    socket.on("ai:message_done", onDone);
    socket.on("ai:error", onError);
    socket.on("ai:status", onStatus);
    socket.on("ai:message_cancelled", onCancelled);

    return () => {
      socket.off("ai:message_done", onDone);
      socket.off("ai:error", onError);
      socket.off("ai:status", onStatus);
      socket.off("ai:message_cancelled", onCancelled);
    };
  }, [socket]);

  const sendMessage = useCallback(
    (messageText: string) => {
      const text = messageText.trim();
      if (!text || sending) return;
      if (!socket) {
        toast.error("Socket chưa kết nối");
        return;
      }

      const requestId = createAiRequestId();
      currentRequestId.current = requestId;
      cancelledRequestIds.current.delete(requestId);
      lastSentUserText.current = text;
      setSending(true);
      setSendingStatus("Đang gửi yêu cầu đến trợ lý HAMTECH...");
      setLastActions([]);
      setDraft("");
      setMessages((prev) => [
        ...prev,
        { id: `temp-user-${Date.now()}`, role: "user", kind: "text", content: text },
      ]);

      socket.emit("ai:message_send", {
        threadId: threadId ?? undefined,
        requestId,
        message: text,
        locale: "vi",
      });
    },
    [sending, socket, threadId],
  );

  const handleSend = useCallback(() => sendMessage(draft), [draft, sendMessage]);

  const handleCancel = useCallback(() => {
    const requestId = currentRequestId.current;
    if (!socket || !requestId) return;
    cancelledRequestIds.current.add(requestId);
    setSendingStatus("Đang dừng trợ lý HAMTECH...");
    socket.emit("ai:message_cancel", { threadId: threadId ?? undefined, requestId });
  }, [socket, threadId]);

  const handleQuickDecision = useCallback(
    (decision: "approve" | "reject", action: ConfirmToolAction) => {
      const token =
        decision === "approve" ? action.payload.confirmToken : action.payload.cancelToken;
      sendMessage(token?.trim() || (decision === "approve" ? "đồng ý" : "không"));
    },
    [sendMessage],
  );

  const openDirectChat = useCallback(
    async (userId: string) => {
      const existing = conversations.find((c) => c.type === "direct" && c.otherUserId === userId);
      if (existing) {
        router.push(`/(main)/(chat)/${existing.conversationId}`);
        return;
      }

      try {
        const created = await createConversation({ type: "direct", memberIds: [userId] }).unwrap();
        router.push(`/(main)/(chat)/${created.data.conversationId}`);
      } catch {
        toast.error("Không thể mở cuộc trò chuyện");
      }
    },
    [conversations, createConversation],
  );

  const openConversation = useCallback((conversationId: string) => {
    router.push(`/(main)/(chat)/${conversationId}`);
  }, []);

  const openCommunity = useCallback((groupId: string) => {
    router.push(`/(main)/(communities)/${groupId}`);
  }, []);

  const renderTextBubble = (message: AIAssistantTextMessage) => {
    const isUser = message.role === "user";
    return (
      <View
        className={`max-w-[86%] rounded-2xl px-4 py-3 ${isUser ? "self-end bg-primary" : "self-start bg-muted"}`}
      >
        {isUser ? (
          <Text className="text-sm leading-5 text-primary-foreground">{message.content}</Text>
        ) : (
          <AiAssistantMarkdown content={message.content} variant="assistant" />
        )}
      </View>
    );
  };

  const renderItem = ({ item }: { item: AIAssistantChatItem }) => {
    if (item.kind === "text") return renderTextBubble(item);

    if (item.kind === "user_cards") {
      return (
        <View className="max-w-[92%] self-start rounded-2xl border border-border/60 bg-muted/40 p-3">
          <Text className="mb-2 text-xs font-semibold text-foreground">Kết quả tìm người dùng</Text>
          {item.users.map((user, index) => (
            <Pressable
              key={`${user.userId}-${index}`}
              onPress={() => void openDirectChat(user.userId)}
              className="mb-2 rounded-xl border border-border/50 bg-background p-3 active:opacity-80"
            >
              <Text className="font-semibold text-foreground" numberOfLines={1}>
                {user.displayName}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
                {user.email || user.phone || user.bio || "Mở chat"}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }

    if (item.kind === "message_results") {
      return (
        <View className="max-w-[92%] self-start rounded-2xl border border-border/60 bg-muted/40 p-3">
          <Text className="mb-2 text-xs font-semibold text-foreground">Tin nhắn liên quan</Text>
          {item.messages.map((message, index) => (
            <Pressable
              key={`${message.resultKey ?? message.messageId}-${index}`}
              onPress={() => openConversation(message.conversationId)}
              className="mb-2 rounded-xl border border-border/50 bg-background p-3 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-foreground" numberOfLines={1}>
                {message.conversationName || "Cuộc trò chuyện"}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
                {message.senderDisplayName || "Người gửi"} · {formatResultTime(message.createdAt)}
              </Text>
              <Text className="mt-2 text-sm text-foreground" numberOfLines={2}>
                {message.content}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }

    if (item.kind === "group_results") {
      return (
        <View className="max-w-[92%] self-start rounded-2xl border border-border/60 bg-muted/40 p-3">
          <Text className="mb-2 text-xs font-semibold text-foreground">Nhóm liên quan</Text>
          {item.groups.map((group, index) => (
            <Pressable
              key={`${group.groupId}-${index}`}
              onPress={() => openConversation(group.groupId)}
              className="mb-2 rounded-xl border border-border/50 bg-background p-3 active:opacity-80"
            >
              <Text className="font-semibold text-foreground" numberOfLines={1}>
                {group.name}
              </Text>
              <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                {group.description || `${group.memberCount} thành viên`}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }

    if (item.kind === "community_results") {
      return (
        <View className="max-w-[92%] self-start rounded-2xl border border-border/60 bg-muted/40 p-3">
          <Text className="mb-2 text-xs font-semibold text-foreground">Gợi ý cộng đồng</Text>
          {item.communities.map((community, index) => {
            const categoryLabel = formatCommunityCategory(community.category);
            return (
              <Pressable
                key={`${community.groupId}-${index}`}
                onPress={() => openCommunity(community.groupId)}
                className="mb-2 rounded-xl border border-border/50 bg-background p-3 active:opacity-80"
              >
                <View className="flex-row items-start gap-3">
                  <View className="size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                    {community.avatar ? (
                      <Image
                        source={{ uri: community.avatar }}
                        accessibilityLabel={community.name}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="people-circle-outline" size={22} color={muted} />
                    )}
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>
                      {community.name}
                    </Text>
                    {categoryLabel ? (
                      <Text className="mt-0.5 text-[10px] font-semibold text-primary">
                        {categoryLabel}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={2}>
                      {community.description?.trim() ||
                        `${community.memberCount.toLocaleString("vi-VN")} thành viên`}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Trợ lý HAMTECH" onBack={() => router.back()} showAiButton={false} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View className="border-b border-border/40 px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Ionicons name="sparkles-outline" size={18} color={primary} />
            <Text className="font-semibold text-foreground">HAMTECH AI Assistant</Text>
          </View>
          <Text className="mt-1 text-xs leading-4 text-muted-foreground">
            Hỏi về tin nhắn, bạn bè, nhóm, cộng đồng hoặc bất cứ điều gì bạn muốn biết.
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, padding: 16, paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <>
              {isFetching && messages.length <= 1 ? (
                <View className="flex-row items-center gap-2 self-start rounded-full bg-muted px-3 py-2">
                  <ActivityIndicator size="small" color={primary} />
                  <Text className="text-xs text-muted-foreground">Đang tải lịch sử AI...</Text>
                </View>
              ) : null}
              {sending ? (
                <View className="flex-row items-center gap-2 self-start rounded-full bg-muted px-3 py-2">
                  <ActivityIndicator size="small" color={primary} />
                  <Text className="text-xs text-muted-foreground">
                    {sendingStatus || "AI đang trả lời..."}
                  </Text>
                </View>
              ) : null}
              {lastActions.map((action) => (
                <View
                  key={action.payload.pendingId}
                  className="max-w-[92%] self-start rounded-2xl border border-border/60 bg-muted/40 p-3"
                >
                  <Text className="text-sm text-foreground">{action.payload.question}</Text>
                  <View className="mt-3 flex-row gap-2">
                    <Pressable
                      onPress={() => handleQuickDecision("approve", action)}
                      className="rounded-full bg-primary px-4 py-2 active:opacity-80"
                    >
                      <Text className="text-sm font-semibold text-primary-foreground">
                        {action.payload.confirmText || "Đồng ý"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleQuickDecision("reject", action)}
                      className="rounded-full bg-muted px-4 py-2 active:opacity-80"
                    >
                      <Text className="text-sm font-semibold text-foreground">
                        {action.payload.cancelText || "Không"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          }
        />

        <View
          className="border-t border-border/50 bg-background px-3 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 10) }}
        >
          <View className="flex-row items-end gap-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Nhập nội dung cần trợ lý HAMTECH..."
              placeholderTextColor={muted}
              multiline
              maxLength={2000}
              editable={!sending}
              className="max-h-28 flex-1 py-1 text-base text-foreground"
              style={{ color: foreground, textAlignVertical: "center" }}
              onSubmitEditing={Platform.OS === "ios" ? undefined : handleSend}
            />
            {sending ? (
              <Pressable
                onPress={handleCancel}
                className="rounded-full bg-muted p-2 active:opacity-80"
                accessibilityLabel="Dừng AI"
              >
                <Ionicons name="square" size={20} color={foreground} />
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSend}
                disabled={!canSend}
                className={`rounded-full p-2 ${canSend ? "bg-primary" : "bg-muted"}`}
                accessibilityLabel="Gửi"
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={canSend ? "hsl(var(--primary-foreground) / 1)" : muted}
                />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
