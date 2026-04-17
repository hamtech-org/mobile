import { Text, TextInput, View, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
}

export const Input = ({ label, error, ...props }: InputProps) => {
  return (
    <View className="gap-2">
      <Text className="text-foreground text-sm font-medium">{label}</Text>
      <TextInput
        className={`rounded-xl border px-4 py-3 text-foreground ${error ? "border-destructive" : "border-border"}`}
        placeholderTextColor="hsl(215 16% 47%)"
        {...props}
      />
      {error ? <Text className="text-destructive text-xs">{error}</Text> : null}
    </View>
  );
};
