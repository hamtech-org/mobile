import { useCallback, useEffect, useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart2, Plus, Trash2, X } from "lucide-react-native";

import { useCreatePollMutation } from "@/store/api/chatApi";
import { toast } from "@/utils/appToast";

const Z = {
  bg: "#FFFFFF",
  subBg: "#F3F4F6",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  primary: "#0068FF",
  red: "#DC2626",
  line: "#E5E7EB",
};

interface GroupPollModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  canCreatePollUi: boolean;
}

export function GroupPollModal({
  visible,
  onClose,
  groupId,
  canCreatePollUi,
}: GroupPollModalProps): ReactElement {
  const [createPollMut, { isLoading: submitting }] = useCreatePollMutation();

  const [question, setQuestion] = useState("");
  const [optionRows, setOptionRows] = useState<string[]>(["", ""]);
  const [multiple, setMultiple] = useState(false);

  const resetForm = useCallback(() => {
    setQuestion("");
    setOptionRows(["", ""]);
    setMultiple(false);
  }, []);

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, resetForm]);

  const canSubmit = question.trim().length > 0 && optionRows.filter((r) => r.trim()).length >= 2;

  const submit = async () => {
    if (!canSubmit || submitting || !canCreatePollUi) return;

    const q = question.trim();
    const opts = optionRows.map((s) => s.trim()).filter(Boolean);

    if (opts.length < 2) {
      toast.error("Cần ít nhất 2 lựa chọn hợp lệ");
      return;
    }

    try {
      await createPollMut({
        groupId,
        question: q,
        options: opts,
        isMultipleChoice: multiple,
      }).unwrap();
      toast.success("Bình chọn đã được tạo thành công");
      onClose();
    } catch {
      toast.error("Không tạo được bình chọn");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.iconBtn} hitSlop={12} disabled={submitting}>
            <X size={26} color={Z.text} strokeWidth={1.75} />
          </Pressable>
          <View
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 4 }}
          >
            <View style={styles.titleIcon}>
              <BarChart2 size={18} color="#0068FF" strokeWidth={2} />
            </View>
            <Text style={styles.topTitle} numberOfLines={1}>
              Tạo bình chọn mới
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <View style={styles.panelPad}>
            <Text style={styles.fieldLabel}>Câu hỏi</Text>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="Nhập câu hỏi bình chọn..."
              placeholderTextColor={Z.sub}
              style={styles.input}
              editable={!submitting && canCreatePollUi}
            />
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Các lựa chọn</Text>
            {optionRows.map((row, idx) => (
              <View
                key={`opt-${idx}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: idx === 0 ? 0 : 8,
                }}
              >
                <TextInput
                  value={row}
                  onChangeText={(t) => {
                    setOptionRows((prev) => {
                      const next = [...prev];
                      next[idx] = t;
                      return next;
                    });
                  }}
                  placeholder={`Lựa chọn ${idx + 1}`}
                  placeholderTextColor={Z.sub}
                  style={[styles.input, { flex: 1, marginTop: 0 }]}
                  editable={!submitting && canCreatePollUi}
                />
                {optionRows.length > 2 ? (
                  <Pressable
                    onPress={() => setOptionRows((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={submitting || !canCreatePollUi}
                    style={styles.trashBtn}
                    hitSlop={8}
                  >
                    <Trash2 size={20} color={Z.red} strokeWidth={2} />
                  </Pressable>
                ) : (
                  <View style={{ width: 36 }} />
                )}
              </View>
            ))}
            {optionRows.length < 12 ? (
              <Pressable
                style={styles.addOptionBtn}
                onPress={() => setOptionRows((prev) => [...prev, ""])}
                disabled={submitting || !canCreatePollUi}
              >
                <Plus size={20} color={Z.primary} strokeWidth={2} />
                <Text style={styles.addOptionText}>Thêm lựa chọn</Text>
              </Pressable>
            ) : null}

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Text style={styles.menuLabel}>Chọn nhiều đáp án</Text>
                <Text style={styles.helpSmall}>Thành viên có thể chọn nhiều hơn 1 tùy chọn</Text>
              </View>
              <Switch
                value={multiple}
                onValueChange={setMultiple}
                disabled={submitting || !canCreatePollUi}
                trackColor={{ false: "#D1D5DB", true: "#BFDBFE" }}
                thumbColor={multiple ? Z.primary : "#f4f4f5"}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!canCreatePollUi ? (
            <Text style={[styles.helpSmall, { flex: 1, textAlign: "center" }]}>
              Nhóm không cho phép thành viên tạo bình chọn
            </Text>
          ) : (
            <>
              <Pressable style={styles.btnGhost} onPress={onClose} disabled={submitting}>
                <Text style={styles.btnGhostText}>Đóng</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, (!canSubmit || submitting) && styles.btnPrimaryDisabled]}
                onPress={() => void submit()}
                disabled={!canSubmit || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Tạo bình chọn</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Z.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  iconBtn: { padding: 8 },
  titleIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { fontSize: 17, fontWeight: "700", color: Z.text, flexShrink: 1 },
  scroll: { flex: 1 },
  panelPad: { paddingHorizontal: 16, paddingTop: 16 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Z.sub,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Z.text,
    backgroundColor: Z.subBg,
  },
  trashBtn: {
    padding: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  addOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Z.primary,
    backgroundColor: "#F8FAFC",
  },
  addOptionText: { fontSize: 15, fontWeight: "600", color: Z.primary, marginLeft: 8 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
  },
  toggleLeft: { flex: 1, paddingRight: 16 },
  menuLabel: { fontSize: 15, fontWeight: "600", color: Z.text },
  helpSmall: { fontSize: 12, color: Z.sub, marginTop: 2 },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
    alignItems: "center",
  },
  btnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Z.subBg,
  },
  btnGhostText: { fontWeight: "700", color: Z.text, fontSize: 15 },
  btnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Z.primary,
  },
  btnPrimaryDisabled: { backgroundColor: "#93C5FD" },
  btnPrimaryText: { fontWeight: "700", color: "#fff", fontSize: 15 },
});
