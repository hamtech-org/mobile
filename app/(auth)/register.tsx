import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterScreen() {
  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10">
        <View className="bg-card border border-border rounded-2xl p-5 gap-5">
          <View className="gap-1">
            <Text className="text-foreground text-2xl font-bold">Tạo tài khoản</Text>
            <Text className="text-muted-foreground text-sm">Tham gia Hamtech để bắt đầu kết nối.</Text>
          </View>
          <RegisterForm />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
