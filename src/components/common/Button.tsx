import { ActivityIndicator, Pressable, Text, View, type PressableProps } from "react-native";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
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

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "px-3 py-2 rounded-lg",
  md: "px-4 py-3 rounded-xl",
  lg: "px-5 py-4 rounded-2xl",
};

const textSizeClassNames: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-base",
};

export const Button = ({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel = "Đang xử lý...",
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={`items-center justify-center ${sizeClassNames[size]} ${variantClassNames[variant]} ${isDisabled ? "opacity-60" : "active:opacity-80"}`}
      disabled={isDisabled}
      {...props}
    >
      <View className="flex-row items-center justify-center gap-2">
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === "primary" ? "hsl(0 0% 100%)" : "hsl(222 47% 11%)"}
          />
        ) : null}
        {!loading && leftIcon ? <View>{leftIcon}</View> : null}
        <Text
          className={`font-semibold ${textVariantClassNames[variant]} ${textSizeClassNames[size]}`}
        >
          {loading ? loadingLabel : label}
        </Text>
        {!loading && rightIcon ? <View>{rightIcon}</View> : null}
      </View>
    </Pressable>
  );
};
