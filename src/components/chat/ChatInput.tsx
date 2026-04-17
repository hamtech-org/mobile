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
 * - add-circle icon xanh primary bên trái, căn giữa dọc với pill
 * - thumbs-up filled (Facebook style) khi chưa gõ
 * - Send button tròn primary khi có text
 *
 * Alignment: các button size-10 (40px) = pill min-height → items-end căn đáy đúng
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
    <View className="flex-row items-center px-2 py-2 border-t border-border/20 bg-background">
      {/* Nút Add - h-11 (44px) chuẩn */}
      <View className="h-11 w-11 items-center justify-center">
        <Pressable className="active:opacity-70" hitSlop={10}>
          <Ionicons name="add-circle" size={28} color={primary} />
        </Pressable>
      </View>

      {/* Pill Input - h-11 (44px) đồng bộ */}
      <View 
        className="flex-1 bg-muted rounded-full px-4 flex-row items-center h-11"
      >
        <TextInput
          className="flex-1 text-[16px] text-foreground p-0 m-0"
          placeholder="Aa"
          placeholderTextColor={muted}
          value={content}
          onChangeText={setContent}
          multiline
          includeFontPadding={false}
          style={{ 
            height: 44,
            textAlignVertical: 'center',
          }}
        />
        {!hasText && (
          <Pressable hitSlop={10}>
            <Ionicons name="happy-outline" size={24} color={muted} />
          </Pressable>
        )}
      </View>

      {/* Nút Send hoặc Like - h-11 (44px) */}
      <View className="h-11 w-11 items-center justify-center">
        {hasText ? (
          <Pressable
            onPress={handleSend}
            disabled={sending}
            className={`size-9 rounded-full bg-primary items-center justify-center ${sending ? "opacity-50" : "active:opacity-80"}`}
          >
            <Ionicons name="send" size={16} color="white" style={{ marginLeft: 2 }} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => onSend("👍")}
            className="active:opacity-70"
            hitSlop={10}
          >
            <Ionicons name="thumbs-up" size={28} color={primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
};
