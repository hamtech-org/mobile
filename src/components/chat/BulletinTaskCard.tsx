import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CheckSquare, Trash2, Users } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { isTaskJoinDeadlinePassed } from "@/utils/taskJoin";
import { TaskDeadlineChipMobile } from "@/utils/taskDeadlineDisplay";

const Z = {
  text: "#111827",
  sub: "#6B7280",
  bg: "#FFFFFF",
  red: "#DC2626",
};

function taskSummary(raw: unknown): { id: string; title: string; due?: string } {
  if (!raw || typeof raw !== "object") return { id: "", title: "" };
  const o = raw as Record<string, unknown>;
  const due = o.dueDate;
  return {
    id: String(o.taskId ?? ""),
    title: String(o.title ?? "Công việc"),
    due: typeof due === "string" && due.trim() ? due : undefined,
  };
}

export type BulletinTaskCardProps = {
  raw: unknown;
  creator: string;
  avatarUrl?: string;
  when: string;
  effectiveUserId?: string;
  onTaskJoined?: (taskId: string) => void | Promise<void>;
  onEditTaskFromBulletin?: (task: Record<string, unknown>) => void;
  onDeleteTaskFromBulletin?: (taskId: string) => void | Promise<void>;
  taskActionBusy?: boolean;
};

/** Thẻ nhắc hẹn trong danh sách lưu trữ — đồng bộ web `BulletinTaskCard`. */
export function BulletinTaskCard({
  raw,
  creator,
  avatarUrl,
  when,
  effectiveUserId,
  onTaskJoined,
  onEditTaskFromBulletin,
  onDeleteTaskFromBulletin,
  taskActionBusy,
}: BulletinTaskCardProps): ReactElement {
  const o = raw as Record<string, unknown>;
  const t = taskSummary(raw);
  const desc = String(o.description ?? "").trim();
  const due = t.due;
  const dueOk = Boolean(due && !Number.isNaN(new Date(due).getTime()));
  const assignees = Array.isArray(o.assignees) ? (o.assignees as string[]) : [];
  const participants = Array.isArray(o.participants) ? (o.participants as string[]) : [];
  const subs = Array.isArray(o.subtasks) ? o.subtasks : [];
  const subAssigneeIds = subs
    .map((s) => String((s as { assigneeId?: string }).assigneeId ?? "").trim())
    .filter(Boolean);
  const assignToAll = Boolean(o.assignToAll) || Boolean(o.broadcast);
  const uid = String(effectiveUserId ?? "");
  const creatorId = typeof o.creatorId === "string" ? o.creatorId : "";
  const joined = uid ? participants.includes(uid) : false;
  const canJoin =
    assignToAll ||
    (uid ? assignees.map(String).includes(uid) : false) ||
    (uid ? subAssigneeIds.includes(uid) : false);
  const joinDeadlinePassed = dueOk && isTaskJoinDeadlinePassed(due);
  const showJoinButton = Boolean(onTaskJoined) && !joined && canJoin && !joinDeadlinePassed;
  const isCreator = Boolean(creatorId && uid && creatorId === uid);

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Avatar uri={avatarUrl} name={creator} size="md" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.creatorName} numberOfLines={1}>
              {creator}
            </Text>
            <View style={styles.kindRow}>
              <CheckSquare size={14} color="#16a34a" strokeWidth={2} />
              <Text style={styles.kindLabel}>Công việc</Text>
            </View>
          </View>
        </View>
        <Text style={styles.title} numberOfLines={4}>
          {t.title}
        </Text>
        {desc ? (
          <Text style={styles.preview} numberOfLines={3}>
            {desc}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          {dueOk ? <TaskDeadlineChipMobile dateIso={due!} compact /> : null}
          <View style={styles.chip}>
            <Users size={12} color={Z.sub} strokeWidth={2} />
            <Text style={styles.chipText}>
              {participants.length > 0 ? `${participants.length} đã tham gia` : "Chưa ai tham gia"}
            </Text>
          </View>
          {joined ? (
            <View style={[styles.chip, styles.chipJoined]}>
              <Text style={styles.chipJoinedText}>Bạn đã tham gia</Text>
            </View>
          ) : canJoin && joinDeadlinePassed ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>Chưa tham gia</Text>
            </View>
          ) : showJoinButton ? (
            <Pressable
              onPress={() => void onTaskJoined?.(t.id)}
              disabled={taskActionBusy}
              style={[styles.joinBtn, taskActionBusy ? { opacity: 0.5 } : null]}
            >
              <Text style={styles.joinBtnText}>Xác nhận tham gia</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.footer}>
          <Text style={styles.when}>{when || "—"}</Text>
          {isCreator && (onEditTaskFromBulletin || onDeleteTaskFromBulletin) ? (
            <View style={styles.adminRow}>
              {onEditTaskFromBulletin ? (
                <Pressable
                  onPress={() => onEditTaskFromBulletin(o)}
                  disabled={taskActionBusy}
                  style={styles.adminBtn}
                >
                  <Text style={styles.adminBtnText}>Sửa</Text>
                </Pressable>
              ) : null}
              {onDeleteTaskFromBulletin ? (
                <Pressable
                  onPress={() => void onDeleteTaskFromBulletin(t.id)}
                  disabled={taskActionBusy}
                  style={[styles.adminBtn, styles.adminBtnDanger]}
                >
                  <Trash2 size={12} color={Z.red} strokeWidth={2} />
                  <Text style={[styles.adminBtnText, { color: Z.red }]}>Hủy công việc</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 16,
    backgroundColor: Z.bg,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  creatorName: { fontSize: 13, fontWeight: "700", color: Z.text },
  kindRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  kindLabel: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  title: { marginTop: 10, fontSize: 13, fontWeight: "600", color: Z.text, lineHeight: 19 },
  preview: { marginTop: 6, fontSize: 12, color: Z.sub, lineHeight: 17 },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: "600", color: Z.sub },
  chipJoined: { backgroundColor: "rgba(16,185,129,0.12)" },
  chipJoinedText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  joinBtn: {
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  joinBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  footer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  when: { fontSize: 11, color: Z.sub },
  adminRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  adminBtn: {
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminBtnDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(220,38,38,0.1)",
  },
  adminBtnText: { fontSize: 11, fontWeight: "700", color: Z.text },
});
