/** Múi giờ cố định cho deadline giao việc (không DST) — đồng bộ với `frontend/src/utils/vietnamDeadline.ts`. */
export const VIETNAM_IANA = "Asia/Ho_Chi_Minh";
const VN_OFFSET = "+07:00";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function getVietnamWallParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: VIETNAM_IANA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
  const parts = f.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function vietnamDateStr(d: Date) {
  const p = getVietnamWallParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function vietnamHmStr(d: Date) {
  const p = getVietnamWallParts(d);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Instant đầu phút hiện tại theo giờ Việt Nam (dùng so sánh “đã quá hạn chưa”). */
export function vietnamInstantAtCurrentMinuteStart(d = new Date()) {
  const p = getVietnamWallParts(d);
  const iso = `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}:00${VN_OFFSET}`;
  return new Date(iso);
}

/**
 * Chuỗi từ input modal `YYYY-MM-DD` hoặc `YYYY-MM-DDTHH:mm` được hiểu là giờ Việt Nam.
 */
export function parseVietnamLocalDeadlineInput(raw: string): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const [datePart, rest] = s.split("T");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const hm = (rest ?? "").slice(0, 5);
  const timeOk = /^\d{2}:\d{2}$/.test(hm);
  const t = timeOk ? hm : "00:00";
  const d = new Date(`${datePart}T${t}:00${VN_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO UTC (dueDate từ server) → giá trị `datetime-local` theo giờ VN. */
export function isoUtcToVietnamLocalDatetimeValue(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = getVietnamWallParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Giống web `deadlineLocalInputToJsonValue` — gửi API `dueDate` dạng ISO UTC. */
export function deadlineLocalInputToJsonValue(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const d = parseVietnamLocalDeadlineInput(input);
  return d ? d.toISOString() : null;
}

export function parseDeadlineParts(raw: string): { date: string; time: string } {
  const s = String(raw ?? "").trim();
  if (!s) return { date: "", time: "" };
  const [date, time] = s.split("T");
  return { date: date ?? "", time: (time ?? "").slice(0, 5) };
}
