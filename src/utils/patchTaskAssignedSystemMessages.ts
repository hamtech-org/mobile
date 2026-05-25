import type { AppDispatch } from "@/store/store";
import { store } from "@/store/store";
import { CHAT_MESSAGES_QUERY_LIMIT } from "@/store/api/chatApi";
import { messageApi } from "@/store/api/endpoints/messageApi";
import { messageEdited } from "@/store/slices/chatSlice";

export type TaskAssignedPatchFields = {
  title: string;
  dueDate: string | null;
  note: string | null;
  assigneeLabel: string;
  assignToAll: boolean;
  broadcast: boolean;
  assigneeUserIds?: string[];
  assigneesCount?: number;
};

function mergeTaskAssignedJsonString(
  rawContent: string,
  taskId: string,
  fields: TaskAssignedPatchFields,
): string | null {
  if (typeof rawContent !== "string") return null;
  const c = rawContent.trim();
  if (!c.startsWith("{")) return null;
  try {
    const obj = JSON.parse(c) as {
      kind?: string;
      task?: Record<string, unknown>;
    };
    if (obj?.kind !== "task_assigned" || String(obj?.task?.taskId ?? "") !== String(taskId)) {
      return null;
    }
    obj.task = {
      ...obj.task,
      title: fields.title,
      dueDate: fields.dueDate,
      note: fields.note,
      assigneeLabel: fields.assigneeLabel,
      assignToAll: fields.assignToAll,
      broadcast: fields.broadcast,
      ...(fields.assigneeUserIds !== undefined ? { assigneeUserIds: fields.assigneeUserIds } : {}),
      ...(fields.assigneesCount !== undefined ? { assigneesCount: fields.assigneesCount } : {}),
    };
    return JSON.stringify(obj);
  } catch {
    return null;
  }
}

function patchDraftMessages(
  draft: { content?: string; messageId?: string }[],
  taskId: string,
  fields: TaskAssignedPatchFields,
): Map<string, string> {
  const patched = new Map<string, string>();
  for (const m of draft) {
    if (typeof m.content !== "string") continue;
    const next = mergeTaskAssignedJsonString(m.content, taskId, fields);
    if (!next || next === m.content) continue;
    m.content = next;
    patched.set(String(m.messageId), next);
  }
  return patched;
}

/**
 * Cập nhật mọi tin JSON `task_assigned` trùng taskId trong cache getMessages
 * và buffer Redux — vì socket `messageReceived` không ghi đè tin đã tồn tại.
 */
export function patchTaskAssignedSystemMessages(
  dispatch: AppDispatch,
  conversationId: string,
  taskId: string,
  fields: TaskAssignedPatchFields,
): void {
  const cid = conversationId.trim();
  const tid = String(taskId).trim();
  if (!cid || !tid) return;

  const queryArg = { conversationId: cid, limit: CHAT_MESSAGES_QUERY_LIMIT };
  const rtkPatched = new Map<string, string>();

  dispatch(
    messageApi.util.updateQueryData("getMessages", queryArg, (draft: any) => {
      if (!draft) return;
      for (const [id, content] of patchDraftMessages(draft, tid, fields)) {
        rtkPatched.set(id, content);
      }
    }),
  );

  const pushEdited = (messageId: string, content: string) => {
    dispatch(messageEdited({ messageId, conversationId: cid, content }));
  };

  for (const [id, content] of rtkPatched) {
    pushEdited(id, content);
  }

  const reduxMsgs = store.getState().chat.messages[cid] ?? [];
  for (const m of reduxMsgs) {
    const mid = String(m.messageId);
    if (typeof m.content !== "string") continue;
    const next = mergeTaskAssignedJsonString(m.content, tid, fields);
    if (!next || next === m.content) continue;
    pushEdited(mid, next);
  }
}
