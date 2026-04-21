import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
      <Link href="/(auth)/forgot-password" asChild>
        <Pressable
          className="self-end py-1 active:opacity-80"
          accessibilityRole="link"
          accessibilityLabel="Quên mật khẩu"
        >
          <Text className="text-sm text-primary">Quên mật khẩu?</Text>
        </Pressable>
      </Link>
      {errorMessage ? <Text className="text-sm text-destructive">{errorMessage}</Text> : null}
      {!errorMessage && localSubmitMessage ? (
        <Text className="text-sm text-primary">{localSubmitMessage}</Text>
      ) : null}
      <Button label="Đăng nhập" onPress={handleSubmit} loading={isLoading} />
    </View>
  );
};
