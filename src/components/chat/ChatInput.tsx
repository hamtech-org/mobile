import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useIconColors } from "@/hooks/useIconColors";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  sending?: boolean;
}

/**
 * ChatInput — Messenger/Zalo style:
 * - Pill input (rounded-full) với bg muted
 * - add-circle icon xanh primary bên trái
 * - thumbs-up khi chưa gõ (giống Messenger)
 * - Send button tròn primary khi có text
 */
export const ChatInput = ({ onSend, sending = false }: ChatInputProps) => {
  const [content, setContent] = useState("");
  const { muted, primary } = useIconColors();
  const hasText = content.trim().length > 0;

  const handleSend = async () => {
    const text = content.trim();
    if (!text || sending) return;
    await onSend(text);
    setContent("");
  };

  return (
    <View className="flex-row items-end gap-2 px-3 py-2 border-t border-border/30 bg-background">
      {/* Add / attachment icon — primary color */}
      <Pressable className="size-9 items-center justify-center mb-0.5" hitSlop={8} accessibilityLabel="Đính kèm">
        <Ionicons name="add-circle-outline" size={26} color={primary} />
      </Pressable>

      {/* Pill input */}
      <View className="flex-1 flex-row items-end bg-muted rounded-full px-4 py-2 gap-1 min-h-[40px]">
        <TextInput
          className="flex-1 text-[15px] text-foreground max-h-28"
          placeholder="Aa"
          placeholderTextColor={muted}
          value={content}
          onChangeText={setContent}
          multiline
          returnKeyType="default"
          blurOnSubmit={false}
          style={{ lineHeight: 20 }}
        />
        {!hasText ? (
          <Pressable hitSlop={8} className="mb-0.5">
            <Ionicons name="happy-outline" size={22} color={muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Send tròn xanh khi có text, thumbs-up khi rỗng */}
      {hasText ? (
        <Pressable
          onPress={handleSend}
          disabled={sending}
          className={`size-9 rounded-full bg-primary items-center justify-center mb-0.5 ${sending ? "opacity-50" : "active:opacity-80"}`}
          accessibilityLabel="Gửi tin nhắn"
        >
          <Ionicons name="send" size={16} color="white" style={{ marginLeft: 2 }} />
        </Pressable>
      ) : (
        <Pressable className="size-9 items-center justify-center mb-0.5" hitSlop={8}>
          <Ionicons name="thumbs-up" size={24} color={primary} />
        </Pressable>
      )}
    </View>
  );
};
