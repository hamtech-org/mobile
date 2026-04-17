import { Pressable, Text, type PressableProps } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
}

const variantClassNames: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  secondary: "bg-muted border border-border",
  ghost: "bg-transparent",
};

const textVariantClassNames: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  secondary: "text-foreground",
  ghost: "text-foreground",
};

export const Button = ({ label, variant = "primary", loading = false, disabled, ...props }: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={`rounded-xl px-4 py-3 items-center justify-center ${variantClassNames[variant]} ${isDisabled ? "opacity-60" : "active:opacity-80"}`}
      disabled={isDisabled}
      {...props}
    >
      <Text className={`font-semibold ${textVariantClassNames[variant]}`}>{loading ? "Đang xử lý..." : label}</Text>
    </Pressable>
  );
};
