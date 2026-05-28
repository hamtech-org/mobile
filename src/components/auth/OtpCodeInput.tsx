import { Text, TextInput, View } from "react-native";

const CELL_COUNT = 6;

interface OtpCodeInputProps {
  value: string;
  onChange: (next: string) => void;
  error?: boolean;
}

/**
 * Một TextInput ẩn giữ toàn bộ chuỗi OTP + bàn phím số.
 * Các ô chỉ hiển thị — Backspace/Android number-pad hoạt động đúng (không dựa vào onKeyPress).
 */
export const OtpCodeInput = ({ value, onChange, error }: OtpCodeInputProps) => {
  const handleChangeText = (text: string) => {
    onChange(text.replace(/\D/g, "").slice(0, CELL_COUNT));
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">Mã OTP</Text>
      <View className="relative">
        <View className="pointer-events-none flex-row justify-between gap-2">
          {Array.from({ length: CELL_COUNT }, (_, index) => (
            <View
              key={index}
              className={`flex-1 rounded-2xl border bg-background py-3 ${
                error ? "border-destructive" : "border-border"
              }`}
            >
              <Text className="text-center text-xl font-semibold text-foreground">
                {value[index] ?? ""}
              </Text>
            </View>
          ))}
        </View>
        <TextInput
          className="absolute inset-0 z-10 min-h-[52px] w-full bg-transparent p-0"
          style={{
            color: "transparent",
            fontSize: 1,
            lineHeight: 1,
          }}
          value={value}
          onChangeText={handleChangeText}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={CELL_COUNT}
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          caretHidden
          selectionColor="transparent"
          underlineColorAndroid="transparent"
          importantForAutofill="yes"
          accessibilityLabel="Mã OTP gồm 6 chữ số"
        />
      </View>
    </View>
  );
};
