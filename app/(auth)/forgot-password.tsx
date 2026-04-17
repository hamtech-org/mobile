import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export default function ForgotPasswordScreen() {
  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10">
        <View className="bg-card border border-border rounded-2xl p-5 gap-5">
          <View className="gap-1">
            <Text className="text-foreground text-2xl font-bold">Quên mật khẩu</Text>
            <Text className="text-muted-foreground text-sm">Nhập email để nhận OTP đặt lại mật khẩu.</Text>
          </View>
          <ForgotPasswordForm />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
