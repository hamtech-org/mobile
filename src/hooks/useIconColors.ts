import { useColorScheme } from "nativewind";

/**
 * Hook trả về màu icon theo theme hiện tại.
 * Ionicons không nhận NativeWind className nên phải truyền color trực tiếp.
 */
export const useIconColors = () => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  return {
    foreground: isDark ? "#eef3f8" : "#131722",
    muted: isDark ? "#858da3" : "#697080",
    primary: isDark ? "#297fff" : "#006eff",
    destructive: isDark ? "#dc2828" : "#ef4444",
    isDark,
  };
};
