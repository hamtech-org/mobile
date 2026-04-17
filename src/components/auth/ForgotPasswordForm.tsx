import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";

const forgotPasswordSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
});

export const ForgotPasswordForm = () => {
  const router = useRouter();
  const { forgotPassword, isLoading, errorMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(parsed.error.flatten().fieldErrors.email?.[0]);
      return;
    }

    setEmailError(undefined);
    const success = await forgotPassword(parsed.data.email);
    if (success) {
      setSuccessMessage("Đã gửi OTP reset password vào email.");
      router.push({ pathname: "/(auth)/otp-verification", params: { email: parsed.data.email } });
    }
  };

  return (
    <View className="gap-4">
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={emailError} />
      {errorMessage ? <Text className="text-destructive text-sm">{errorMessage}</Text> : null}
      {successMessage ? <Text className="text-primary text-sm">{successMessage}</Text> : null}
      <Button label="Gửi OTP" onPress={handleSubmit} loading={isLoading} />
      <Link href="/(auth)/login" asChild>
        <Text className="text-primary text-sm text-center">Quay lại đăng nhập</Text>
      </Link>
    </View>
  );
};
