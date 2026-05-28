import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
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
import { Calendar, Check, CheckSquare, Clock, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useAppDispatch } from "@/hooks/useAppStore";
import { useCreateTaskMutation, useUpdateTaskMutation } from "@/store/api/chatApi";
import { toast } from "@/utils/appToast";
import { patchTaskAssignedSystemMessages } from "@/utils/patchTaskAssignedSystemMessages";
import {
  deadlineLocalInputToJsonValue,
  isoUtcToVietnamLocalDatetimeValue,
  parseDeadlineParts,
  parseVietnamLocalDeadlineInput,
  vietnamDateStr,
  vietnamHmStr,
  vietnamInstantAtCurrentMinuteStart,
} from "@/utils/vietnamDeadline";

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

function isPastDeadline(raw: string): boolean {
  const picked = parseVietnamLocalDeadlineInput(raw);
  if (!picked) return false;
  return picked.getTime() < vietnamInstantAtCurrentMinuteStart().getTime();
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
  const dispatch = useAppDispatch();
  const [createTask, { isLoading: submittingCreate }] = useCreateTaskMutation();
  const [updateTask, { isLoading: submittingUpdate }] = useUpdateTaskMutation();
  const submitting = submittingCreate || submittingUpdate;

  const [taskTitle, setTaskTitle] = useState("");
  const [taskNote, setTaskNote] = useState("");
  /** Chuỗi `YYYY-MM-DDTHH:mm` theo giờ tường VN — giống web TaskModal. */
  const [taskDeadline, setTaskDeadline] = useState("");
  const [timeFieldTouched, setTimeFieldTouched] = useState(false);
  const [vnClockKey, setVnClockKey] = useState(0);
  const [iosDeadlinePick, setIosDeadlinePick] = useState<null | "date" | "time">(null);
  const [iosDeadlineDraft, setIosDeadlineDraft] = useState(() => new Date());
  const [assignToAll, setAssignToAll] = useState(false);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [subtaskRows, setSubtaskRows] = useState<{ assigneeId: string; content: string }[]>([]);

  const readVnClock = useCallback(() => {
    const now = new Date();
    return { dateStr: vietnamDateStr(now), timeStr: vietnamHmStr(now) };
  }, []);

  const resetForm = useCallback(() => {
    const { dateStr, timeStr } = readVnClock();
    const defaultDl = `${dateStr}T${timeStr}`;
    if (existingTask) {
      setTaskTitle(existingTask.title || "");
      setTaskNote(existingTask.description || "");
      const vnFromIso = existingTask.dueDate
        ? isoUtcToVietnamLocalDatetimeValue(String(existingTask.dueDate))
        : "";
      let nextDl = vnFromIso.trim() ? vnFromIso : defaultDl;
      if (isPastDeadline(nextDl)) nextDl = defaultDl;
      setTaskDeadline(nextDl);
      setIosDeadlinePick(null);
      setAssignToAll(Boolean(existingTask.assignToAll || existingTask.broadcast));
      setAssignees(Array.isArray(existingTask.assignees) ? existingTask.assignees.map(String) : []);
      const subs = Array.isArray(existingTask.subtasks) ? existingTask.subtasks : [];
      if (subs.length > 0) {
        setSubtaskRows(
          subs.map((s: any) => ({
            assigneeId: String(s.assigneeId ?? ""),
            content: String(s.content ?? ""),
          })),
        );
      } else {
        setSubtaskRows([]);
      }
    } else {
      setTaskTitle("");
      setTaskNote("");
      setTaskDeadline(defaultDl);
      setIosDeadlinePick(null);
      setAssignToAll(false);
      setAssignees([]);
      setSubtaskRows([]);
    }
    setTimeFieldTouched(false);
  }, [existingTask, readVnClock]);

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible, resetForm]);

  useEffect(() => {
    if (!visible) return;
    setVnClockKey((k) => k + 1);
    const t = setInterval(() => setVnClockKey((k) => k + 1), 15_000);
    return () => clearInterval(t);
  }, [visible]);

  const todayDateStr = useMemo(() => vietnamDateStr(new Date()), [vnClockKey]);
  const nowTimeStr = useMemo(() => vietnamHmStr(new Date()), [vnClockKey]);

  const eligibleMembers = useMemo(() => {
    if (assignToAll) return members;
    return members.filter((m) => assignees.includes(m.userId));
  }, [assignToAll, members, assignees]);

  useEffect(() => {
    if (assignToAll) return;
    const set = new Set(assignees);
    setSubtaskRows((prev) => prev.filter((r) => set.has(r.assigneeId)));
  }, [assignToAll, assignees]);

  const deadlineParts = useMemo(() => parseDeadlineParts(taskDeadline), [taskDeadline]);
  const selectedDate = deadlineParts.date || "";
  const selectedTime = deadlineParts.time || "";
  const hasDeadline = Boolean(taskDeadline.trim());
  const isEditing = Boolean(existingTask?.taskId);
  const timeOnTodayNotAfterNow =
    hasDeadline &&
    selectedDate === todayDateStr &&
    Boolean(selectedTime) &&
    selectedTime <= nowTimeStr &&
    (isEditing || timeFieldTouched);
  const deadlineTimeWarning =
    hasDeadline && (isPastDeadline(taskDeadline) || timeOnTodayNotAfterNow);
  const deadlineOk = hasDeadline && !deadlineTimeWarning;

  const hasSubtasks = useMemo(
    () => subtaskRows.some((r) => r.assigneeId && r.content.trim().length > 0),
    [subtaskRows],
  );
  const hasAssignees = assignToAll || assignees.length > 0;
  const canSubmit =
    taskTitle.trim().length > 0 && deadlineOk && hasAssignees && (hasSubtasks || hasAssignees);

  const toggleAssignee = (id: string) => {
    if (assignToAll) return;
    setAssignees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitInFlightRef = useRef(false);

  const submit = async () => {
    if (!canSubmit || submitting || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    const cleanSubtasks = subtaskRows
      .map((r) => ({
        assigneeId: String(r.assigneeId ?? ""),
        content: String(r.content ?? "").trim(),
      }))
      .filter((r) => r.assigneeId && r.content);
    try {
      if (existingTask?.taskId) {
        const dueDateIso = deadlineLocalInputToJsonValue(taskDeadline) ?? undefined;
        const byId = new Map(
          members.map((m) => [m.userId, m.displayName?.trim() || m.userId] as const),
        );
        const assigneeLabel =
          cleanSubtasks.length > 0
            ? cleanSubtasks.map((r) => String(byId.get(r.assigneeId) ?? r.assigneeId)).join(", ")
            : assignToAll
              ? "Cả nhóm"
              : assignees.map((id) => String(byId.get(id) ?? id)).join(", ") || "cả nhóm";
        const assigneeUserIds =
          cleanSubtasks.length > 0
            ? cleanSubtasks.map((r) => String(r.assigneeId))
            : assignToAll
              ? []
              : assignees.map((id) => String(id));
        const assigneesCount = assignToAll ? members.length : assigneeUserIds.length;

        await updateTask({
          groupId,
          taskId: existingTask.taskId,
          title: taskTitle.trim(),
          description: taskNote.trim() ? taskNote.trim() : undefined,
          assignees: assignToAll ? [] : assignees,
          assignToAll: assignToAll || undefined,
          dueDate: dueDateIso,
          subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : undefined,
        }).unwrap();

        patchTaskAssignedSystemMessages(dispatch, groupId, String(existingTask.taskId), {
          title: taskTitle.trim(),
          dueDate: dueDateIso ?? null,
          note: taskNote.trim() ? taskNote.trim() : null,
          assigneeLabel,
          assignToAll,
          broadcast: assignToAll,
          assigneeUserIds,
          assigneesCount,
        });
        toast.success("Đã cập nhật công việc");
      } else {
        await createTask({
          groupId,
          title: taskTitle.trim(),
          description: taskNote.trim() ? taskNote.trim() : undefined,
          assignees: assignToAll ? [] : assignees,
          assignToAll: assignToAll || undefined,
          dueDate: deadlineLocalInputToJsonValue(taskDeadline) ?? undefined,
          subtasks: cleanSubtasks.length > 0 ? cleanSubtasks : undefined,
        }).unwrap();
        toast.success("Đã tạo công việc");
      }
      onClose();
    } catch {
      toast.error(existingTask ? "Không thể cập nhật công việc" : "Không thể tạo công việc");
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const mergeDateFromPicker = (picked: Date) => {
    const newDate = vietnamDateStr(picked);
    const parts = parseDeadlineParts(taskDeadline);
    let nextTime = parts.time || nowTimeStr;
    if (newDate === todayDateStr && nextTime < nowTimeStr) nextTime = nowTimeStr;
    setTaskDeadline(`${newDate}T${nextTime}`);
  };

  const mergeTimeFromPicker = (picked: Date) => {
    setTimeFieldTouched(true);
    const newTime = vietnamHmStr(picked);
    const parts = parseDeadlineParts(taskDeadline);
    const d = parts.date || todayDateStr;
    let fixedTime = newTime;
    if (d === todayDateStr && fixedTime < nowTimeStr) fixedTime = nowTimeStr;
    setTaskDeadline(`${d}T${fixedTime}`);
  };

  const openAndroidDatePicker = () => {
    const base =
      parseVietnamLocalDeadlineInput(taskDeadline) ?? vietnamInstantAtCurrentMinuteStart();
    const minD =
      parseVietnamLocalDeadlineInput(`${todayDateStr}T00:00`) ??
      vietnamInstantAtCurrentMinuteStart();
    DateTimePickerAndroid.open({
      value: base,
      mode: "date",
      display: "default",
      minimumDate: minD,
      onChange: (event, selectedDate) => {
        if (event.type !== "set" || !selectedDate) return;
        mergeDateFromPicker(selectedDate);
      },
    });
  };

  const openAndroidTimePicker = () => {
    const base =
      parseVietnamLocalDeadlineInput(taskDeadline) ?? vietnamInstantAtCurrentMinuteStart();
    DateTimePickerAndroid.open({
      value: base,
      mode: "time",
      display: "default",
      is24Hour: true,
      onChange: (event, selectedTime) => {
        if (event.type !== "set" || !selectedTime) return;
        mergeTimeFromPicker(selectedTime);
      },
    });
  };

  const openIosDeadlinePicker = (mode: "date" | "time") => {
    const base =
      parseVietnamLocalDeadlineInput(taskDeadline) ?? vietnamInstantAtCurrentMinuteStart();
    setIosDeadlineDraft(base);
    setIosDeadlinePick(mode);
  };

  const commitIosDeadlinePicker = () => {
    if (!iosDeadlinePick) return;
    if (iosDeadlinePick === "date") mergeDateFromPicker(iosDeadlineDraft);
    else mergeTimeFromPicker(iosDeadlineDraft);
    setIosDeadlinePick(null);
  };

  const setSubtaskContentForMember = (memberId: string, text: string) => {
    const id = String(memberId);
    setSubtaskRows((prev) => {
      const has = prev.some((r) => String(r.assigneeId) === id);
      const nextText = text;
      if (!nextText.trim()) {
        if (!has) return prev;
        return prev.filter((r) => String(r.assigneeId) !== id);
      }
      if (has) {
        return prev.map((r) => (String(r.assigneeId) === id ? { ...r, content: nextText } : r));
      }
      return [...prev, { assigneeId: id, content: nextText }];
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={onClose}
      >
        {/* flex:1 + nền: Modal RN không luôn cho con full chiều cao; thiếu sẽ đẩy footer xuống dưới viewport khi nội dung dài. */}
        <View style={styles.modalRoot}>
          <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
            <View style={styles.topBar}>
              <Pressable
                onPress={onClose}
                style={styles.iconBtn}
                hitSlop={12}
                disabled={submitting}
              >
                <X size={26} color={Z.text} strokeWidth={1.75} />
              </Pressable>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginLeft: 4,
                }}
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

            {/* minHeight:0 — flex con co lại để ScrollView cuộn trong vùng còn lại; footer giống web (shrink-0) luôn dính đáy. */}
            <View style={styles.scrollRegion}>
              <ScrollView
                style={styles.scroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
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

                <Text style={[styles.fieldLabel, styles.mt]}>Thời hạn</Text>
                <View style={styles.deadlineTwoCol}>
                  <Pressable
                    style={[styles.deadlineHalfCard, submitting && { opacity: 0.55 }]}
                    onPress={() =>
                      Platform.OS === "android"
                        ? openAndroidDatePicker()
                        : openIosDeadlinePicker("date")
                    }
                    disabled={submitting}
                  >
                    <Text style={styles.deadlineHalfLabel}>Ngày</Text>
                    <View style={styles.deadlineHalfInner}>
                      <Calendar size={18} color={Z.taskAccentDark} strokeWidth={2} />
                      <Text style={styles.deadlineHalfValue} numberOfLines={1}>
                        {selectedDate || "—"}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    style={[styles.deadlineHalfCard, submitting && { opacity: 0.55 }]}
                    onPress={() =>
                      Platform.OS === "android"
                        ? openAndroidTimePicker()
                        : openIosDeadlinePicker("time")
                    }
                    disabled={submitting}
                  >
                    <Text style={styles.deadlineHalfLabel}>Thời gian</Text>
                    <View style={styles.deadlineHalfInner}>
                      <Clock size={18} color={Z.taskAccentDark} strokeWidth={2} />
                      <Text style={styles.deadlineHalfValue} numberOfLines={1}>
                        {selectedTime || "—"}
                      </Text>
                    </View>
                  </Pressable>
                </View>
                {deadlineTimeWarning ? (
                  <Text style={styles.deadlineWarn}>
                    Thời gian đã chọn phải sau thời điểm hiện tại (giờ Việt Nam).
                  </Text>
                ) : (
                  <Text style={[styles.helpSmall, styles.deadlineVnHint]}>
                    Ngày và giờ theo múi Việt Nam (đồng bộ web).
                  </Text>
                )}

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
                      <Text style={styles.helpSmall}>Tự động áp dụng cho tất cả thành viên</Text>
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
                  placeholder="Nhập mô tả hoặc ghi chú cho công việc…"
                  placeholderTextColor={Z.sub}
                  style={[styles.input, styles.textArea]}
                  multiline
                  editable={!submitting}
                />

                <View style={styles.subtaskLabelRow}>
                  <Text style={styles.subtaskSectionTitle}>Công việc chi tiết từng người</Text>
                  {!assignToAll && eligibleMembers.length > 0 ? (
                    <View style={styles.subtaskOptionalPill}>
                      <Text style={styles.subtaskOptionalPillText}>Tùy chọn</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.subtaskMemberBox}>
                  {!assignToAll && eligibleMembers.length === 0 ? (
                    <Text style={styles.subtaskEmptyHint}>
                      Vui lòng chọn người ở mục{" "}
                      <Text style={styles.subtaskEmptyBold}>Giao cho</Text> để thêm công việc chi
                      tiết.
                    </Text>
                  ) : (
                    (assignToAll ? members : eligibleMembers).map((m) => {
                      const value =
                        subtaskRows.find((r) => String(r.assigneeId) === m.userId)?.content ?? "";
                      return (
                        <View key={m.userId} style={styles.subtaskMemberBlock}>
                          <View style={styles.subtaskMemberHead}>
                            <Avatar uri={m.avatar || undefined} name={m.displayName} size="sm" />
                            <Text style={styles.subtaskMemberName} numberOfLines={1}>
                              {labelForMember(currentUserId, m)}
                            </Text>
                          </View>
                          <TextInput
                            value={value}
                            onChangeText={(t) => setSubtaskContentForMember(m.userId, t)}
                            placeholder="Nhập nội dung chi tiết…"
                            placeholderTextColor={Z.sub}
                            style={styles.subtaskTextarea}
                            multiline
                            editable={!submitting}
                          />
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>

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
                      {existingTask ? "Lưu thay đổi" : "Giao việc ngay"}
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      <Modal
        visible={Platform.OS === "ios" && iosDeadlinePick !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIosDeadlinePick(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setIosDeadlinePick(null)}>
          <Pressable style={styles.deadlineIosSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.deadlineIosBar}>
              <Pressable onPress={() => setIosDeadlinePick(null)} hitSlop={12}>
                <Text style={styles.deadlineIosBarBtn}>Hủy</Text>
              </Pressable>
              <Text style={styles.deadlineIosTitle}>
                {iosDeadlinePick === "time" ? "Thời gian" : "Ngày"}
              </Text>
              <Pressable onPress={commitIosDeadlinePicker} hitSlop={12}>
                <Text style={[styles.deadlineIosBarBtn, { color: Z.primary }]}>Xong</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={iosDeadlineDraft}
              mode={iosDeadlinePick === "time" ? "time" : "date"}
              display="spinner"
              onChange={(_, d) => {
                if (d) setIosDeadlineDraft(d);
              }}
              textColor={Z.text}
              timeZoneName={Platform.OS === "ios" ? "Asia/Ho_Chi_Minh" : undefined}
              minimumDate={
                iosDeadlinePick === "date"
                  ? (parseVietnamLocalDeadlineInput(`${todayDateStr}T00:00`) ?? undefined)
                  : undefined
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: Z.bg },
  safe: { flex: 1, backgroundColor: Z.bg },
  /** Vùng giữa co trong flex để ScrollView không đẩy footer ra khỏi màn hình. */
  scrollRegion: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 24 },
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
  deadlineTwoCol: { flexDirection: "row", gap: 12, marginHorizontal: 16 },
  deadlineHalfCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Z.subBg,
  },
  deadlineHalfLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Z.sub,
    marginBottom: 8,
  },
  deadlineHalfInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  deadlineHalfValue: { flex: 1, fontSize: 15, fontWeight: "600", color: Z.text, minWidth: 0 },
  deadlineWarn: {
    marginHorizontal: 16,
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#EA580C",
  },
  deadlineVnHint: { marginHorizontal: 16, marginTop: 8 },
  subtaskLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 8,
  },
  subtaskSectionTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Z.sub,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  subtaskOptionalPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#E0E7FF",
  },
  subtaskOptionalPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4338CA",
    textTransform: "lowercase",
    letterSpacing: 0,
  },
  subtaskMemberBox: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Z.subBg,
  },
  subtaskEmptyHint: {
    paddingHorizontal: 16,
    paddingVertical: 22,
    fontSize: 13,
    fontWeight: "600",
    color: Z.sub,
    textAlign: "center",
  },
  subtaskEmptyBold: { fontWeight: "800", color: Z.primary, textTransform: "uppercase" },
  subtaskMemberBlock: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.line,
    backgroundColor: Z.bg,
  },
  subtaskMemberHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  subtaskMemberName: { flex: 1, fontSize: 13, fontWeight: "800", color: Z.text },
  subtaskTextarea: {
    minHeight: 72,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "500",
    color: Z.text,
    backgroundColor: Z.subBg,
  },
  footer: {
    flexShrink: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
    backgroundColor: Z.bg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 8 },
    }),
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
