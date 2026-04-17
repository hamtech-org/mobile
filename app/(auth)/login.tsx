import { Link } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginScreen() {
  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10">
        <View className="bg-card border border-border rounded-2xl p-5 gap-5">
          <View className="gap-1">
            <Text className="text-foreground text-2xl font-bold">Đăng nhập</Text>
            <Text className="text-muted-foreground text-sm">Chào mừng bạn quay lại Hamtech.</Text>
          </View>
          <LoginForm />
          <Link href="/(auth)/register" asChild>
            <Text className="text-primary text-sm text-center">Chưa có tài khoản? Đăng ký ngay</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
