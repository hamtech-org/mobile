import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Send } from "lucide-react-native";

import { useSocketContext } from "@/contexts/SocketContext";
import { useIconColors } from "@/hooks/useIconColors";

export type LiveChatLine = {
  sessionId: string;
  userId: string;
  displayName: string;
  text: string;
  sentAt: string;
};

interface LiveChatPanelProps {
  sessionId: string;
  messages: LiveChatLine[];
  /** Dark overlay on live video */
  variant?: "dark" | "light";
}

export function LiveChatPanel({ sessionId, messages, variant = "dark" }: LiveChatPanelProps) {
  const socket = useSocketContext();
  const { muted } = useIconColors();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<LiveChatLine>>(null);

  const isDark = variant === "dark";
  const textClass = isDark ? "text-white/90" : "text-foreground";
  const metaClass = isDark ? "text-white/55" : "text-muted-foreground";
  const inputBg = isDark ? "bg-white/12" : "bg-muted";
  const borderClass = isDark ? "border-white/15" : "border-border";

  const onSend = useCallback(() => {
    const t = draft.trim();
    if (!t || !socket) return;
    socket.emit("live:chat-message", { sessionId, text: t });
    setDraft("");
  }, [draft, sessionId, socket]);

  return (
    <View className="flex-1">
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item, i) => `${item.sentAt}-${item.userId}-${i}`}
        contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => (
          <View className="px-1">
            <Text className={`text-xs font-semibold ${metaClass}`}>{item.displayName}</Text>
            <Text className={`text-sm ${textClass}`}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text className={`py-6 text-center text-sm ${metaClass}`}>Chưa có tin nhắn</Text>
        }
      />
      <View className={`mt-2 flex-row items-center gap-2 border-t pt-2 ${borderClass}`}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Nhắn tin..."
          placeholderTextColor={isDark ? "rgba(255,255,255,0.45)" : muted}
          className={`flex-1 rounded-xl px-3 py-2 text-sm ${inputBg} ${textClass}`}
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
        <Pressable
          onPress={onSend}
          disabled={!draft.trim()}
          className="size-10 items-center justify-center rounded-full bg-primary/90 active:opacity-80"
        >
          <Send size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
