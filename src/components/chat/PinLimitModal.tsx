import type { ReactElement } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MessageSquare, X } from "lucide-react-native";

import type { IMessage } from "@/types/chat.types";
import { MAX_PINNED_PER_CONVERSATION } from "@/constants/chatPin";
import { PinnedRowPreview } from "@/components/chat/PinnedRowPreview";

const Z = {
  primary: "#0068FF",
  text: "#0a1629",
  sub: "#64748b",
  line: "rgba(0,0,0,0.06)",
  bg: "#FFFFFF",
};

export type PinLimitModalProps = {
  visible: boolean;
  currentPinned: IMessage[];
  pendingPin: IMessage | null;
  replaceIndex: number | null;
  onReplaceIndexChange: (index: number) => void;
  isSubmitting?: boolean;
  currentUserId: string;
  onClose: () => void;
  onConfirm: () => void;
};

/** Modal thay tin ghim khi đủ 5 — đồng bộ web `PinLimitModal`. */
export function PinLimitModal({
  visible,
  currentPinned,
  pendingPin,
  replaceIndex,
  onReplaceIndexChange,
  isSubmitting = false,
  currentUserId,
  onClose,
  onConfirm,
}: PinLimitModalProps): ReactElement {
  const n = currentPinned.length;
  const canConfirm = replaceIndex !== null && n > 0 && replaceIndex >= 0 && replaceIndex < n;

  return (
    <Modal
      visible={visible && Boolean(pendingPin) && n > 0}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <Pressable style={styles.backdrop} onPress={() => !isSubmitting && onClose()}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Cập nhật danh sách ghim</Text>
            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              hitSlop={8}
              style={styles.closeBtn}
            >
              <X size={22} color={Z.sub} strokeWidth={1.5} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.desc}>
              Đã đạt giới hạn {MAX_PINNED_PER_CONVERSATION} ghim. Vui lòng chọn ghim cần bỏ để cập
              nhật ghim mới.
            </Text>

            <View style={styles.list}>
              {currentPinned.map((msg, index) => {
                const checked = replaceIndex === index;
                return (
                  <Pressable
                    key={msg.messageId}
                    onPress={() => !isSubmitting && onReplaceIndexChange(index)}
                    style={[styles.row, checked && styles.rowChecked]}
                  >
                    <View style={styles.rowIcon}>
                      <MessageSquare size={18} color="#fff" strokeWidth={2} />
                    </View>
                    <View style={[styles.rowBody, { minWidth: 0, overflow: "hidden" }]}>
                      <Text style={styles.rowTitle}>Tin nhắn</Text>
                      <View style={{ minWidth: 0, overflow: "hidden", marginTop: 2 }}>
                        <PinnedRowPreview
                          msg={msg}
                          viewerUserId={currentUserId}
                          mutedColor={Z.sub}
                        />
                      </View>
                    </View>
                    <View
                      style={[styles.radio, checked && styles.radioChecked]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked }}
                    >
                      {checked ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              disabled={isSubmitting}
              style={[styles.btn, styles.btnCancel]}
            >
              <Text style={styles.btnCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => void onConfirm()}
              disabled={isSubmitting || !canConfirm}
              style={[
                styles.btn,
                styles.btnPrimary,
                (!canConfirm || isSubmitting) && styles.btnDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>Cập nhật</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    maxHeight: "88%",
    borderRadius: 12,
    backgroundColor: Z.bg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Z.line,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Z.line,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: Z.text,
    flex: 1,
  },
  closeBtn: { padding: 4 },
  body: { maxHeight: 360, paddingHorizontal: 20, paddingVertical: 16 },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    color: Z.sub,
    marginBottom: 16,
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  rowChecked: { backgroundColor: "rgba(0,104,255,0.08)" },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Z.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  rowBody: { flex: 1, minWidth: 0, paddingTop: 2 },
  rowTitle: { fontSize: 13, fontWeight: "700", color: Z.text, marginBottom: 2 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#94a3b8",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  radioChecked: { borderColor: Z.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Z.primary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 96,
    alignItems: "center",
  },
  btnCancel: { backgroundColor: "rgba(0,0,0,0.05)" },
  btnCancelText: { fontSize: 15, fontWeight: "700", color: Z.text },
  btnPrimary: { backgroundColor: Z.primary },
  btnPrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.5 },
});
