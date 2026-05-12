import { Calendar } from "lucide-react-native";
import type { ReactElement } from "react";
import { Text, View } from "react-native";

/** Giống `TaskDeadlineCalendar` trên web — «Hôm nay, 20:30» hoặc «20/12/2026, 20:55». */
export function formatTaskDeadlineTimeLine(d: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const sameCalendarDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (sameCalendarDay) return `Hôm nay, ${hm}`;
  const ddmmyyyy = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  return `${ddmmyyyy}, ${hm}`;
}

export function taskDeadlineChipFromIso(dateIso: string | null | undefined): {
  invalid: boolean;
  overdue: boolean;
  label: string;
} {
  if (dateIso == null || String(dateIso).trim() === "") {
    return { invalid: true, overdue: false, label: "—" };
  }
  const d = new Date(String(dateIso));
  const t = d.getTime();
  if (!Number.isFinite(t)) {
    return { invalid: true, overdue: false, label: "Deadline không hợp lệ" };
  }
  return {
    invalid: false,
    overdue: d.getTime() < Date.now(),
    label: formatTaskDeadlineTimeLine(d),
  };
}

/** Chip giống web `TaskDeadlineCalendar` (màu đỏ khi quá hạn, indigo khi còn hạn). */
export function TaskDeadlineChipMobile({
  dateIso,
  compact,
}: {
  dateIso: string;
  compact?: boolean;
}): ReactElement {
  const chip = taskDeadlineChipFromIso(dateIso);
  const border = chip.overdue ? "#FECACA" : "#C7D2FE";
  const bg = chip.overdue ? "#FEF2F2" : "#EEF2FF";
  const fg = chip.overdue ? "#DC2626" : "#4F46E5";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: border,
        backgroundColor: bg,
      }}
    >
      <Calendar size={compact ? 12 : 14} color={fg} strokeWidth={2} />
      <Text style={{ fontSize: compact ? 11 : 12, fontWeight: "600", color: fg }}>
        {chip.label}
      </Text>
    </View>
  );
}
