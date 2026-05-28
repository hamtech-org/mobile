import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

import { useIconColors } from "@/hooks/useIconColors";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
  containerClassName?: string;
  inputClassName?: string;
  clearErrorOnChange?: () => void;
  enablePasswordToggle?: boolean;
}

export const Input = ({
  label,
  error,
  helperText,
  required = false,
  disabled = false,
  size = "md",
  containerClassName,
  inputClassName,
  clearErrorOnChange,
  secureTextEntry,
  enablePasswordToggle = false,
  onChangeText,
  ...props
}: InputProps) => {
  const { muted } = useIconColors();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const shouldTogglePassword = enablePasswordToggle && secureTextEntry;

  const handleChangeText = (value: string) => {
    clearErrorOnChange?.();
    onChangeText?.(value);
  };

  const wrapperSizeClassName = size === "sm" ? "px-2 py-1 rounded-xl" : "px-2.5 py-1.5 rounded-2xl";
  const inputSizeClassName = size === "sm" ? "text-sm" : "text-base";

  return (
    <View className={`gap-2 ${containerClassName ?? ""}`}>
      <Text className="text-sm font-medium text-foreground">
        {label}
        {required ? <Text className="text-destructive"> *</Text> : null}
      </Text>
      <View
        className={`flex-row items-center gap-2 border ${wrapperSizeClassName} ${error ? "border-destructive" : "border-border"} ${disabled ? "opacity-60" : ""}`}
      >
        <TextInput
          className={`flex-1 text-foreground ${inputSizeClassName} ${inputClassName ?? ""}`}
          placeholderTextColor={muted}
          editable={!disabled}
          secureTextEntry={shouldTogglePassword ? !isPasswordVisible : secureTextEntry}
          onChangeText={handleChangeText}
          {...props}
        />
        {shouldTogglePassword ? (
          <Pressable
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            className="p-1 active:opacity-70"
            hitSlop={8}
          >
            <Ionicons
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="hsl(215 16% 47%)"
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-xs text-destructive">{error}</Text> : null}
      {!error && helperText ? (
        <Text className="text-xs text-muted-foreground">{helperText}</Text>
      ) : null}
    </View>
  );
};
