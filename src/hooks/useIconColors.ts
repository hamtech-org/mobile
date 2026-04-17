import { useColorScheme } from "nativewind";
import { useEffect } from "react";

/**
 * Hook trả về màu icon theo theme hiện tại.
 * Ionicons không nhận NativeWind className nên phải truyền color trực tiếp.
 * Các giá trị lấy từ global.css CSS variables.
 */
export const useIconColors = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    /** text-foreground */
    foreground: isDark ? "hsl(210 40% 98%)" : "hsl(222 47% 11%)",
    /** text-muted-foreground */
    muted: isDark ? "hsl(215 20% 65%)" : "hsl(215 16% 47%)",
    /** text-primary */
    primary: isDark ? "hsl(217 91% 60%)" : "hsl(221 83% 53%)",
    /** text-destructive */
    destructive: isDark ? "hsl(0 72% 51%)" : "hsl(0 84% 60%)",
    /** màu nền card */
    card: isDark ? "hsl(222 47% 14%)" : "hsl(0 0% 100%)",
    isDark,
  };
};
