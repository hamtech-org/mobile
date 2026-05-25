/**
 * Mỗi conversationId → một banner `chat-{id}`.
 * Tối đa 3 dòng tin mới nhất; nếu > 3 tin thì thêm "Có X+ tin nhắn mới".
 */

export interface ChatMessagingLine {
  text: string;
  timestamp: number;
  /** Nhóm: tên người gửi (MessagingStyle person). 1:1 để trống. */
  senderName?: string;
}

export interface ChatStackSnapshot {
  notificationId: string;
  /** Tối đa 3 dòng hiển thị trên banner. */
  lines: ChatMessagingLine[];
  /** Tổng số tin đã gộp trong phiên stack. */
  totalCount: number;
  latestLine: ChatMessagingLine;
  /** Nội dung thu gọn (collapsed). */
  collapsedBody: string;
  /** Dòng cuối khi totalCount > 3, ví dụ "Có 5+ tin nhắn mới". */
  overflowSummary: string | null;
}

const MAX_DISPLAY_LINES = 3;
const STACK_TTL_MS = 30 * 60_000;

type StackEntry = {
  lines: ChatMessagingLine[];
  totalCount: number;
  seenKeys: Set<string>;
  updatedAt: number;
};

const stacks = new Map<string, StackEntry>();

export function chatNotificationId(conversationId: string): string {
  return `chat-${conversationId.trim()}`;
}

function pruneStacks(now: number): void {
  if (stacks.size <= 80) return;
  stacks.forEach((entry, key) => {
    if (now - entry.updatedAt > STACK_TTL_MS) stacks.delete(key);
  });
}

function overflowSummaryLine(totalCount: number): string | null {
  if (totalCount <= MAX_DISPLAY_LINES) return null;
  return `Có ${totalCount}+ tin nhắn mới`;
}

function collapsedBodyFor(totalCount: number, latestText: string): string {
  const overflow = overflowSummaryLine(totalCount);
  if (overflow) return overflow;
  return latestText;
}

function snapshotFromEntry(notificationId: string, entry: StackEntry): ChatStackSnapshot {
  const lines = entry.lines.slice(-MAX_DISPLAY_LINES);
  const latestLine = entry.lines[entry.lines.length - 1] ?? lines[lines.length - 1]!;
  const overflowSummary = overflowSummaryLine(entry.totalCount);
  return {
    notificationId,
    lines,
    totalCount: entry.totalCount,
    latestLine,
    collapsedBody: collapsedBodyFor(entry.totalCount, latestLine.text),
    overflowSummary,
  };
}

/**
 * Thêm một tin vào stack; cùng conversationId chỉ cập nhật một banner.
 */
export function pushChatNotificationStack(
  conversationId: string,
  text: string,
  opts?: { senderName?: string; timestamp?: number; dedupeKey?: string },
): ChatStackSnapshot | null {
  const cid = conversationId.trim();
  const lineText = text.trim();
  if (!cid || !lineText) return null;

  const now = Date.now();
  const key = chatNotificationId(cid);
  const dedupeKey = opts?.dedupeKey?.trim() || `${lineText}|${opts?.senderName ?? ""}`;
  const prev = stacks.get(key);

  if (prev && now - prev.updatedAt < STACK_TTL_MS && prev.seenKeys.has(dedupeKey)) {
    return null;
  }

  const line: ChatMessagingLine = {
    text: lineText,
    timestamp: opts?.timestamp ?? now,
    ...(opts?.senderName?.trim() ? { senderName: opts.senderName.trim() } : {}),
  };

  let entry: StackEntry;
  if (prev && now - prev.updatedAt < STACK_TTL_MS) {
    const seenKeys = new Set(prev.seenKeys);
    seenKeys.add(dedupeKey);
    if (seenKeys.size > 120) seenKeys.clear();
    entry = {
      lines: [...prev.lines, line].slice(-MAX_DISPLAY_LINES),
      totalCount: prev.totalCount + 1,
      seenKeys,
      updatedAt: now,
    };
  } else {
    entry = {
      lines: [line],
      totalCount: 1,
      seenKeys: new Set([dedupeKey]),
      updatedAt: now,
    };
  }

  stacks.set(key, entry);
  pruneStacks(now);
  return snapshotFromEntry(key, entry);
}

export function clearChatNotificationStack(conversationId: string): void {
  const cid = conversationId.trim();
  if (!cid) return;
  stacks.delete(chatNotificationId(cid));
}
