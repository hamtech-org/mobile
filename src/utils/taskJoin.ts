/** Giống `frontend/src/utils/chatUtils.ts` — hết hạn thì không còn nút tham gia. */
export function isTaskJoinDeadlinePassed(dueDate: string | null | undefined): boolean {
  if (dueDate == null || String(dueDate).trim() === "") return false;
  const ms = new Date(String(dueDate)).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() > ms;
}
