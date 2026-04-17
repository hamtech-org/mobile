import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useIconColors } from "@/hooks/useIconColors";

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  sending?: boolean;
}

/**
 * ChatInput — thanh nhập tin nhắn:
 * - Nút attachment icon bên trái
 * - TextInput multiline, tự grow đến 5 dòng
 * - Nút send chỉ hiện khi có nội dung (icon paper-plane)
 * - Nút emoji bên phải khi chưa có text
 */
export const ChatInput = ({ onSend, sending = false }: ChatInputProps) => {
  const [content, setContent] = useState("");
  const { muted } = useIconColors();
  const hasText = content.trim().length > 0;

  const handleSend = async () => {
    const text = content.trim();
    if (!text || sending) return;
    await onSend(text);
    setContent("");
  };

  return (
    <View className="px-3 py-2 border-t border-border/40 bg-background flex-row items-end gap-2">
      {/* Nút attachment */}
      <Pressable className="p-2 rounded-full active:bg-muted mb-0.5" hitSlop={6} accessibilityLabel="Đính kèm file">
        <Ionicons name="attach-outline" size={22} color={muted} />
      </Pressable>

      {/* Text input */}
      <View className="flex-1 border border-border rounded-2xl px-3 py-2 bg-muted/30 flex-row items-end">
        <TextInput
          className="flex-1 text-sm text-foreground max-h-28"
          placeholder="Nhập tin nhắn..."
          placeholderTextColor="hsl(215 16% 47%)"
          value={content}
          onChangeText={setContent}
          multiline
          returnKeyType="default"
          blurOnSubmit={false}
        />
      </View>

      {/* Nút emoji (ẩn khi có text) hoặc Send */}
      {hasText ? (
        <Pressable
          onPress={handleSend}
          disabled={sending}
          className={`size-10 rounded-full bg-primary items-center justify-center mb-0.5 ${sending ? "opacity-60" : "active:opacity-80"}`}
          accessibilityLabel="Gửi tin nhắn"
        >
          <Ionicons name="send" size={18} color="white" />
        </Pressable>
      ) : (
        <Pressable className="p-2 rounded-full active:bg-muted mb-0.5" hitSlop={6} accessibilityLabel="Chọn emoji">
          <Ionicons name="happy-outline" size={22} color={muted} />
        </Pressable>
      )}
    </View>
  );
};
