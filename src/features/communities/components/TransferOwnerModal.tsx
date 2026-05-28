import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertTriangle, X } from "lucide-react-native";
import { useIconColors } from "@/hooks/useIconColors";

export interface TransferOwnerModalProps {
  open: boolean;
  onClose: () => void;
  communityName: string;
  targetDisplayName: string;
  onConfirm: () => void;
  loading?: boolean;
}

export function TransferOwnerModal({
  open,
  onClose,
  communityName,
  targetDisplayName,
  onConfirm,
  loading = false,
}: TransferOwnerModalProps) {
  const { destructive, muted, primary } = useIconColors();
  const [inputName, setInputName] = useState("");

  // Reset input when opened/closed
  useEffect(() => {
    if (!open) {
      setInputName("");
    }
  }, [open]);

  const isConfirmed = inputName.trim() === communityName.trim();

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <Pressable onPress={onClose} className="flex-1 justify-center bg-black/60 px-6 py-10">
          <Pressable className="w-full rounded-3xl border border-border/40 bg-card p-6 shadow-2xl">
            {/* Header */}
            <View className="flex-row items-center justify-between border-b border-border/40 pb-3">
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={20} color={destructive} />
                <Text className="text-[16px] font-bold text-foreground">Cảnh báo bảo mật</Text>
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
              className="mt-4 max-h-[60vh]"
            >
              {/* Warning Box */}
              <View className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                <Text className="text-center text-sm font-semibold leading-relaxed text-destructive">
                  Bạn sắp chuyển giao quyền Chủ sở hữu cộng đồng{" "}
                  <Text className="font-extrabold text-foreground">{communityName}</Text> cho{" "}
                  <Text className="font-extrabold text-foreground">{targetDisplayName}</Text>.
                </Text>
                <Text className="mt-3 text-center text-xs font-bold leading-relaxed text-destructive">
                  Hành động này KHÔNG THỂ HOÀN TÁC. Bạn sẽ bị hạ cấp xuống thành viên thường và mất
                  toàn bộ quyền quản trị tối cao của nhóm.
                </Text>
              </View>

              {/* Input Area */}
              <View className="mt-5 gap-2">
                <Text className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nhập chính xác tên cộng đồng để xác nhận:
                </Text>
                <TextInput
                  value={inputName}
                  onChangeText={setInputName}
                  placeholder={communityName}
                  placeholderTextColor={muted}
                  autoCapitalize="none"
                  className="rounded-2xl border border-border bg-background px-4 py-3.5 text-sm font-semibold text-foreground"
                />
              </View>

              {/* Action Buttons */}
              <View className="mt-6 flex-row gap-3">
                <Pressable
                  onPress={onClose}
                  className="flex-1 items-center justify-center rounded-2xl border border-border/80 bg-background py-3.5 active:bg-muted/30"
                >
                  <Text className="text-sm font-bold text-muted-foreground">Hủy</Text>
                </Pressable>
                <Pressable
                  disabled={!isConfirmed || loading}
                  onPress={onConfirm}
                  className={`flex-1 items-center justify-center rounded-2xl py-3.5 shadow-md shadow-destructive/10 ${
                    isConfirmed && !loading
                      ? "bg-destructive active:opacity-90"
                      : "bg-destructive/40 opacity-60"
                  }`}
                >
                  <Text className="text-sm font-bold text-white">Xác nhận chuyển</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
