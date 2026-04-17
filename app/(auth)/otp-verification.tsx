import { Link, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useAuth } from "@/hooks/useAuth";

const otpSchema = z.object({
  otp: z.string().length(6, "OTP phải có 6 chữ số").regex(/^\d+$/, "OTP chỉ chứa chữ số"),
});
const resetSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt"),
});

export default function OtpVerificationScreen() {
  const { email, mode } = useLocalSearchParams<{ email?: string; mode?: string }>();
  const { verifyLoginOtp, verifyRegisterOtp, resetPassword, isLoading, errorMessage } = useAuth();
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpError, setOtpError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    const parsed = otpSchema.safeParse({ otp });
    if (!parsed.success) {
      setOtpError(parsed.error.flatten().fieldErrors.otp?.[0]);
      return;
    }

    setOtpError(undefined);
    setPasswordError(undefined);

    if (!email) {
      setInfoMessage("Thiếu email để xác thực OTP.");
      return;
    }

    if (mode === "login") {
      await verifyLoginOtp(email, parsed.data.otp);
      return;
    }

    if (mode === "register") {
      await verifyRegisterOtp(email, parsed.data.otp);
      return;
    }

    if (mode === "reset") {
      const parsedReset = resetSchema.safeParse({ newPassword });
      if (!parsedReset.success) {
        setPasswordError(parsedReset.error.flatten().fieldErrors.newPassword?.[0]);
        return;
      }

      await resetPassword(email, parsed.data.otp, parsedReset.data.newPassword);
      return;
    }

    setInfoMessage("Flow OTP này chưa được cấu hình.");
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10">
        <View className="bg-card border border-border rounded-2xl p-5 gap-5">
          <View className="gap-1">
            <Text className="text-foreground text-2xl font-bold">Xác thực OTP</Text>
            <Text className="text-muted-foreground text-sm">Nhập mã OTP đã gửi tới email: {email ?? "N/A"}</Text>
          </View>
          <Input
            label="OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            error={otpError}
          />
          {mode === "reset" ? (
            <Input
              label="Mật khẩu mới"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              error={passwordError}
            />
          ) : null}
          {errorMessage ? <Text className="text-destructive text-sm">{errorMessage}</Text> : null}
          {infoMessage ? <Text className="text-muted-foreground text-sm">{infoMessage}</Text> : null}
          <Button label="Xác thực OTP" onPress={handleVerify} loading={isLoading} />
          <Link href="/(auth)/login" asChild>
            <Text className="text-primary text-sm text-center">Quay lại đăng nhập</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
