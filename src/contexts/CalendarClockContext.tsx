import { createContext, useCallback, useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";

const CalendarClockContext = createContext<Date | null>(null);

/**
 * Cung cấp mốc "bây giờ" cập nhật định kỳ để nhãn Hôm nay / Hôm qua / giờ danh sách
 * đổi đúng khi qua nửa đêm hoặc khi mở lại app (không cần gửi tin mới).
 */
export function CalendarClockProvider({ children }: { children: ReactNode }): ReactElement {
  const [now, setNow] = useState(() => new Date());

  const tick = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    const scheduleMidnight = () => {
      clearTimeout(midnightTimer);
      const n = new Date();
      const nextMidnight = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 0, 0);
      const ms = nextMidnight.getTime() - n.getTime();
      midnightTimer = setTimeout(() => {
        tick();
        scheduleMidnight();
      }, Math.max(ms, 1000));
    };

    scheduleMidnight();
    const interval = setInterval(tick, 60_000);

    const onAppState = (s: AppStateStatus) => {
      if (s === "active") tick();
    };
    const sub = AppState.addEventListener("change", onAppState);

    return () => {
      clearTimeout(midnightTimer);
      clearInterval(interval);
      sub.remove();
    };
  }, [tick]);

  return <CalendarClockContext.Provider value={now}>{children}</CalendarClockContext.Provider>;
}

/** Dùng trong khung chat; ngoài provider trả về `new Date()` mỗi lần (không subscribe). */
export function useCalendarNow(): Date {
  const v = useContext(CalendarClockContext);
  return v ?? new Date();
}
