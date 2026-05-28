import { Text, View } from "react-native";

type BadgeVariant = "danger" | "primary" | "muted";

interface BadgeProps {
  /** Số hiển thị trong badge — nếu ≤ 0 sẽ không render */
  count: number;
  /** Số tối đa hiển thị — vượt quá sẽ hiện "max+" */
  max?: number;
  variant?: BadgeVariant;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  danger: "bg-destructive",
  primary: "bg-primary",
  muted: "bg-muted-foreground",
};

/**
 * Badge component — hiển thị số lượng thông báo chưa đọc.
 * Hỗ trợ giới hạn tối đa (mặc định 99+).
 */
export const Badge = ({ count, max = 99, variant = "danger" }: BadgeProps) => {
  if (count <= 0) return null;

  const label = count > max ? `${max}+` : String(count);
  const isSmall = label.length <= 2;

  return (
    <View
      className={`${VARIANT_CLASS[variant]} items-center justify-center rounded-full ${isSmall ? "size-5" : "h-5 px-1.5"}`}
    >
      <Text className="text-[10px] font-bold leading-none text-white">{label}</Text>
    </View>
  );
};
