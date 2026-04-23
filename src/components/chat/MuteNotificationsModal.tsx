import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { MuteNotificationsApplyPayload } from "@/utils/muteNotifications";
import { toast } from "@/utils/appToast";

type MuteOptionId = "1m" | "5m" | "10m" | "forever";

type MuteNotificationsModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (payload: MuteNotificationsApplyPayload) => Promise<void>;
  isSubmitting?: boolean;
  mode?: "create" | "edit";
  scheduledUntilIso?: string | null;
};

const OPTIONS: { id: MuteOptionId; label: string }[] = [
  { id: "1m", label: "Trong 1 phút" },
  { id: "5m", label: "Trong 5 phút" },
  { id: "10m", label: "Trong 10 phút" },
  { id: "forever", label: "Cho đến khi được mở lại" },
];

/** Giống web `isoToDatetimeLocalValue` — nhập theo giờ máy (không cần native datetime picker). */
function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function MuteNotificationsModal({
  visible,
  onClose,
  onConfirm,
  isSubmitting = false,
  mode = "create",
  scheduledUntilIso = null,
}: MuteNotificationsModalProps) {
  const { foreground, muted, primary } = useIconColors();
  const [selected, setSelected] = useState<MuteOptionId>("1m");
  const [editLocal, setEditLocal] = useState("");

  useEffect(() => {
    if (!visible) return;
    if (mode === "edit") {
      const iso = scheduledUntilIso?.trim() ?? "";
      setEditLocal(iso ? isoToDatetimeLocalValue(iso) : "");
    } else {
      setSelected("1m");
    }
  }, [visible, mode, scheduledUntilIso]);

  const title = mode === "edit" ? "Chỉnh sửa nhắc tắt thông báo" : "Xác nhận";

  const handleConfirmCreate = useCallback(async () => {
    if (selected === "forever") {
      await onConfirm({ kind: "untilUserUnmutes" });
      return;
    }
    await onConfirm({ kind: "muteFor", muteFor: selected });
  }, [onConfirm, selected]);

  const handleSaveEdit = useCallback(async () => {
    const raw = editLocal.trim();
    const t = new Date(raw).getTime();
    if (!raw || !Number.isFinite(t)) {
      toast.error("Chọn ngày giờ hợp lệ");
      return;
    }
    if (t <= Date.now()) {
      toast.error("Mốc phải nằm trong tương lai");
      return;
    }
    await onConfirm({ kind: "untilIso", notificationsMutedUntil: new Date(raw).toISOString() });
  }, [editLocal, onConfirm]);

  const handleClearSchedule = useCallback(async () => {
    await onConfirm({ kind: "clearScheduledMute" });
  }, [onConfirm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => !isSubmitting && onClose()}
    >
      <Pressable style={styles.backdrop} onPress={() => !isSubmitting && onClose()}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: foreground }]}>{title}</Text>
            <Pressable
              onPress={() => !isSubmitting && onClose()}
              hitSlop={10}
              disabled={isSubmitting}
              className="rounded-full p-1 active:opacity-60"
            >
              <X size={24} color={muted} strokeWidth={1.75} />
            </Pressable>
          </View>

          {mode === "edit" ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.desc, { color: muted }]}>
                Đổi mốc thời gian sẽ tự bật lại thông báo sau mốc mới, hoặc hủy lịch để bật lại ngay
                (nếu bạn không bật chế độ tắt vĩnh viễn).
              </Text>
              <Text style={[styles.label, { color: foreground }]}>Tắt thông báo đến</Text>
              <Text style={[styles.hint, { color: muted }]}>
                Định dạng: YYYY-MM-DDTHH:mm (theo giờ máy), ví dụ 2026-04-22T08:30
              </Text>
              <TextInput
                value={editLocal}
                onChangeText={setEditLocal}
                editable={!isSubmitting}
                placeholder="2026-04-22T08:30"
                placeholderTextColor={muted}
                style={[styles.textInput, { color: foreground, borderColor: muted }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.footerCol}>
                <Pressable
                  style={[styles.secondaryBtn, { backgroundColor: "rgba(0,0,0,0.06)" }]}
                  onPress={() => void handleClearSchedule()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={[styles.btnTextDanger, { color: "#b91c1c" }]}>Hủy lịch</Text>
                  )}
                </Pressable>
                <View style={styles.footerRow}>
                  <Pressable
                    style={[styles.secondaryBtn, { flex: 1, backgroundColor: "rgba(0,0,0,0.06)" }]}
                    onPress={onClose}
                    disabled={isSubmitting}
                  >
                    <Text style={[styles.btnText, { color: foreground }]}>Đóng</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.primaryBtn, { flex: 1, backgroundColor: primary }]}
                    onPress={() => void handleSaveEdit()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Lưu mốc</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.body}>
              <Text style={[styles.lead, { color: muted }]}>
                Bạn có chắc muốn tắt thông báo hội thoại này:
              </Text>
              {OPTIONS.map((opt) => {
                const on = selected === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.optionRow, on && { backgroundColor: "rgba(0,104,255,0.08)" }]}
                    onPress={() => !isSubmitting && setSelected(opt.id)}
                    disabled={isSubmitting}
                  >
                    <View style={[styles.radioOuter, { borderColor: on ? primary : muted }]}>
                      {on ? (
                        <View style={[styles.radioInner, { backgroundColor: primary }]} />
                      ) : null}
                    </View>
                    <Text style={[styles.optionLabel, { color: foreground }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
              <View style={styles.footerRow}>
                <Pressable
                  style={[styles.secondaryBtn, { flex: 1, backgroundColor: "rgba(0,0,0,0.06)" }]}
                  onPress={onClose}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.btnText, { color: foreground }]}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryBtn, { flex: 1, backgroundColor: primary }]}
                  onPress={() => void handleConfirmCreate()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Đồng ý</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 14,
    backgroundColor: "#fff",
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  desc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: "500",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: "500",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  footerCol: {
    marginTop: 12,
    gap: 10,
  },
  secondaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  btnTextDanger: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: "500",
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
});
