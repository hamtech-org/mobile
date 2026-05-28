import { Link } from "expo-router";
import { Pressable, Text } from "react-native";

import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterScreen() {
  return (
    <AuthScreenShell
      title="Tạo tài khoản"
      description="Tham gia Hamtech để bắt đầu kết nối."
      footer={
        <Link href="/(auth)/login" asChild>
          <Pressable
            className="py-3 active:opacity-80"
            accessibilityRole="link"
            accessibilityLabel="Chuyển tới đăng nhập"
          >
            <Text className="text-center text-sm text-primary">Đã có tài khoản? Đăng nhập</Text>
          </Pressable>
        </Link>
      }
    >
      <RegisterForm />
    </AuthScreenShell>
  );
}
