import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { AlertCircle, CheckCircle2, X, Users } from "lucide-react-native";
import { useIconColors } from "@/hooks/useIconColors";
import { type IConversation } from "@/types/chat.types";

export interface LinkChatModalProps {
  open: boolean;
  onClose: () => void;
  conversations: IConversation[];
  onConfirm: (conversationId: string) => void;
  loading?: boolean;
}

export function LinkChatModal({
  open,
  onClose,
  conversations,
  onConfirm,
  loading = false,
}: LinkChatModalProps) {
  const { primary, muted, border } = useIconColors();
  const [selectedId, setSelectedId] = useState<string>("");

  // Reset selection when opened/closed
  useEffect(() => {
    if (!open) {
      setSelectedId("");
    }
  }, [open]);

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Pressable onPress={onClose} className="flex-1 justify-center bg-black/60 px-6 py-10">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full rounded-3xl border border-border/40 bg-card p-6 shadow-2xl"
          >
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border/40 pb-3">
              <View className="flex-row items-center gap-2">
                <AlertCircle size={20} color={primary} />
                <Text className="text-[16px] font-bold text-foreground">
                  Liên kết cuộc trò chuyện
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                className="h-8 w-8 items-center justify-center rounded-full bg-muted/40 active:bg-muted/80"
              >
                <X size={16} color={muted} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              className="mt-4 max-h-[50vh]"
            >
              <Text className="mb-4 text-xs font-semibold leading-relaxed text-muted-foreground">
                Chọn một cuộc trò chuyện nhóm mà bạn làm trưởng nhóm để liên kết làm phòng chat
                chính thức của cộng đồng.
              </Text>

              {conversations.length > 0 ? (
                <View className="gap-2.5">
                  {conversations.map((conv) => {
                    const isSelected = selectedId === conv.conversationId;
                    return (
                      <Pressable
                        key={conv.conversationId}
                        onPress={() => setSelectedId(conv.conversationId)}
                        className={`flex-row items-center justify-between rounded-2xl border px-4 py-3.5 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background/50 active:bg-muted/10"
                        }`}
                      >
                        <View className="flex-1 gap-1">
                          <Text className="text-sm font-bold text-foreground" numberOfLines={1}>
                            {conv.name || "Trò chuyện nhóm không tên"}
                          </Text>
                          <View className="flex-row items-center gap-1.5">
                            <Users size={12} color="#71717a" />
                            <Text className="text-xs text-muted-foreground">
                              {conv.memberCount} thành viên
                            </Text>
                          </View>
                        </View>
                        {isSelected && <CheckCircle2 size={20} color={primary} className="ml-2" />}
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View className="items-center justify-center rounded-2xl border border-border/20 bg-muted/20 p-5">
                  <Text className="text-center text-sm font-semibold leading-relaxed text-muted-foreground">
                    Không tìm thấy cuộc trò chuyện nhóm hợp lệ. Bạn phải là trưởng nhóm của nhóm
                    chat và nhóm chat đó chưa được liên kết với cộng đồng nào khác.
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View className="mt-6 flex-row gap-3">
                <Pressable
                  onPress={onClose}
                  className="flex-1 items-center justify-center rounded-2xl border border-border/80 bg-background py-3.5 active:bg-muted/30"
                >
                  <Text className="text-sm font-bold text-muted-foreground">Hủy</Text>
                </Pressable>
                <Pressable
                  disabled={!selectedId || loading}
                  onPress={() => onConfirm(selectedId)}
                  className={`flex-1 items-center justify-center rounded-2xl py-3.5 shadow-md ${
                    selectedId && !loading
                      ? "bg-primary active:opacity-90"
                      : "bg-primary/40 opacity-60"
                  }`}
                >
                  <Text className="text-sm font-bold text-white">Liên kết ngay</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
