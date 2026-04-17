import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự."),
});

export const LoginForm = () => {
  const { login, isLoading, errorMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [localSubmitMessage, setLocalSubmitMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const formatted = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: formatted.email?.[0],
        password: formatted.password?.[0],
      });
      return;
    }

    setFieldErrors({});
    const success = await login(parsed.data.email, parsed.data.password);
    if (success) {
      setLocalSubmitMessage("Đăng nhập bước 1 thành công. Vui lòng nhập OTP.");
    }
  };

  return (
    <View className="gap-4">
      <Input
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setLocalSubmitMessage(null);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        error={fieldErrors.email}
        clearErrorOnChange={() => setFieldErrors((prev) => ({ ...prev, email: undefined }))}
      />
      <Input
        label="Mật khẩu"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setLocalSubmitMessage(null);
        }}
        secureTextEntry
        enablePasswordToggle
        error={fieldErrors.password}
        clearErrorOnChange={() => setFieldErrors((prev) => ({ ...prev, password: undefined }))}
      />
      {errorMessage ? <Text className="text-destructive text-sm">{errorMessage}</Text> : null}
      {!errorMessage && localSubmitMessage ? <Text className="text-primary text-sm">{localSubmitMessage}</Text> : null}
      <Button label="Đăng nhập" onPress={handleSubmit} loading={isLoading} />
      <Link href="/(auth)/forgot-password" asChild>
        <Text className="text-primary text-sm text-center">Quên mật khẩu?</Text>
      </Link>
    </View>
  );
};
