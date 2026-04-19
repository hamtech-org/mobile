import type { IMessage } from "@/types/chat.types";

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
};
type SystemPoll = {
  pollId?: string;
  question?: string;
  optionText?: string;
};

export type SystemBubbleView =
  | { variant: "text"; text: string }
  | {
      variant: "task_assigned_card";
      taskId: string;
      title: string;
      actorLabel: string;
      assigneeLabel: string;
      dueDate: string | null;
      note: string | null;
    }
  | { variant: "poll_created_row"; pollId: string; question: string; actorLabel: string };

export interface SystemMessageFormatContext {
  isOwn: boolean;
  currentUserId?: string | null;
}

function replaceFirst(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  const idx = haystack.indexOf(needle);
  if (idx === -1) return haystack;
  return haystack.slice(0, idx) + replacement + haystack.slice(idx + needle.length);
}

/** Chuẩn bị nội dung system (không parse JSON): thay tên, case ảnh đại diện nhóm. */
export function preprocessSystemPlainText(message: IMessage, ctx: SystemMessageFormatContext): string {
  let text = message.content ?? "";

  if (ctx.isOwn && text.includes("đã cập nhật ảnh đại diện nhóm")) {
    text = "Bạn đã cập nhật ảnh đại diện nhóm";
  }

  if (ctx.isOwn && message.senderDisplayName) {
    const name = message.senderDisplayName.trim();
    if (name) text = replaceFirst(text, name, "Bạn");
  }

  return text;
}

function actorWho(
  actor: SystemActor | undefined,
  message: IMessage,
  ctx: SystemMessageFormatContext,
): string {
  const actorId = String(actor?.userId ?? message.senderId ?? "");
  const actorName = String(actor?.name ?? message.senderDisplayName ?? "Ai đó").trim() || "Ai đó";
  if (ctx.currentUserId && actorId && actorId === ctx.currentUserId) return "Bạn";
  return actorName;
}

/**
 * Parse JSON system message → view cho bubble (text / card giao việc / hàng poll tạo).
 */
export function buildSystemBubbleView(message: IMessage, ctx: SystemMessageFormatContext): SystemBubbleView {
  const baseText = preprocessSystemPlainText(message, ctx);
  const raw = baseText.trim();
  if (!raw.startsWith("{")) {
    return { variant: "text", text: baseText };
  }

  try {
    const obj = JSON.parse(raw) as {
      kind?: string;
      actor?: SystemActor;
      task?: SystemTask;
      poll?: SystemPoll;
    };
    const kind = String(obj?.kind ?? "");
    const who = actorWho(obj.actor, message, ctx);

    if (kind === "task_assigned" && obj.task?.title) {
      const taskId = String(obj.task.taskId ?? "").trim();
      const title = String(obj.task.title ?? "");
      if (!taskId) {
        return { variant: "text", text: `${who} đã giao việc: ${title}` };
      }
      return {
        variant: "task_assigned_card",
        taskId,
        title,
        actorLabel: who,
        assigneeLabel: String(obj.task.assigneeLabel ?? "cả nhóm"),
        dueDate: obj.task.dueDate ? String(obj.task.dueDate) : null,
        note: obj.task.note ? String(obj.task.note) : null,
      };
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
      const line = title ? `${who} đã tham gia công việc "${title}"` : `${who} đã tham gia công việc`;
      return { variant: "text", text: line };
    }
    if (kind === "poll_voted") {
      const line = opt ? `${who} đã bình chọn: ${opt}` : `${who} đã bình chọn`;
      return { variant: "text", text: line };
    }
    if (kind === "poll_vote_changed") {
      const line = opt ? `${who} đã thay đổi bình chọn: ${opt}` : `${who} đã thay đổi bình chọn`;
      return { variant: "text", text: line };
    }
    if (kind === "poll_unvoted") {
      const line = opt ? `${who} đã rút phiếu: ${opt}` : `${who} đã rút phiếu`;
      return { variant: "text", text: line };
    }
    if (kind === "poll_option_added") {
      const line = opt ? `${who} đã thêm lựa chọn: ${opt}` : `${who} đã thêm lựa chọn`;
      return { variant: "text", text: line };
    }
    if (kind === "poll_closed") {
      const line = q ? `${who} đã đóng bình chọn: ${q}` : `${who} đã đóng bình chọn`;
      return { variant: "text", text: line };
    }
  } catch {
    /* fallthrough */
  }

  return { variant: "text", text: baseText };
}

/** Preview một dòng cho danh sách hội thoại (lastMessage system + JSON). */
export function formatSystemLastMessagePreview(
  content: string,
  senderId: string,
  currentUserId: string,
  senderDisplayName?: string | null,
): string | null {
  const raw = (content ?? "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    const obj = JSON.parse(raw) as {
      kind?: string;
      actor?: SystemActor;
      task?: SystemTask;
      poll?: SystemPoll;
    };
    const kind = String(obj?.kind ?? "");
    const actorId = String(obj?.actor?.userId ?? senderId ?? "");
    const actorName = String(obj?.actor?.name ?? senderDisplayName ?? "Ai đó").trim() || "Ai đó";
    const who = currentUserId && actorId === currentUserId ? "Bạn" : actorName;

    if (kind === "task_joined") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${who} đã tham gia công việc "${title}"` : `${who} đã tham gia công việc`;
    }
    if (kind === "task_assigned") {
      const title = String(obj.task?.title ?? "").trim();
      return title ? `${who} đã giao việc "${title}"` : `${who} đã giao việc`;
    }
    if (kind === "poll_created") {
      const question = String(obj.poll?.question ?? "").trim();
      return question ? `${who} đã tạo một bình chọn: ${question}` : `${who} đã tạo một bình chọn`;
    }
    const opt = String(obj.poll?.optionText ?? "").trim();
    const q = String(obj.poll?.question ?? "").trim();
    if (kind === "poll_voted") return opt ? `${who} đã bình chọn: ${opt}` : `${who} đã bình chọn`;
    if (kind === "poll_vote_changed") return opt ? `${who} đã thay đổi bình chọn: ${opt}` : `${who} đã thay đổi bình chọn`;
    if (kind === "poll_unvoted") return opt ? `${who} đã rút phiếu: ${opt}` : `${who} đã rút phiếu`;
    if (kind === "poll_option_added") return opt ? `${who} đã thêm lựa chọn: ${opt}` : `${who} đã thêm lựa chọn`;
    if (kind === "poll_closed") return q ? `${who} đã đóng bình chọn: ${q}` : `${who} đã đóng bình chọn`;
  } catch {
    return null;
  }
  return null;
}
