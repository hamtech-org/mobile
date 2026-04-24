import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { Search, X } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";

type ChatInConversationSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  messages: IMessage[];
  currentUserId?: string;
  onSelectMessage: (messageId: string) => void;
};

function isMemberSentMessage(m: IMessage): boolean {
  return m.type !== "system";
}

function messageMatchesQuery(m: IMessage, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.toLowerCase();
  if (m.content?.toLowerCase().includes(n)) return true;
  if (m.senderDisplayName?.toLowerCase().includes(n)) return true;
  if (m.type.toLowerCase().includes(n)) return true;
  return false;
}

/**
 * Tìm trong hội thoại hiện tại — bố cục giống modal bình chọn (card giữa màn, nền mờ).
 */
export function ChatInConversationSearchModal({
  visible,
  onClose,
  messages,
  currentUserId,
  onSelectMessage,
}: ChatInConversationSearchModalProps) {
  const { muted, primary } = useIconColors();
  const [query, setQuery] = useState("");

  const hits = useMemo(() => {
    const pool = messages.filter((m) => isMemberSentMessage(m) && !m.isRecalled && !m.isDeleted);
    const q = query.trim();
    if (!q) return pool.slice(0, 80);
    return pool.filter((m) => messageMatchesQuery(m, q)).slice(0, 120);
  }, [messages, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-black/50 px-3" onPress={onClose}>
        <Pressable
          className="max-h-[88%] overflow-hidden rounded-2xl border border-border bg-card shadow-lg"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-border/60 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                <Search size={18} color={primary} strokeWidth={2} />
              </View>
              <Text className="text-[17px] font-bold text-foreground">Tìm trong hội thoại</Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-muted"
              hitSlop={8}
            >
              <X size={20} color={muted} strokeWidth={2} />
            </Pressable>
          </View>

          <View className="border-b border-border/40 px-3 py-2">
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm theo nội dung hoặc tên…"
              placeholderTextColor={muted}
              className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-[15px] text-foreground"
              autoFocus
              returnKeyType="search"
            />
          </View>

          <FlatList
            data={hits}
            keyExtractor={(m) => m.messageId}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 4 }}
            ListEmptyComponent={
              <Text className="py-8 text-center text-[14px] text-muted-foreground">
                {query.trim() ? "Không có kết quả." : "Gõ để tìm tin nhắn."}
              </Text>
            }
            renderItem={({ item: m }) => (
              <Pressable
                onPress={() => {
                  onSelectMessage(m.messageId);
                  onClose();
                  setQuery("");
                }}
                className="mb-1 rounded-xl border border-transparent px-3 py-2.5 active:border-primary/30 active:bg-primary/5"
              >
                <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
                  {m.senderDisplayName ?? "Ai đó"}
                </Text>
                <Text className="mt-0.5 text-[14px] text-muted-foreground" numberOfLines={2}>
                  {m.isRecalled ? "Đã thu hồi" : formatChatPreviewLine(m, currentUserId ?? "")}
                </Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
