import { useColorScheme } from "nativewind";

/**
 * Hook trả về màu icon theo theme hiện tại.
 * Ionicons không nhận NativeWind className nên phải truyền color trực tiếp.
 */
export const useIconColors = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    foreground: isDark ? "hsl(210 30% 95%)" : "hsl(220 25% 10%)",
    muted: isDark ? "hsl(220 15% 58%)" : "hsl(220 10% 46%)",
    primary: isDark ? "hsl(214 100% 58%)" : "hsl(214 100% 50%)",
    destructive: isDark ? "hsl(0 72% 51%)" : "hsl(0 84% 60%)",
    isDark,
  };
};
