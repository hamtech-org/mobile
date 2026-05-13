import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AlarmClock,
  AlarmClockOff,
  Ban,
  AlertCircle,
  BarChart2,
  Check,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  MapPin,
  Pencil,
  Pin,
  Phone,
  Trash2,
  Users,
  Video,
} from "lucide-react-native";

import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatFileSize } from "@/utils/file";
import {
  formatChatPreviewLine,
  getMessageTypeLabel,
  mapsUrlForLatLng,
  parseLocationPayload,
} from "@/utils/messageDisplay";
import {
  buildSystemBubbleView,
  isCenterPositionMessage,
  type SystemTextRowIcon,
} from "@/utils/systemMessage";
import {
  formatChatFrameDate,
  formatGroupBubbleFooterTime,
  formatTimestamp,
  isSameCalendarMinute,
  isSameDay,
} from "@/utils/time";
import { toast } from "@/utils/appToast";
import { TaskDeadlineChipMobile } from "@/utils/taskDeadlineDisplay";
import { isTaskJoinDeadlinePassed } from "@/utils/taskJoin";
import { normalizeMediaUrl } from "@/utils/url";

/** Dữ liệu nhóm để card giao việc / nút bình chọn (chỉ khi `isGroup`). */
export interface ChatBubbleGroupExtras {
  conversationId: string;
  currentUserId: string;
  /** Map tên hiển thị — giống web `groupMembers` + `byId`. */
  groupMembers?: { userId: string; displayName: string }[];
  groupTasks: {
    taskId?: string;
    creatorId?: string;
    participants?: string[];
    assignees?: string[];
    assignToAll?: boolean;
    broadcast?: boolean;
    dueDate?: string;
    subtasks?: { assigneeId?: string; content?: string; done?: boolean }[];
  }[];
  /** Optional backend call. For local-only demo, this can be a no-op. */
  joinTask?: (taskId: string) => Promise<void>;
  onTaskJoined?: (taskId: string) => void;
  onOpenPollVote: (pollId: string) => void;
  /** Chỉ người tạo task — mở modal nhóm + editor (giống web). */
  onEditGroupTask?: (taskId: string) => void;
  onDeleteGroupTask?: (taskId: string) => void;
}

interface ChatBubbleProps {
  message: IMessage;
  isOwn: boolean;
  /** User đang xem — dùng cho system JSON (ai là "Bạn"). */
  viewerUserId?: string | null;
  /** Có phải tin nhắn trong group không — để hiện sender name */
  isGroup?: boolean;
  /** Tin nhắn trước đó (để quyết định hiện sender name / date separator) */
  prevMessage?: IMessage;
  /** Tin nhắn sau (để quyết định hiện timestamp) */
  nextMessage?: IMessage;
  /** Callback khi long-press để mở action sheet */
  onLongPress?: (message: IMessage) => void;
  /** Callback khi nhấn vào reply-to để scroll đến tin gốc */
  onPressReplyTo?: (messageId: string) => void;
  /** Thông tin nhóm: join task, mở poll (tuỳ chọn) */
  groupExtras?: ChatBubbleGroupExtras;
}

// ── Call Log Message ────────────────────────────────────────────────────

function CallLogMessage({
  message,
  isOwn,
  showTimestampFooter,
  calendarNow,
}: {
  message: IMessage;
  isOwn: boolean;
  showTimestampFooter?: boolean;
  calendarNow?: Date;
}) {
  const { primary } = useIconColors();
  let kind = "completed";
  let callType = "audio";
  let durationSec = 0;

  try {
    const obj = JSON.parse(message.content) as Record<string, unknown>;
    kind = String(obj?.kind ?? "completed");
    callType = String(obj?.callType ?? "audio");
    durationSec = Number(obj?.durationSec ?? 0);
  } catch {
    // ignore
  }

  const title =
    kind === "missed"
      ? "Cuộc gọi nhỡ"
      : kind === "rejected"
        ? "Cuộc gọi bị từ chối"
        : kind === "cancelled" && isOwn
          ? callType === "video"
            ? "Bạn đã hủy cuộc gọi video"
            : "Bạn đã hủy cuộc gọi thoại"
          : kind === "cancelled" && !isOwn
            ? "Cuộc gọi nhỡ"
            : callType === "video"
              ? "Cuộc gọi video"
              : "Cuộc gọi thoại";

  const durationLabel =
    kind === "missed" || kind === "rejected" || kind === "cancelled"
      ? ""
      : durationSec > 0
        ? `${Math.floor(durationSec / 60)} phút ${durationSec % 60} giây`
        : "";

  const IconComponent = callType === "video" ? Video : Phone;
  const iconColor = kind === "missed" || (kind === "cancelled" && !isOwn) ? "#ef4444" : primary;

  const now = calendarNow ?? new Date();
  const footerTime =
    showTimestampFooter && message.createdAt
      ? formatGroupBubbleFooterTime(message.createdAt, now)
      : "";

  return (
    <View className={`my-3 px-4 ${isOwn ? "items-end" : "items-start"}`}>
      <View
        className={`min-w-[220px] max-w-[85%] items-center rounded-2xl border border-border/30 bg-muted/40 px-5 py-3 ${
          isOwn ? "self-end" : "self-start"
        }`}
      >
        <View className="mb-1 flex-row items-center gap-2">
          <IconComponent size={16} color={iconColor} strokeWidth={1.5} />
          <Text className="text-sm font-bold text-foreground">{title}</Text>
        </View>
        {durationLabel ? (
          <Text className="text-xs text-muted-foreground">{durationLabel}</Text>
        ) : null}
      </View>
      {footerTime ? (
        <View className={`mt-0.5 px-1 ${isOwn ? "self-end" : "self-start"}`}>
          <Text className="text-[11px] text-muted-foreground">{footerTime}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Pill giờ phía trên thẻ system — giờ (HH:mm) + ngày DD/MM/YYYY (không «Hôm nay»). */
function SystemNotifyTimePill({
  createdAt,
  prevMessage,
}: {
  createdAt?: string | null;
  prevMessage?: IMessage;
}) {
  const iso = createdAt?.trim();
  if (!iso) return null;
  const currDate = iso.slice(0, 10);
  const prevDate = prevMessage?.createdAt?.trim().slice(0, 10);
  const showDate = !prevMessage || prevDate !== currDate;
  const timeLabel = formatTimestamp(iso);
  const datePart = showDate ? formatChatFrameDate(iso) : "";
  const label = (showDate && datePart ? `${timeLabel} · ${datePart}` : timeLabel).trim();
  if (!label) return null;
  return (
    <View className="mb-2 self-center rounded-full bg-black/10 px-3 py-1 dark:bg-white/10">
      <Text className="text-[11px] font-semibold text-muted-foreground" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function SystemRowLeadingIcon({ kind }: { kind: SystemTextRowIcon }) {
  switch (kind) {
    case "pencil":
      return <Pencil size={16} color="#60a5fa" strokeWidth={2} />;
    case "pin":
      return <Pin size={16} color="#3b82f6" strokeWidth={2} />;
    case "checkCheck":
      return <CheckCheck size={16} color="#16a34a" strokeWidth={2} />;
    case "alarmClock":
      return <AlarmClock size={16} color="#f97316" strokeWidth={2} />;
    case "alarmOff":
      return <AlarmClockOff size={16} color="#737373" strokeWidth={1.75} />;
    case "barChartBlue":
      return <BarChart2 size={16} color="#2563eb" strokeWidth={2} />;
    case "barChartOrange":
      return <BarChart2 size={16} color="#f97316" strokeWidth={2} />;
    case "barChartMuted":
      return <BarChart2 size={16} color="#737373" strokeWidth={2} />;
    default:
      return <Pencil size={16} color="#60a5fa" strokeWidth={2} />;
  }
}

// ── System center (JSON + card) ───────────────────────────────────────────

function SystemCenterBlock({
  message,
  isOwn,
  viewerUserId,
  groupExtras,
  calendarNow,
  prevMessage,
}: {
  message: IMessage;
  isOwn: boolean;
  viewerUserId?: string | null;
  groupExtras?: ChatBubbleGroupExtras;
  calendarNow: Date;
  prevMessage?: IMessage;
}) {
  const { muted } = useIconColors();
  // Re-render periodically so deadline highlight updates in realtime.
  const [, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (taskId?: string | null) => {
    const id = String(taskId ?? "").trim();
    if (!id) return;
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const view = useMemo(
    () =>
      buildSystemBubbleView(message, {
        isOwn,
        currentUserId: viewerUserId ?? groupExtras?.currentUserId,
      }),
    [message, isOwn, viewerUserId, groupExtras?.currentUserId],
  );

  const [joinBusy, setJoinBusy] = useState(false);

  if (view.variant === "text") {
    const rowIcon: SystemTextRowIcon = view.rowIcon ?? "pencil";
    return (
      <View className="my-3 w-full items-center px-4">
        <SystemNotifyTimePill createdAt={message.createdAt} prevMessage={prevMessage} />
        <View className="w-full max-w-[92%] flex-row flex-wrap items-center justify-center gap-2 rounded-2xl border border-black/[0.06] bg-card px-3 py-2.5 shadow-sm dark:border-white/10">
          <View className="shrink-0 pt-0.5">
            <SystemRowLeadingIcon kind={rowIcon} />
          </View>
          <Text className="max-w-[90%] text-center text-[12px] font-medium leading-[18px] text-[#666666] dark:text-zinc-300">
            {view.text}
          </Text>
        </View>
      </View>
    );
  }

  if (view.variant === "poll_created_row") {
    const showVoteCta = Boolean(view.pollId && groupExtras?.onOpenPollVote);
    return (
      <View className="my-3 w-full items-center px-4">
        <SystemNotifyTimePill createdAt={message.createdAt} prevMessage={prevMessage} />
        <View className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-black/[0.06] bg-card px-3 py-2.5 shadow-sm dark:border-white/10">
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <BarChart2 size={16} color="#f97316" strokeWidth={2} />
            <Text className="min-w-[120px] flex-1 text-center text-[12px] font-medium leading-[18px] text-[#666666] dark:text-zinc-300">
              {view.actorLabel} đã tạo một bình chọn{view.question ? `: ${view.question}` : ""}
            </Text>
            {showVoteCta ? (
              <Pressable
                onPress={() => groupExtras!.onOpenPollVote(view.pollId)}
                className="rounded-full bg-orange-500 px-3 py-1.5"
              >
                <Text className="text-[11px] font-bold text-white">Bình chọn</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const t = (groupExtras?.groupTasks ?? []).find((x) => String(x.taskId ?? "") === view.taskId);
  const tx = t as Record<string, unknown> | undefined;
  const byId = new Map<string, string>();
  for (const row of groupExtras?.groupMembers ?? []) {
    byId.set(String(row.userId), String(row.displayName ?? row.userId).trim());
  }

  const boardAssignees = Array.isArray(tx?.assignees) ? (tx.assignees as string[]) : [];
  const boardSubs = Array.isArray(tx?.subtasks)
    ? (tx.subtasks as { assigneeId?: string; done?: boolean }[])
    : [];
  const subAssigneeIds = Array.from(
    new Set(boardSubs.map((s) => String(s?.assigneeId ?? "").trim()).filter(Boolean)),
  );
  const topIds = boardAssignees.map(String);
  const labelRaw = String(view.assigneeLabel ?? "");
  const labelNorm = labelRaw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const labelLooksLikeGroup =
    labelNorm.includes("ca nhom") || labelNorm.includes("group") || labelNorm.includes("all");

  const participants = Array.isArray(t?.participants) ? (t.participants as string[]) : [];
  const joined = groupExtras ? participants.includes(groupExtras.currentUserId) : false;
  const uid = groupExtras?.currentUserId ?? "";
  const isSubtaskAssignee = uid ? subAssigneeIds.includes(String(uid)) : false;
  const isTopLevelAssignee = uid ? topIds.map(String).includes(String(uid)) : false;
  const explicitAssignToAll = Boolean((t as any)?.assignToAll) || Boolean((t as any)?.broadcast);
  const hasTopLevelAssignees = topIds.length > 0;
  const hasSubtasksAssignees = subAssigneeIds.length > 0;
  const canJoinThisTask = Boolean(groupExtras)
    ? hasSubtasksAssignees
      ? isSubtaskAssignee
      : explicitAssignToAll ||
        (!hasTopLevelAssignees && !hasSubtasksAssignees && labelLooksLikeGroup) ||
        (!hasTopLevelAssignees && !hasSubtasksAssignees) ||
        isTopLevelAssignee
    : false;

  const dueForJoin =
    tx?.dueDate != null && String(tx.dueDate).trim() !== ""
      ? String(tx.dueDate)
      : (view.dueDate ?? "");
  const joinDeadlinePassed = isTaskJoinDeadlinePassed(dueForJoin || undefined);

  let assigneeDisplay = "—";
  if (explicitAssignToAll) assigneeDisplay = "Cả nhóm";
  else {
    const ids = hasSubtasksAssignees ? subAssigneeIds : topIds;
    if (ids.length > 0)
      assigneeDisplay = ids.map((id) => byId.get(String(id)) ?? String(id)).join(", ");
    else assigneeDisplay = view.assigneeLabel || "—";
  }

  const subtaskProgress =
    boardSubs.length === 0
      ? null
      : {
          done: boardSubs.filter((s) => s?.done).length,
          total: boardSubs.length,
          pct: Math.round((boardSubs.filter((s) => s?.done).length / boardSubs.length) * 100),
        };

  const creatorId =
    tx?.creatorId != null && String(tx.creatorId).trim() !== "" ? String(tx.creatorId).trim() : "";
  const isTaskCreator = Boolean(
    groupExtras && creatorId && creatorId === groupExtras.currentUserId,
  );
  const showTaskCreatorActions =
    isTaskCreator && Boolean(groupExtras?.onEditGroupTask || groupExtras?.onDeleteGroupTask);

  const onJoin = async (): Promise<void> => {
    if (!groupExtras) return;
    // Local-first UX: update immediately, backend is optional.
    groupExtras.onTaskJoined?.(view.taskId);
    setJoinBusy(true);
    try {
      await groupExtras.joinTask?.(view.taskId);
      toast.success("Bạn đã tham gia công việc");
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { status?: number } };
      const status = err?.status ?? err?.data?.status;
      if (status === 403) toast.error("Bạn không được giao công việc này");
      else toast.error("Không thể tham gia công việc");
    } finally {
      setJoinBusy(false);
    }
  };

  const showJoin = !joined;

  return (
    <View className="my-3 w-full items-center px-4">
      <SystemNotifyTimePill createdAt={message.createdAt} prevMessage={prevMessage} />
      <View className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-sm dark:border-white/10">
        <View className="px-3 py-3">
          <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
            <ClipboardList size={14} color="#4F46E5" strokeWidth={2} />
            <Text className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {view.actorLabel} đã giao việc
            </Text>
          </View>

          {(() => {
            const expanded = expandedTaskIds.has(String(view.taskId ?? ""));
            const long = (view.title?.length ?? 0) > 60;
            return (
              <>
                <Pressable onPress={() => long && toggleExpanded(view.taskId)}>
                  <Text
                    className="mb-3 pr-1 text-center text-[16px] font-black leading-snug text-foreground"
                    numberOfLines={expanded || !long ? undefined : 3}
                  >
                    {view.title}
                  </Text>
                </Pressable>
                {long ? (
                  <Pressable
                    onPress={() => toggleExpanded(view.taskId)}
                    className="mb-2 self-center rounded-full bg-primary/10 px-3 py-1"
                  >
                    <Text className="text-[11px] font-bold text-primary">
                      {expanded ? "Thu gọn tiêu đề" : "Xem thêm tiêu đề"}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            );
          })()}

          <View className="gap-2.5">
            <View className="flex-row items-start gap-2.5">
              <View className="pt-0.5">
                <Users size={16} color={muted} strokeWidth={2} />
              </View>
              <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1">
                <Text className="text-[13px] font-semibold text-muted-foreground">Giao cho: </Text>
                <Text className="text-[13px] font-bold text-foreground" numberOfLines={3}>
                  {assigneeDisplay}
                </Text>
              </View>
            </View>
            {dueForJoin.trim() ? (
              <View className="flex-row items-start gap-2.5">
                <View className="pt-0.5">
                  <AlarmClock size={16} color={muted} strokeWidth={2} />
                </View>
                <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-[13px] font-semibold text-muted-foreground">
                    Hạn chót:{" "}
                  </Text>
                  <TaskDeadlineChipMobile dateIso={dueForJoin} compact />
                </View>
              </View>
            ) : null}
          </View>

          {subtaskProgress ? (
            <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-border/60 bg-muted/25 p-2.5">
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${subtaskProgress.pct}%`,
                    backgroundColor: subtaskProgress.pct === 100 ? "#10B981" : "#6366F1",
                  }}
                />
              </View>
              <Text className="text-[12px] font-bold text-muted-foreground">
                {subtaskProgress.done}/{subtaskProgress.total} mục
              </Text>
            </View>
          ) : null}

          {view.note
            ? (() => {
                const expanded = expandedTaskIds.has(String(view.taskId ?? ""));
                const long = (view.note?.length ?? 0) > 90;
                return (
                  <View className="mt-2 px-1">
                    <Pressable onPress={() => long && toggleExpanded(view.taskId)}>
                      <Text
                        className="text-center text-[12px] text-muted-foreground"
                        numberOfLines={expanded || !long ? undefined : 2}
                      >
                        <Text className="font-semibold">Ghi chú:</Text> {view.note}
                      </Text>
                    </Pressable>
                    {long ? (
                      <Pressable
                        onPress={() => toggleExpanded(view.taskId)}
                        className="mt-1 self-center rounded-full bg-primary/10 px-3 py-1"
                      >
                        <Text className="text-[11px] font-bold text-primary">
                          {expanded ? "Thu gọn ghi chú" : "Xem thêm ghi chú"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })()
            : null}
        </View>

        {groupExtras ? (
          <View className="flex-row flex-wrap items-center justify-between gap-3 border-t border-black/5 px-3 py-3 dark:border-white/10">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
              <View className="flex-row items-center gap-1.5 rounded-full border border-black/5 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-zinc-800">
                <Text className="text-[11px] font-bold text-muted-foreground">
                  {participants.length > 0 ? `${participants.length} đã tham gia` : "Chưa có ai"}
                </Text>
              </View>
              {joined ? (
                <View className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Đã tham gia
                  </Text>
                </View>
              ) : joinDeadlinePassed ? (
                <View className="rounded-full border border-black/5 bg-black/5 px-3 py-1.5 dark:border-white/10 dark:bg-white/10">
                  <Text className="text-[11px] font-bold text-muted-foreground">Chưa tham gia</Text>
                </View>
              ) : showJoin ? (
                <Pressable
                  onPress={() => void onJoin()}
                  disabled={!canJoinThisTask || joinBusy}
                  className={
                    !canJoinThisTask
                      ? "rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10"
                      : "rounded-full bg-emerald-500 px-3 py-1.5"
                  }
                >
                  {joinBusy ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text
                      className={`text-[11px] font-bold ${!canJoinThisTask ? "text-muted-foreground" : "text-white"}`}
                    >
                      Xác nhận tham gia
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            {showTaskCreatorActions ? (
              <View className="flex-row flex-wrap items-center justify-end gap-2">
                {groupExtras.onEditGroupTask ? (
                  <Pressable
                    onPress={() => groupExtras.onEditGroupTask?.(view.taskId)}
                    className="flex-row items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1.5 dark:border-white/15 dark:bg-zinc-800"
                  >
                    <Pencil size={13} color={muted} strokeWidth={2} />
                    <Text className="text-[11px] font-bold text-foreground">Sửa</Text>
                  </Pressable>
                ) : null}
                {groupExtras.onDeleteGroupTask ? (
                  <Pressable
                    onPress={() => groupExtras.onDeleteGroupTask?.(view.taskId)}
                    className="flex-row items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-500/30 dark:bg-red-500/15"
                  >
                    <Trash2 size={13} color="#DC2626" strokeWidth={2} />
                    <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">
                      Hủy
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Reply-To Preview ────────────────────────────────────────────────────

function ReplyToPreview({
  message,
  isOwn,
  viewerUserId,
  onPress,
}: {
  message: IMessage;
  isOwn: boolean;
  viewerUserId?: string | null;
  onPress?: () => void;
}) {
  if (!message.replyToDetails) return null;

  const reply = message.replyToDetails;
  const previewContent = formatChatPreviewLine(
    {
      type: reply.type,
      content: reply.content ?? "",
      senderId: reply.senderId,
      senderDisplayName: reply.senderDisplayName,
      isRecalled: false,
    },
    viewerUserId ?? "",
  );

  return (
    <Pressable
      onPress={onPress}
      className={`mb-1.5 rounded-lg border-l-[3px] px-2.5 py-1.5 ${isOwn ? "border-white/40 bg-white/15" : "border-primary/50 bg-black/5"}`}
    >
      <Text
        className={`mb-0.5 text-[10px] font-bold ${isOwn ? "text-white/80" : "text-primary"}`}
        numberOfLines={1}
      >
        {reply.senderDisplayName ?? reply.senderId}
      </Text>
      <Text
        className={`text-[11px] ${isOwn ? "text-white/60" : "text-muted-foreground"}`}
        numberOfLines={1}
      >
        {previewContent}
      </Text>
    </Pressable>
  );
}

// ── Reactions Row ───────────────────────────────────────────────────────

function ReactionsRow({
  reactions,
  isOwn,
}: {
  reactions: Record<string, string[]>;
  isOwn: boolean;
}) {
  const entries = Object.entries(reactions);
  if (entries.length === 0) return null;

  return (
    <View className={`mt-0.5 flex-row flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, userIds]) => (
        <View
          key={emoji}
          className="flex-row items-center gap-0.5 rounded-full border border-border/30 bg-card px-1.5 py-0.5"
        >
          <Text className="text-[13px]">{emoji}</Text>
          {userIds.length > 1 && (
            <Text className="text-[10px] font-semibold text-muted-foreground">
              {userIds.length}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function parseTitleBodyJson(content: string): { title: string; body?: string } | null {
  const t = content.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const title = String(o.title ?? o.question ?? o.name ?? "").trim();
    if (!title) return null;
    const body = [o.description, o.note, o.location]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .find(Boolean);
    return { title, body: body || undefined };
  } catch {
    return null;
  }
}

// ── Main ChatBubble ─────────────────────────────────────────────────────

export const ChatBubble = ({
  message,
  isOwn,
  viewerUserId,
  isGroup = false,
  prevMessage,
  nextMessage,
  onLongPress,
  onPressReplyTo,
  groupExtras,
}: ChatBubbleProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const { muted, primary } = useIconColors();
  const calendarNow = useCalendarNow();
  const isRecalled = Boolean(message.isRecalled);
  const isDeleted = Boolean(message.isDeleted);

  /** Luôn qua format preview — không render JSON thô trong bubble chữ. */
  const captionPlainText = useMemo(
    () =>
      formatChatPreviewLine(
        {
          type: message.type,
          content: message.content ?? "",
          senderId: message.senderId,
          senderDisplayName: message.senderDisplayName,
          isRecalled: Boolean(message.isRecalled),
        },
        viewerUserId ?? "",
      ),
    [
      message.type,
      message.content,
      message.senderId,
      message.senderDisplayName,
      message.isRecalled,
      viewerUserId,
    ],
  );

  const showDateSeparator = !prevMessage || !isSameDay(prevMessage.createdAt, message.createdAt);

  if (message.type === "system" || isCenterPositionMessage(message)) {
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} />}
        <SystemCenterBlock
          message={message}
          isOwn={isOwn}
          viewerUserId={viewerUserId}
          groupExtras={isGroup ? groupExtras : undefined}
          calendarNow={calendarNow}
          prevMessage={prevMessage}
        />
      </>
    );
  }

  if (message.type === "call") {
    const isSameMinuteAsNextCall =
      !!nextMessage && isSameCalendarMinute(message.createdAt, nextMessage.createdAt);
    const showCallTimestampFooter = Boolean(isGroup && !isSameMinuteAsNextCall);
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} />}
        <CallLogMessage
          message={message}
          isOwn={isOwn}
          showTimestampFooter={showCallTimestampFooter}
          calendarNow={calendarNow}
        />
      </>
    );
  }

  const isSameSenderAsPrev =
    !!prevMessage &&
    prevMessage.senderId === message.senderId &&
    isSameDay(prevMessage.createdAt, message.createdAt);
  const isSameSenderAsNext =
    !!nextMessage &&
    nextMessage.senderId === message.senderId &&
    isSameDay(nextMessage.createdAt, message.createdAt);
  const showSenderName = !isOwn && isGroup && !isSameSenderAsPrev;
  const isSameMinuteAsNext =
    !!nextMessage && isSameCalendarMinute(message.createdAt, nextMessage.createdAt);
  /** Nhóm: một dòng giờ/ngày cho cả phút — chỉ tin cuối trong cùng phút lịch; 1-1: tin cuối chuỗi cùng người gửi (cùng ngày). */
  const showTimestamp = isGroup ? !isSameMinuteAsNext : !isSameSenderAsNext;

  const rawMedia = message.mediaUrl?.trim();
  const isLocalMedia = Boolean(
    rawMedia && (rawMedia.startsWith("file:") || rawMedia.startsWith("content:")),
  );
  const hasImage = message.type === "image" && rawMedia;
  const hasSticker = message.type === "sticker" && rawMedia;
  /** Video: cần `mediaUrl` (hoặc URI local lúc gửi) — RN `Image` không hiển thị MP4. */
  const hasVideo = message.type === "video" && Boolean((rawMedia ?? "").trim());
  const hasFile = message.type === "file" && (rawMedia || isLocalMedia);
  const hasCaption = (message.content ?? "").trim().length > 0;
  const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;

  const fileMetaSubline = [
    message.mediaSize != null && message.mediaSize > 0 ? formatFileSize(message.mediaSize) : "",
    message.mediaType?.includes("/")
      ? (message.mediaType.split("/").pop() ?? "").toUpperCase()
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const isVisualMedia = Boolean(hasImage || hasVideo || hasSticker);
  const parsedLocation =
    message.type === "location" ? parseLocationPayload(message.content ?? "") : null;
  const hasLocationBlock = message.type === "location" && (parsedLocation !== null || hasCaption);
  const structuredPollSchedule =
    message.type === "poll" || message.type === "schedule"
      ? parseTitleBodyJson(message.content ?? "")
      : null;
  const hasPollScheduleBlock =
    (message.type === "poll" || message.type === "schedule") &&
    (structuredPollSchedule !== null || hasCaption);

  const isEmojiMessage = message.type === "emoji";
  const fallbackLabel = getMessageTypeLabel(message.type);

  const hasRenderableSpecial =
    isVisualMedia ||
    hasFile ||
    hasLocationBlock ||
    hasPollScheduleBlock ||
    (isEmojiMessage && (hasCaption || Boolean(fallbackLabel)));

  const plainTextFallback = !hasRenderableSpecial && !hasCaption ? fallbackLabel || "Tin nhắn" : "";

  /** Bubble file kiểu Zalo: thẻ ngang rộng ~82% màn hình (tối đa ~360pt). */
  const fileBubbleMinWidth = Math.max(248, Math.min(Math.round(windowWidth * 0.82), 360));
  const widenFileBubble = hasFile;

  return (
    <>
      {showDateSeparator && <DateSeparator date={message.createdAt} />}

      <View
        className={`w-full ${isSameSenderAsPrev ? "mt-0.5" : "mt-2"} ${isOwn ? "items-end" : "items-start"}`}
      >
        {showSenderName && message.senderDisplayName ? (
          <Text className="mb-1 ml-2 text-[11px] font-semibold text-primary">
            {message.senderDisplayName}
          </Text>
        ) : null}

        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={300}
          className={
            isOwn
              ? `${widenFileBubble ? "max-w-[92%]" : "max-w-[78%]"} min-w-0 self-end`
              : `${widenFileBubble ? "max-w-[92%]" : "max-w-[78%]"} min-w-0 self-start`
          }
        >
          {isDeleted || isRecalled ? (
            <View className="flex-row items-center gap-1.5 rounded-[20px] border border-dashed border-border/40 px-4 py-2.5 opacity-60">
              <Ban size={13} color={muted} strokeWidth={1.5} />
              <Text className="text-sm italic text-muted-foreground">
                {isDeleted ? "Tin nhắn đã bị xóa" : "Tin nhắn đã được thu hồi"}
              </Text>
            </View>
          ) : (
            <View className="max-w-full">
              <View
                className={[
                  "max-w-full",
                  isVisualMedia ? "overflow-hidden rounded-2xl" : "",
                  !isVisualMedia
                    ? `${hasFile ? "px-2 py-2" : "px-4 py-2.5"} ${isOwn ? "rounded-[20px] rounded-br-[5px] bg-primary" : "rounded-[20px] rounded-bl-[5px] bg-card"}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ReplyToPreview
                  message={message}
                  isOwn={isOwn && !isVisualMedia}
                  viewerUserId={viewerUserId}
                  onPress={() => onPressReplyTo?.(message.replyToDetails!.messageId)}
                />

                {hasImage && (
                  <Image
                    source={{
                      uri: isLocalMedia
                        ? rawMedia!
                        : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) ?? ""),
                    }}
                    className="aspect-[4/3] w-full rounded-2xl"
                    resizeMode="cover"
                  />
                )}

                {hasSticker && (
                  <Image
                    source={{
                      uri: isLocalMedia
                        ? rawMedia!
                        : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) ?? ""),
                    }}
                    className="h-[168px] w-[168px] self-center rounded-2xl"
                    resizeMode="contain"
                  />
                )}

                {hasVideo && (
                  <View className="w-full overflow-hidden rounded-2xl bg-black">
                    <ChatBubbleVideo
                      key={`${message.messageId}-${isLocalMedia ? rawMedia : (normalizeMediaUrl(message.mediaUrl) ?? "")}`}
                      playUri={
                        isLocalMedia
                          ? (rawMedia ?? "").trim()
                          : (normalizeMediaUrl(message.mediaUrl) ?? "").trim()
                      }
                    />
                  </View>
                )}

                {hasFile && (
                  <View
                    className="w-full flex-row items-center gap-3 rounded-xl border border-border/25 bg-white px-3.5 py-3"
                    style={{ minWidth: fileBubbleMinWidth }}
                  >
                    <View className="h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText size={24} color={primary} strokeWidth={2} />
                    </View>
                    <View className="min-w-0 flex-1 pr-1">
                      <Text
                        className="text-[15px] font-semibold leading-5 text-foreground"
                        numberOfLines={2}
                      >
                        {message.mediaOriginalName?.trim() || "File đính kèm"}
                      </Text>
                      {fileMetaSubline ? (
                        <Text className="mt-1 text-[12px] text-muted-foreground" numberOfLines={1}>
                          {fileMetaSubline}
                        </Text>
                      ) : null}
                    </View>
                    <ChevronRight size={20} color={muted} strokeWidth={2} />
                  </View>
                )}

                {message.type === "location" && parsedLocation ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(mapsUrlForLatLng(parsedLocation.lat, parsedLocation.lng))
                    }
                    className={`flex-row items-center gap-2 rounded-xl px-3 py-2 ${isOwn ? "bg-white/15" : "bg-muted/50"}`}
                  >
                    <MapPin
                      size={20}
                      color={isOwn ? "rgba(255,255,255,0.85)" : primary}
                      strokeWidth={2}
                    />
                    <View className="min-w-0 flex-1">
                      <Text
                        className={`text-[13px] font-semibold ${isOwn ? "text-white" : "text-foreground"}`}
                        numberOfLines={2}
                      >
                        {parsedLocation.title}
                      </Text>
                      <Text
                        className={`mt-0.5 text-[11px] ${isOwn ? "text-white/70" : "text-primary"}`}
                      >
                        Mở bản đồ
                      </Text>
                    </View>
                  </Pressable>
                ) : null}

                {(message.type === "poll" || message.type === "schedule") &&
                structuredPollSchedule ? (
                  <View
                    className={
                      isOwn
                        ? "rounded-lg bg-white/10 px-2 py-1"
                        : "rounded-lg bg-muted/40 px-2 py-1"
                    }
                  >
                    <Text
                      className={`text-[13px] font-bold ${isOwn ? "text-white" : "text-foreground"}`}
                    >
                      {structuredPollSchedule.title}
                    </Text>
                    {structuredPollSchedule.body ? (
                      <Text
                        className={`mt-1 text-[12px] ${isOwn ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        {structuredPollSchedule.body}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {isEmojiMessage && hasCaption ? (
                  <View className={isVisualMedia ? "px-3 py-2" : ""}>
                    <Text
                      className={`text-[34px] leading-[42px] ${isOwn ? "text-white" : "text-foreground"}`}
                    >
                      {captionPlainText}
                    </Text>
                  </View>
                ) : null}

                {!isEmojiMessage && hasCaption && (
                  <View className={isVisualMedia || hasFile ? "px-3 py-2" : ""}>
                    <Text
                      className={`text-[15px] leading-[22px] ${isOwn && !isVisualMedia ? "text-white" : "text-foreground"}`}
                    >
                      {captionPlainText}
                    </Text>
                  </View>
                )}

                {plainTextFallback ? (
                  <Text
                    className={`text-[14px] ${isOwn ? "text-white/90" : "text-muted-foreground"}`}
                  >
                    {plainTextFallback}
                  </Text>
                ) : null}

                {isEmojiMessage && !hasCaption && fallbackLabel ? (
                  <Text
                    className={`text-[15px] ${isOwn ? "text-white/80" : "text-muted-foreground"}`}
                  >
                    {fallbackLabel}
                  </Text>
                ) : null}

                {message.isEdited && (
                  <Text
                    className={`mt-0.5 text-[10px] ${isOwn && !isVisualMedia ? "text-white/50" : "text-muted-foreground/60"}`}
                  >
                    (đã sửa)
                  </Text>
                )}
              </View>

              {hasReactions && <ReactionsRow reactions={message.reactions} isOwn={isOwn} />}
            </View>
          )}
        </Pressable>

        {showTimestamp && (
          <View
            className={`mt-0.5 flex-row items-center gap-1 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
          >
            <Text className="text-[11px] text-muted-foreground">
              {isGroup
                ? formatGroupBubbleFooterTime(message.createdAt, calendarNow)
                : formatTimestamp(message.createdAt)}
            </Text>
            {isOwn && !isRecalled && !isDeleted && (
              <StatusIcon status={message.status} primary={primary} muted={muted} />
            )}
          </View>
        )}
      </View>
    </>
  );
};

/** Phát MP4/HLS trong bubble — `Image` không hiển thị được khung hình từ URL video. */
function ChatBubbleVideo({ playUri }: { playUri: string }) {
  if (!playUri) {
    return (
      <View className="aspect-video w-full items-center justify-center bg-muted px-4">
        <Text className="text-center text-sm text-muted-foreground">Không có đường dẫn video</Text>
      </View>
    );
  }
  return <ChatBubbleVideoPlayer playUri={playUri} />;
}
function ChatBubbleVideoPlayer({ playUri }: { playUri: string }) {
  const player = useVideoPlayer(playUri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", minHeight: 200, aspectRatio: 16 / 9 }}
      contentFit="contain"
      nativeControls
      accessibilityLabel="Video trong tin nhắn"
    />
  );
}

function DateSeparator({ date }: { date: string }) {
  return (
    <View className="my-3 items-center">
      <View className="rounded-full bg-muted/50 px-3 py-1">
        <Text className="text-[11px] font-medium text-muted-foreground">
          {formatChatFrameDate(date)}
        </Text>
      </View>
    </View>
  );
}

function StatusIcon({
  status,
  primary,
  muted,
}: {
  status: string;
  primary: string;
  muted: string;
}) {
  if (status === "sending") {
    return <ActivityIndicator size={10} color={muted} />;
  }
  if (status === "failed") {
    return <AlertCircle size={12} color="#ef4444" strokeWidth={2} />;
  }
  if (status === "read") {
    return <CheckCheck size={12} color={primary} strokeWidth={2} />;
  }
  if (status === "delivered") {
    return <CheckCheck size={12} color={muted} strokeWidth={2} />;
  }
  return <Check size={12} color={muted} strokeWidth={2} />;
}
