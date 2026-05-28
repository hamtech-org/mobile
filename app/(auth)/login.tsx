import { Link, useLocalSearchParams } from "expo-router";
import { Pressable, Text } from "react-native";

import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();

  return (
    <AuthScreenShell
      title="Đăng nhập"
      description="Chào mừng bạn quay lại Hamtech."
      footer={
        <Link href="/(auth)/register" asChild>
          <Pressable
            className="py-3 active:opacity-80"
            accessibilityRole="link"
            accessibilityLabel="Chuyển tới đăng ký"
          >
            <Text className="text-center text-sm text-primary">
              Chưa có tài khoản? Đăng ký ngay
            </Text>
          </Pressable>
        </Link>
      }
    >
      <LoginForm redirectPath={typeof redirect === "string" ? redirect : undefined} />
    </AuthScreenShell>
  );
}
