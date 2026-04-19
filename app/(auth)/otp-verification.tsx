import { useLocalSearchParams } from "expo-router";

import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { OtpVerificationForm } from "@/components/auth/OtpVerificationForm";

function modeBadge(mode?: string) {
  if (mode === "login") {
    return "Đăng nhập";
  }
  if (mode === "register") {
    return "Đăng ký";
  }
  if (mode === "reset") {
    return "Đặt lại mật khẩu";
  }
  return "Xác thực";
}

export default function OtpVerificationScreen() {
  const { email, mode, notice } = useLocalSearchParams<{ email?: string; mode?: string; notice?: string }>();

  const description = `Nhập mã 6 số đã gửi tới ${email ?? "email của bạn"}.`;

  return (
    <AuthScreenShell
      showHero={false}
      badge={modeBadge(mode)}
      title="Xác thực OTP"
      description={description}
    >
      <OtpVerificationForm email={email} mode={mode} notice={notice} />
    </AuthScreenShell>
  );
}
