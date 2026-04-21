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
    <View className="gap-6">
      <View className="gap-4">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hồ sơ
        </Text>
        <Input
          label="Tên hiển thị"
          value={displayName}
          onChangeText={setDisplayName}
          error={fieldErrors.displayName}
        />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          error={fieldErrors.email}
        />
      </View>
      <View className="gap-4 border-t border-border/40 pt-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bảo mật
        </Text>
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
      </View>
      {errorMessage ? <Text className="text-sm text-destructive">{errorMessage}</Text> : null}
      <Button label="Tạo tài khoản" onPress={handleSubmit} loading={isLoading} />
    </View>
  );
};
