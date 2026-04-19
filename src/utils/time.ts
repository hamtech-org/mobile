export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateLabel(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Giờ trên danh sách chat — luôn có mốc giờ (HH:mm kèm ngày khi không phải hôm nay).
 * Truyền `now` hoặc dùng state tick định kỳ để cập nhật realtime khi đổi ngày / qua nửa đêm.
 */
export function formatConversationListActivityTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const clock = `${hh}:${mi}`;

  const sameCalendarDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();

  if (sameCalendarDay) return clock;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();

  if (isYesterday) return `Hôm qua ${clock}`;

  if (d.getFullYear() === now.getFullYear()) {
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${clock}`;
  }

  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${clock}`;
}
