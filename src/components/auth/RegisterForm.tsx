import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";

const registerSchema = z
  .object({
    displayName: z.string().min(2, "Tên hiển thị tối thiểu 2 ký tự."),
    email: z.string().email("Email không hợp lệ."),
    password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự."),
    confirmPassword: z.string().min(8, "Xác nhận mật khẩu tối thiểu 8 ký tự."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp.",
    path: ["confirmPassword"],
  });

export const RegisterForm = () => {
  const { register, isLoading, errorMessage } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const handleSubmit = async () => {
    const parsed = registerSchema.safeParse({ displayName, email, password, confirmPassword });
    if (!parsed.success) {
      const formatted = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        displayName: formatted.displayName?.[0],
        email: formatted.email?.[0],
        password: formatted.password?.[0],
        confirmPassword: formatted.confirmPassword?.[0],
      });
      return;
    }

    setFieldErrors({});
    await register({
      email: parsed.data.email,
      password: parsed.data.password,
      displayName: parsed.data.displayName,
    });
  };

  return (
    <View className="gap-4">
      <Input label="Tên hiển thị" value={displayName} onChangeText={setDisplayName} error={fieldErrors.displayName} />
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        error={fieldErrors.email}
      />
      <Input
        label="Mật khẩu"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        enablePasswordToggle
        error={fieldErrors.password}
      />
      <Input
        label="Xác nhận mật khẩu"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        enablePasswordToggle
        error={fieldErrors.confirmPassword}
      />
      {errorMessage ? <Text className="text-destructive text-sm">{errorMessage}</Text> : null}
      <Button label="Tạo tài khoản" onPress={handleSubmit} loading={isLoading} />
      <Link href="/(auth)/login" asChild>
        <Text className="text-primary text-sm text-center">Đã có tài khoản? Đăng nhập</Text>
      </Link>
    </View>
  );
};
