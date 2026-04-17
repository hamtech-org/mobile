import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { PlusCircle, SendHorizontal, Smile, ThumbsUp } from "lucide-react-native";

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
    <View className="flex-row items-end px-2 pt-4 min-h-[56px] border-t border-border/20 bg-background gap-1">
      {/* Nút Add */}
      <View className="h-11 w-11 items-center justify-center">
        <Pressable className="active:opacity-70" hitSlop={10}>
          <PlusCircle size={28} color={primary} strokeWidth={1.5} />
        </Pressable>
      </View>

      {/* Pill Input*/}
      <View className="flex-1 bg-muted rounded-[22px] px-4 flex-row items-center" style={{ minHeight: 44, paddingVertical: 4 }}>
        <TextInput
          className="flex-1 text-[16px] text-foreground p-0 m-0"
          placeholder="Aa"
          placeholderTextColor={muted}
          value={content}
          onChangeText={setContent}
          multiline
          style={{
            minHeight: 36,
            maxHeight: 120,
            textAlignVertical: "center",
            paddingTop: 4,
            paddingBottom: 4,
          }}
        />
        {!hasText && (
          <Pressable hitSlop={10}>
            <Smile size={24} color={muted} strokeWidth={1.5} />
          </Pressable>
        )}
      </View>

      {/* Nút Send hoặc Like */}
      <View className="h-11 w-11 items-center justify-center">
        {hasText ? (
          <Pressable
            onPress={handleSend}
            disabled={sending}
            className={`size-9 rounded-full bg-primary items-center justify-center ${sending ? "opacity-50" : "active:opacity-80"}`}
          >
            <SendHorizontal size={18} color="white" strokeWidth={2.0} />
          </Pressable>
        ) : (
          <Pressable onPress={() => onSend("👍")} className="active:opacity-70" hitSlop={10}>
            <ThumbsUp size={26} color={primary} strokeWidth={1.5} />
          </Pressable>
        )}
      </View>
    </View>
  );
};
