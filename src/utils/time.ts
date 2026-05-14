export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Thời gian danh sách hội thoại kiểu Zalo — đồng bộ web `formatZaloConversationTime`.
 * `now` nên lấy từ `useCalendarNow()` (tick mỗi phút).
 */
export function formatZaloConversationTime(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";

  const diff = now.getTime() - t.getTime();
  if (diff < 0) return "Vài giây";

  if (diff < MINUTE_MS) return "Vài giây";
  if (diff < 60 * MINUTE_MS) {
    const minutes = Math.floor(diff / MINUTE_MS);
    return `${Math.max(1, minutes)} phút`;
  }
  if (diff < 24 * HOUR_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return `${Math.max(1, hours)} giờ`;
  }
  if (diff < 7 * DAY_MS) {
    const days = Math.floor(diff / DAY_MS);
    return `${Math.max(1, days)} ngày`;
  }

  const nowY = now.getFullYear();
  if (t.getFullYear() !== nowY) {
    return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}/${t.getFullYear()}`;
  }
  return `${String(t.getDate()).padStart(2, "0")}/${String(t.getMonth() + 1).padStart(2, "0")}`;
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

/**
 * Ngày gửi tin trong khung chat nhóm — luôn DD/MM/YYYY (không «Hôm nay»/«Hôm qua»),
 * đồng bộ cách đọc mốc ngày với giờ tin nhắn.
 */
export function formatChatFrameDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

/** Cùng phút lịch (ngày + giờ + phút) — gom một dòng giờ dưới tin cuối trong phút đó (nhóm). */
export function isSameCalendarMinute(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate() &&
    da.getHours() === db.getHours() &&
    da.getMinutes() === db.getMinutes()
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Giờ/ngày dưới bubble nhóm (Zalo): cùng ngày lịch → chỉ HH:mm; khác ngày → HH:mm · DD/MM/YYYY.
 * Chỉ gắn vào tin cuối trong cùng một phút lịch — xem `isSameCalendarMinute` + `showTimestamp` ở `ChatBubble`.
 */
export function formatGroupBubbleFooterTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const clock = formatTimestamp(iso);
  const sameCalendarDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameCalendarDay) return clock;
  return `${clock} · ${formatChatFrameDate(iso)}`;
}

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
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

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

/**
 * Hiển thị thời gian tương đối cho Mạng xã hội (Bài viết, Bình luận).
 * Ví dụ: "Vừa xong", "5 phút trước", "2 giờ trước", "3 ngày trước", "20 tháng 10"
 */
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";

  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return "Vừa xong";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Vừa xong";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;

  if (d.getFullYear() === now.getFullYear()) {
    return `${pad2(d.getDate())} tháng ${pad2(d.getMonth() + 1)}`;
  }

  return `${pad2(d.getDate())} tháng ${pad2(d.getMonth() + 1)}, ${d.getFullYear()}`;
}
