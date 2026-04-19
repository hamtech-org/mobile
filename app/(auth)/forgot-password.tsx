import { Link } from "expo-router";
import { Pressable, Text } from "react-native";

import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordScreen() {
  return (
    <AuthScreenShell
      title="Quên mật khẩu"
      description="Bước 1/2 — Nhập email để nhận OTP đặt lại mật khẩu. Bước 2 sẽ là nhập OTP và mật khẩu mới."
      footer={
        <Link href="/(auth)/login" asChild>
          <Pressable className="py-3 active:opacity-80" accessibilityRole="link" accessibilityLabel="Quay lại đăng nhập">
            <Text className="text-center text-sm text-primary">Quay lại đăng nhập</Text>
          </Pressable>
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthScreenShell>
  );
}
