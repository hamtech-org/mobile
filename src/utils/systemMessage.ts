import type { IMessage } from "@/types/chat.types";
import { resolveGroupSystemDisplayLine } from "@/utils/groupSystemMessage";
import { resolveTaskAssigneeDisplayLabel } from "@/utils/taskAssigneeLabel";

/** Tin hệ thống căn giữa (từ socket/API legacy). */
export function isCenterPositionMessage(message: IMessage): boolean {
  return message.position === "center";
}

type SystemActor = { userId?: string; name?: string };
type SystemTask = {
  taskId?: string;
  title?: string;
  dueDate?: string;
  note?: string;
  assigneeLabel?: string;
  assigneeUserIds?: string[];
  assignToAll?: boolean;
};
type SystemPoll = {
  pollId?: string;
  question?: string;
  optionText?: string;
};

/** Icon hàng thông báo giữa — đồng bộ web `ChatMessageList` (Pencil / Pin / PinOff / BarChart / …). */
export type SystemTextRowIcon =
  | "pencil"
  | "pin"
  | "pinOff"
  | "checkCheck"
  | "alarmClock"
  | "alarmOff"
  | "barChartBlue"
  | "barChartOrange"
  | "barChartMuted";

function systemRowIconForPlainText(text: string): SystemTextRowIcon {
  const t = (text ?? "").trim();
  if (t.includes("đã bỏ ghim")) return "pinOff";
  if (t.includes("đã ghim")) return "pin";
  return "pencil";
}

export type SystemBubbleView =
  | { variant: "text"; text: string; rowIcon?: SystemTextRowIcon }
  | {
      variant: "task_assigned_card";
      taskId: string;
      title: string;
      actorLabel: string;
      assigneeLabel: string;
      dueDate: string | null;
      note: string | null;
    }
  | {
      variant: "task_updated_row";
      actorLabel: string;
      title: string | null;
      taskId: string;
    }
  | { variant: "task_due_row"; title: string | null; taskId: string }
  | { variant: "poll_created_row"; pollId: string; question: string; actorLabel: string };

export interface SystemMessageFormatContext {
  isOwn: boolean;
  currentUserId?: string | null;
  /** Chỉ nhóm: hàng system có nút (đồng bộ web `ChatMessageList`). */
  isGroupChat?: boolean;
}

function replaceFirst(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

function viewerIsSender(message: IMessage, ctx: SystemMessageFormatContext): boolean {
  const uid = ctx.currentUserId?.trim();
  const sid = message.senderId?.trim();
  if (uid && sid && uid === sid) return true;
  return Boolean(ctx.isOwn);
}

/** Chuẩn bị nội dung system (không parse JSON): xưng «Bạn» theo actor.userId / senderId. */
export function preprocessSystemPlainText(
  message: IMessage,
  ctx: SystemMessageFormatContext,
): string {
  const groupLine = resolveGroupSystemDisplayLine(message.content ?? "", {
    senderId: message.senderId,
    currentUserId: ctx.currentUserId,
    senderDisplayName: message.senderDisplayName,
    isOwn: ctx.isOwn,
  });
  if (groupLine) return groupLine;

  let text = message.content ?? "";
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return text;
  return text.replace(/\bundefined\b/g, "Thành viên").replace(/\bnull\b/g, "Thành viên");
}

function actorWho(
  actor: SystemActor | undefined,
  message: IMessage,
  ctx: SystemMessageFormatContext,
): string {
  const actorId = String(actor?.userId ?? message.senderId ?? "");
  const actorNameRaw = String(actor?.name ?? "").trim();
  const senderFallback = String(message.senderDisplayName ?? "").trim();
  const actorName =
    actorNameRaw &&
    actorNameRaw.toLowerCase() !== "hệ thống" &&
    actorNameRaw.toLowerCase() !== "he thong"
      ? actorNameRaw
      : senderFallback || "Ai đó";
  if (ctx.currentUserId && actorId && actorId === ctx.currentUserId) return "Bạn";
  return actorName;
}

/**
 * Parse JSON system message → view cho bubble (text / card giao việc / hàng poll tạo).
 */
export function buildSystemBubbleView(
  message: IMessage,
  ctx: SystemMessageFormatContext,
): SystemBubbleView {
  const rawContent = (message.content ?? "").trim();
  const groupLine = resolveGroupSystemDisplayLine(rawContent, {
    senderId: message.senderId,
    currentUserId: ctx.currentUserId,
    senderDisplayName: message.senderDisplayName,
    isOwn: ctx.isOwn,
  });
  if (groupLine) {
    return { variant: "text", text: groupLine, rowIcon: systemRowIconForPlainText(groupLine) };
  }

  if (!rawContent.startsWith("{")) {
    const baseText = preprocessSystemPlainText(message, ctx);
    return { variant: "text", text: baseText, rowIcon: systemRowIconForPlainText(baseText) };
  }

  try {
    const obj = JSON.parse(rawContent) as {
      kind?: string;
      actor?: SystemActor;
      task?: SystemTask;
      poll?: SystemPoll;
      header?: { title?: string; emoji?: string };
    };
    const kind = String(obj?.kind ?? "");
    const who = actorWho(obj.actor, message, ctx);
    const isGroup = Boolean(ctx.isGroupChat);

    if (kind === "task_assigned" && obj.task?.title) {
      const taskId = String(obj.task.taskId ?? "").trim();
      const title = String(obj.task.title ?? "");
      if (!taskId) {
        return { variant: "text", text: `${who} đã giao việc: ${title}`, rowIcon: "pencil" };
      }
      const assigneeIds = Array.isArray(obj.task.assigneeUserIds)
        ? obj.task.assigneeUserIds.map((id) => String(id)).filter(Boolean)
        : [];
      const assigneeLabel = resolveTaskAssigneeDisplayLabel({
        assignToAll: obj.task.assignToAll === true,
        assigneeIds,
        memberCount: 0,
        nameById: new Map<string, string>(),
        fallbackLabel: String(obj.task.assigneeLabel ?? "cả nhóm"),
        currentUserId: ctx.currentUserId ?? undefined,
      });
      return {
        variant: "task_assigned_card",
        taskId,
        title,
        actorLabel: who,
        assigneeLabel,
        dueDate: obj.task.dueDate ? String(obj.task.dueDate) : null,
        note: obj.task.note ? String(obj.task.note) : null,
      };
    }

    if (kind === "task_updated") {
      const title = String(obj.task?.title ?? "").trim();
      const taskId = String(obj.task?.taskId ?? "").trim();
      if (isGroup) {
        return {
          variant: "task_updated_row",
          actorLabel: who,
          title: title || null,
          taskId,
        };
      }
      const line = title
        ? `${who} đã cập nhật công việc "${title}"`
        : `${who} đã cập nhật một công việc`;
      return { variant: "text", text: line, rowIcon: "pencil" };
    }
    if (kind === "task_deleted") {
      const title = String(obj.task?.title ?? "").trim();
      const line = title ? `${who} đã hủy công việc «${title}»` : `${who} đã hủy một công việc`;
      return { variant: "text", text: line, rowIcon: "alarmOff" };
    }
    if (kind === "task_due") {
      const title = String(obj.task?.title ?? "").trim();
      const taskId = String(obj.task?.taskId ?? "").trim();
      if (isGroup) {
        return {
          variant: "task_due_row",
          title: title || null,
          taskId,
        };
      }
      const line = title ? `Đến hạn: "${title}"` : "Đến hạn công việc";
      return { variant: "text", text: line, rowIcon: "alarmClock" };
    }

    if (kind === "task_reminder") {
      const ht = String(obj.header?.title ?? "Nhắc hạn").trim();
      const title = String(obj.task?.title ?? "").trim();
      const line = title ? `${ht}: «${title}»` : ht;
      return { variant: "text", text: line, rowIcon: "alarmClock" };
    }

    if (kind === "poll_created") {
      const pollId = String(obj.poll?.pollId ?? "").trim();
      const question = String(obj.poll?.question ?? "").trim();
      return { variant: "poll_created_row", pollId, question, actorLabel: who };
    }

    const opt = String(obj.poll?.optionText ?? "").trim();
    const q = String(obj.poll?.question ?? "").trim();

    if (kind === "task_joined") {
      const title = String(obj.task?.title ?? "").trim();
      const line = title
        ? `${who} đã tham gia công việc "${title}"`
        : `${who} đã tham gia công việc`;
      return { variant: "text", text: line, rowIcon: "checkCheck" };
    }
    if (kind === "poll_voted") {
      const line = opt ? `${who} đã bình chọn: ${opt}` : `${who} đã bình chọn`;
      return { variant: "text", text: line, rowIcon: "barChartBlue" };
    }
    if (kind === "poll_vote_changed") {
      const line = opt ? `${who} đã thay đổi bình chọn: ${opt}` : `${who} đã thay đổi bình chọn`;
      return { variant: "text", text: line, rowIcon: "barChartBlue" };
    }
    if (kind === "poll_unvoted") {
      const line = opt ? `${who} đã rút phiếu: ${opt}` : `${who} đã rút phiếu`;
      return { variant: "text", text: line, rowIcon: "barChartMuted" };
    }
    if (kind === "poll_option_added") {
      const line = opt ? `${who} đã thêm lựa chọn: ${opt}` : `${who} đã thêm lựa chọn`;
      return { variant: "text", text: line, rowIcon: "barChartOrange" };
    }
    if (kind === "poll_closed") {
      const line = q ? `${who} đã đóng bình chọn: ${q}` : `${who} đã đóng bình chọn`;
      return { variant: "text", text: line, rowIcon: "barChartMuted" };
    }

    const fallback =
      formatSystemLastMessagePreview(
        rawContent,
        message.senderId,
        ctx.currentUserId ?? "",
        message.senderDisplayName,
      ) ?? "Thông báo nhóm";
    return { variant: "text", text: fallback, rowIcon: systemRowIconForPlainText(fallback) };
  } catch {
    const fallback =
      formatSystemLastMessagePreview(
        rawContent,
        message.senderId,
        ctx.currentUserId ?? "",
        message.senderDisplayName,
      ) ?? "Thông báo nhóm";
    return { variant: "text", text: fallback, rowIcon: systemRowIconForPlainText(fallback) };
  }
}

/** Preview một dòng cho danh sách hội thoại (lastMessage system + JSON). */
export function formatSystemLastMessagePreview(
  content: string,
  senderId: string,
  currentUserId: string,
  senderDisplayName?: string | null,
): string | null {
  const raw = (content ?? "").trim();
  const groupLine = resolveGroupSystemDisplayLine(raw, {
    currentUserId,
    senderId,
    senderDisplayName,
  });
  if (groupLine) return groupLine;
  if (!raw.startsWith("{")) return null;
  try {
    const obj = JSON.parse(raw) as {
      kind?: string;
      actor?: SystemActor;
      task?: SystemTask;
      poll?: SystemPoll;
      header?: { title?: string; emoji?: string };
    };
    const kind = String(obj?.kind ?? "");
    const actorId = String(obj?.actor?.userId ?? senderId ?? "");
    const actorNameRaw = String(obj?.actor?.name ?? "").trim();
    const senderNameFallback = String(senderDisplayName ?? "").trim();
    const actorNameResolved =
      actorNameRaw &&
      actorNameRaw.toLowerCase() !== "hệ thống" &&
      actorNameRaw.toLowerCase() !== "he thong"
        ? actorNameRaw
        : senderNameFallback || "Ai đó";
    const who = currentUserId && actorId === currentUserId ? "Bạn" : actorNameResolved;

    if (kind === "task_joined") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${who} đã tham gia công việc "${title}"` : `${who} đã tham gia công việc`;
    }
    if (kind === "task_assigned") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${who} đã giao việc "${title}"` : `${who} đã giao việc`;
    }
    if (kind === "task_updated") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${who} đã cập nhật công việc "${title}"` : `${who} đã cập nhật một công việc`;
    }
    if (kind === "task_deleted") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${who} đã hủy công việc «${title}»` : `${who} đã hủy một công việc`;
    }
    if (kind === "task_due") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `Đến hạn: "${title}"` : "Đến hạn công việc";
    }
    if (kind === "task_reminder") {
      const ht = String(obj.header?.title ?? "Nhắc hạn").trim();
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${ht}: «${title}»` : ht;
    }
    if (kind === "poll_created") {
      const question = String(obj.poll?.question ?? "").trim();
      return question ? `${who} đã tạo một bình chọn: ${question}` : `${who} đã tạo một bình chọn`;
    }
    const opt = String(obj.poll?.optionText ?? "").trim();
    const q = String(obj.poll?.question ?? "").trim();
    if (kind === "poll_voted") return opt ? `${who} đã bình chọn: ${opt}` : `${who} đã bình chọn`;
    if (kind === "poll_vote_changed")
      return opt ? `${who} đã thay đổi bình chọn: ${opt}` : `${who} đã thay đổi bình chọn`;
    if (kind === "poll_unvoted") return opt ? `${who} đã rút phiếu: ${opt}` : `${who} đã rút phiếu`;
    if (kind === "poll_option_added")
      return opt ? `${who} đã thêm lựa chọn: ${opt}` : `${who} đã thêm lựa chọn`;
    if (kind === "poll_closed")
      return q ? `${who} đã đóng bình chọn: ${q}` : `${who} đã đóng bình chọn`;

    return "Thông báo nhóm";
  } catch {
    return null;
  }
}
