import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
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
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronRight,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useCreateTaskMutation, useUpdateTaskMutation } from "@/store/api/chatApi";
import { toast } from "@/utils/appToast";

const Z = {
  bg: "#FFFFFF",
  subBg: "#F3F4F6",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  primary: "#0068FF",
  /** Accent giống web TaskModal (green). */
  taskAccent: "#22C55E",
  taskAccentDark: "#16A34A",
  red: "#DC2626",
  line: "#E5E7EB",
};

export type GroupTaskModalMember = {
  userId: string;
  displayName: string;
  avatar?: string | null;
  role?: string;
};

type GroupTaskModalProps = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  members: GroupTaskModalMember[];
  currentUserId?: string;
  existingTask?: any;
  onDelete?: () => void;
};

function labelForMember(currentUserId: string | undefined, m: GroupTaskModalMember): string {
  if (currentUserId && m.userId === currentUserId) return "Bạn";
  return m.displayName?.trim() || m.userId;
}

/** Giống web `<input type="datetime-local" />` (không gửi giây). */
function toDatetimeLocalValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function GroupTaskModal({
  visible,
  onClose,
  groupId,
  members,
  currentUserId,
  existingTask,
  onDelete,
}: GroupTaskModalProps): ReactElement {
  const [createTask, { isLoading: submittingCreate }] = useCreateTaskMutation();
  const [updateTask, { isLoading: submittingUpdate }] = useUpdateTaskMutation();
  const submitting = submittingCreate || submittingUpdate;

  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [deadlineDraft, setDeadlineDraft] = useState(() => new Date());
  const [assignToAll, setAssignToAll] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [subtaskRows, setSubtaskRows] = useState<{ assigneeId: string; content: string }[]>([]);
  const [pickAssigneeForRow, setPickAssigneeForRow] = useState<number | null>(null);

  const firstMemberId = members[0]?.userId ?? "";

  const resetForm = useCallback(() => {
    if (existingTask) {
      setTaskTitle(existingTask.title || "");
      setTaskNote(existingTask.description || "");
      const d = existingTask.dueDate ? new Date(existingTask.dueDate) : null;
      setDeadline(d);
      setDeadlineDraft(d || new Date());
      setDeadlinePickerOpen(false);
      setAssignToAll(Boolean(existingTask.assignToAll || existingTask.broadcast));
      setAssignees(Array.isArray(existingTask.assignees) ? existingTask.assignees.map(String) : []);
      const subs = Array.isArray(existingTask.subtasks) ? existingTask.subtasks : [];
      if (subs.length > 0) {
        setSubtaskRows(
          subs.map((s: any) => ({
            assigneeId: String(s.assigneeId ?? firstMemberId),
            content: String(s.content ?? ""),
          })),
        );
      } else {
        setSubtaskRows(firstMemberId ? [{ assigneeId: firstMemberId, content: "" }] : []);
      }
      setPickAssigneeForRow(null);
    } else {
      setTaskTitle("");
      setTaskNote("");
      setDeadline(null);
      setDeadlinePickerOpen(false);
      setDeadlineDraft(new Date());
      setAssignToAll(false);
      setAssignees([]);
      setSubtaskRows(firstMemberId ? [{ assigneeId: firstMemberId, content: "" }] : []);
      setPickAssigneeForRow(null);
    }
  }, [existingTask, firstMemberId]);

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, resetForm]);

  const hasSubtasks = useMemo(
    () => subtaskRows.some((r) => r.assigneeId && r.content.trim().length > 0),
    [subtaskRows],
  );

  const canSubmit =
    taskTitle.trim().length > 0 && (hasSubtasks || assignToAll || assignees.length > 0);

  const toggleAssignee = (id: string) => {
    if (assignToAll) return;
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    const cleanSubtasks = subtaskRows
      .map((r) => ({
        assigneeId: String(r.assigneeId ?? ""),
        content: String(r.content ?? "").trim(),
      }))
      .filter((r) => r.assigneeId && r.content);
    try {
      if (existingTask?.taskId) {
        await updateTask({
          groupId,
          taskId: existingTask.taskId,
          title: taskTitle.trim(),
          description: taskNote.trim() ? taskNote.trim() : undefined,
          assignees: assignToAll ? [] : assignees,
          assignToAll: assignToAll || undefined,
          dueDate: deadline ? toDatetimeLocalValue(deadline) : undefined,
          subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : undefined,
        }).unwrap();
        toast.success("Đã cập nhật công việc");
      } else {
        await createTask({
          groupId,
          title: taskTitle.trim(),
          description: taskNote.trim() ? taskNote.trim() : undefined,
          assignees: assignToAll ? [] : assignees,
          assignToAll: assignToAll || undefined,
          dueDate: deadline ? toDatetimeLocalValue(deadline) : undefined,
          subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : undefined,
        }).unwrap();
        toast.success("Đã tạo công việc");
      }
      onClose();
    } catch {
      toast.error(existingTask ? "Không thể cập nhật công việc" : "Không thể tạo công việc");
    }
  };

  const addSubtaskRow = () => {
    setSubtaskRows((prev) => [...prev, { assigneeId: firstMemberId, content: "" }]);
  };

  const removeSubtaskRow = (idx: number) => {
    setSubtaskRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const openDeadlinePicker = () => {
    const d = deadline ?? new Date();
    setDeadlineDraft(d);

    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: d,
        mode: "date",
        display: "default",
        onChange: (event, selectedDate) => {
          if (event.type === "set" && selectedDate) {
            // Sau khi chọn Ngày xong, bật tiếp chọn Giờ
            DateTimePickerAndroid.open({
              value: selectedDate,
              mode: "time",
              display: "default",
              onChange: (timeEvent, selectedTime) => {
                if (timeEvent.type === "set" && selectedTime) {
                  setDeadline(selectedTime);
                }
              },
            });
          }
        },
      });
    } else {
      setDeadlinePickerOpen(true);
    }
  };

  return (
    <>
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
                <CheckSquare size={18} color={Z.taskAccentDark} strokeWidth={2} />
              </View>
              <Text style={styles.topTitle} numberOfLines={1}>
                {existingTask ? "Chi tiết công việc" : "Giao việc & Nhắc hẹn"}
              </Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <Text style={styles.fieldLabel}>Tiêu đề công việc</Text>
            <TextInput
              value={taskTitle}
              onChangeText={setTaskTitle}
              placeholder="Nhập tiêu đề công việc…"
              placeholderTextColor={Z.sub}
              style={styles.input}
              editable={!submitting}
            />

            <Text style={[styles.fieldLabel, styles.mt]}>Thời hạn / nhắc hẹn (tùy chọn)</Text>
            <View style={styles.deadlineRow}>
              <Pressable
                style={[styles.deadlineCard, submitting && { opacity: 0.55 }]}
                onPress={openDeadlinePicker}
                disabled={submitting}
              >
                <View style={styles.deadlineIconWrap}>
                  <Calendar size={18} color={Z.taskAccentDark} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.deadlineMain} numberOfLines={2}>
                    {deadline
                      ? deadline.toLocaleString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Chạm để chọn ngày & giờ"}
                  </Text>
                  <Text style={styles.helpSmall}>Giống web (lịch datetime-local)</Text>
                </View>
                <ChevronRight size={20} color={Z.sub} strokeWidth={2} />
              </Pressable>
              {deadline ? (
                <Pressable
                  style={styles.deadlineClearBtn}
                  onPress={() => setDeadline(null)}
                  disabled={submitting}
                  hitSlop={8}
                >
                  <X size={20} color={Z.sub} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>

            <Text style={[styles.fieldLabel, styles.mt]}>Giao cho</Text>
            <Pressable
              style={[styles.assignAllCard, assignToAll && styles.assignAllOn]}
              onPress={() => {
                setAssignToAll((v) => !v);
                if (!assignToAll) setAssignees([]);
              }}
              disabled={submitting}
            >
              <View style={styles.assignAllLeft}>
                <View style={styles.smallIconWrap}>
                  <Users size={18} color={Z.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>Giao cho cả nhóm</Text>
                  <Text style={styles.helpSmall}>
                    Tự động áp dụng cho tất cả thành viên hiện tại
                  </Text>
                </View>
              </View>
              <Switch
                value={assignToAll}
                onValueChange={(v) => {
                  setAssignToAll(v);
                  if (v) setAssignees([]);
                }}
                disabled={submitting}
                trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
                thumbColor={assignToAll ? Z.taskAccent : "#f4f4f5"}
              />
            </Pressable>

            <View style={[styles.memberBox, assignToAll && { opacity: 0.55 }]}>
              {members.map((m) => {
                const on = assignees.includes(m.userId);
                return (
                  <Pressable
                    key={m.userId}
                    style={styles.memberRow}
                    onPress={() => toggleAssignee(m.userId)}
                    disabled={assignToAll || submitting}
                  >
                    <View style={[styles.checkOuter, on && styles.checkOuterOn]}>
                      {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                    </View>
                    <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.menuLabel}>{labelForMember(currentUserId, m)}</Text>
                      <Text style={styles.helpSmall}>{m.role ? String(m.role) : ""}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, styles.mt]}>Ghi chú thêm</Text>
            <TextInput
              value={taskNote}
              onChangeText={setTaskNote}
              placeholder="Mô tả hoặc ghi chú…"
              placeholderTextColor={Z.sub}
              style={[styles.input, styles.textArea]}
              multiline
              editable={!submitting}
            />

            <Text style={[styles.fieldLabel, styles.mt]}>Công việc cụ thể theo từng người</Text>
            {subtaskRows.map((row, idx) => (
              <View key={`sub-${idx}`} style={styles.subRow}>
                <Pressable
                  style={styles.subAssignee}
                  onPress={() => setPickAssigneeForRow(idx)}
                  disabled={submitting}
                >
                  <Text style={styles.subAssigneeText} numberOfLines={1}>
                    {members.find((x) => x.userId === row.assigneeId)
                      ? labelForMember(
                          currentUserId,
                          members.find((x) => x.userId === row.assigneeId)!,
                        )
                      : "Chọn người"}
                  </Text>
                </Pressable>
                <TextInput
                  value={row.content}
                  onChangeText={(t) => {
                    setSubtaskRows((prev) => {
                      const next = [...prev];
                      next[idx] = { ...next[idx]!, content: t };
                      return next;
                    });
                  }}
                  placeholder="Nội dung (VD: Thiết kế UI)"
                  placeholderTextColor={Z.sub}
                  style={[styles.input, { flex: 1, marginTop: 0 }]}
                  editable={!submitting}
                />
                <Pressable
                  onPress={() => removeSubtaskRow(idx)}
                  disabled={submitting || subtaskRows.length <= 1}
                  style={{ padding: 8, opacity: subtaskRows.length <= 1 ? 0.35 : 1 }}
                >
                  <Trash2 size={20} color={Z.red} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addSubBtn} onPress={addSubtaskRow} disabled={submitting}>
              <Plus size={20} color={Z.primary} strokeWidth={2} />
              <Text style={[styles.menuLabel, { marginLeft: 8, color: Z.primary }]}>
                Thêm công việc
              </Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            {!existingTask ? (
              <Pressable style={styles.btnGhost} onPress={onClose} disabled={submitting}>
                <Text style={styles.btnGhostText}>Đóng</Text>
              </Pressable>
            ) : onDelete && existingTask.creatorId && existingTask.creatorId === currentUserId ? (
              <Pressable style={styles.btnGhost} onPress={onDelete} disabled={submitting}>
                <Text style={[styles.btnGhostText, { color: Z.red }]}>Hủy công việc</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.btnGhost} onPress={onClose} disabled={submitting}>
                <Text style={styles.btnGhostText}>Đóng</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.btnPrimary, (!canSubmit || submitting) && styles.btnPrimaryDisabled]}
              onPress={() => void submit()}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <CheckSquare size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.btnPrimaryText}>
                    {existingTask ? "Lưu thay đổi" : "Giao việc"}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Platform.OS === "ios" && deadlinePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeadlinePickerOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setDeadlinePickerOpen(false)}>
          <Pressable style={styles.deadlineIosSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.deadlineIosBar}>
              <Pressable onPress={() => setDeadlinePickerOpen(false)} hitSlop={12}>
                <Text style={styles.deadlineIosBarBtn}>Hủy</Text>
              </Pressable>
              <Text style={styles.deadlineIosTitle}>Thời hạn</Text>
              <Pressable
                onPress={() => {
                  setDeadline(deadlineDraft);
                  setDeadlinePickerOpen(false);
                }}
                hitSlop={12}
              >
                <Text style={[styles.deadlineIosBarBtn, { color: Z.primary }]}>Xong</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={deadlineDraft}
              mode="datetime"
              display="spinner"
              onChange={(_, d) => {
                if (d) setDeadlineDraft(d);
              }}
              textColor={Z.text}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pickAssigneeForRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickAssigneeForRow(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setPickAssigneeForRow(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Chọn người</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {members.map((m) => (
                <Pressable
                  key={m.userId}
                  style={styles.sheetRow}
                  onPress={() => {
                    const idx = pickAssigneeForRow;
                    if (idx === null) return;
                    setSubtaskRows((prev) => {
                      const next = [...prev];
                      if (next[idx]) next[idx] = { ...next[idx]!, assigneeId: m.userId };
                      return next;
                    });
                    setPickAssigneeForRow(null);
                  }}
                >
                  <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                  <Text style={[styles.menuLabel, { flex: 1, marginLeft: 12 }]}>
                    {labelForMember(currentUserId, m)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.sheetCancel} onPress={() => setPickAssigneeForRow(null)}>
              <Text style={{ color: Z.sub, fontWeight: "600" }}>Hủy</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { fontSize: 17, fontWeight: "700", color: Z.text, flexShrink: 1 },
  scroll: { flex: 1 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Z.sub,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  mt: { marginTop: 16 },
  input: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Z.text,
    backgroundColor: Z.subBg,
  },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  assignAllCard: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Z.border,
    backgroundColor: Z.bg,
  },
  assignAllOn: { borderColor: "#93C5FD", backgroundColor: "#EFF6FF" },
  assignAllLeft: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 },
  smallIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  menuLabel: { fontSize: 15, color: Z.text, fontWeight: "600" },
  helpSmall: { fontSize: 12, color: Z.sub, marginTop: 2 },
  memberBox: {
    marginHorizontal: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 14,
    overflow: "hidden",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  checkOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOuterOn: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
  },
  subAssignee: {
    minWidth: 100,
    maxWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Z.border,
    backgroundColor: Z.subBg,
  },
  subAssigneeText: { fontSize: 13, fontWeight: "600", color: Z.primary },
  addSubBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
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
    backgroundColor: Z.taskAccent,
  },
  btnPrimaryDisabled: { backgroundColor: "#D1D5DB" },
  btnPrimaryText: { fontWeight: "700", color: "#fff", fontSize: 15 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: Z.bg, borderRadius: 16, paddingTop: 12, maxHeight: "80%" },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Z.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  sheetCancel: {
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
  },
  deadlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    gap: 8,
  },
  deadlineCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Z.subBg,
    gap: 10,
  },
  deadlineIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  deadlineMain: { fontSize: 15, fontWeight: "600", color: Z.text },
  deadlineClearBtn: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Z.border,
    backgroundColor: Z.bg,
  },
  deadlineIosSheet: {
    backgroundColor: Z.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 12,
    marginTop: "auto",
  },
  deadlineIosBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
  },
  deadlineIosBarBtn: { fontSize: 16, fontWeight: "600", color: Z.sub },
  deadlineIosTitle: { fontSize: 15, fontWeight: "700", color: Z.text },
});
