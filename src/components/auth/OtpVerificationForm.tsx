import { Link } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { z } from "zod";

import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { useAuth } from "@/hooks/useAuth";
import { useForgotPasswordMutation } from "@/store/api/authApi";
import { extractMutationErrorMessage } from "@/utils/apiError";

import { OtpCodeInput } from "./OtpCodeInput";

const otpSchema = z.object({
  otp: z.string().length(6, "OTP phải có 6 chữ số").regex(/^\d+$/, "OTP chỉ chứa chữ số"),
});

const resetSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Mật khẩu phải có chữ hoa, chữ thường, số và ký tự đặc biệt",
    ),
});

const RESEND_COOLDOWN_SEC = 30;

interface OtpVerificationFormProps {
  email?: string;
  mode?: string;
  notice?: string;
}

export const OtpVerificationForm = ({ email, mode, notice }: OtpVerificationFormProps) => {
  const { verifyLoginOtp, verifyRegisterOtp, resetPassword, isLoading, errorMessage } = useAuth();
  const [forgotPasswordMutation, forgotPasswordState] = useForgotPasswordMutation();
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otpError, setOtpError] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [infoMessage, setInfoMessage] = useState<string | null>(notice ?? null);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const autoSubmittedOtpRef = useRef<string | null>(null);

  useEffect(() => {
    if (resendSecondsLeft <= 0) {
      return;
    }
    const t = setInterval(() => {
      setResendSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendSecondsLeft]);

  const handleVerify = useCallback(async () => {
    const parsed = otpSchema.safeParse({ otp });
    if (!parsed.success) {
      setOtpError(parsed.error.flatten().fieldErrors.otp?.[0]);
      return;
    }

    setOtpError(undefined);
    setPasswordError(undefined);

    if (!email) {
      setInfoMessage("Thiếu email để xác thực OTP.");
      return;
    }

    if (mode === "login") {
      await verifyLoginOtp(email, parsed.data.otp);
      return;
    }

    if (mode === "register") {
      await verifyRegisterOtp(email, parsed.data.otp);
      return;
    }

    if (mode === "reset") {
      const parsedReset = resetSchema.safeParse({ newPassword });
      if (!parsedReset.success) {
        setPasswordError(parsedReset.error.flatten().fieldErrors.newPassword?.[0]);
        return;
      }

      await resetPassword(email, parsed.data.otp, parsedReset.data.newPassword);
      return;
    }

    setInfoMessage("Flow OTP này chưa được cấu hình.");
  }, [email, mode, newPassword, otp, resetPassword, verifyLoginOtp, verifyRegisterOtp]);

  useEffect(() => {
    if (mode === "reset") {
      return;
    }
    if (otp.length < 6) {
      autoSubmittedOtpRef.current = null;
      return;
    }
    if (!/^\d{6}$/.test(otp) || !email || isLoading) {
      return;
    }
    if (autoSubmittedOtpRef.current === otp) {
      return;
    }
    autoSubmittedOtpRef.current = otp;
    void handleVerify();
  }, [email, handleVerify, isLoading, mode, otp]);

  const handleResendResetOtp = async () => {
    if (!email || resendSecondsLeft > 0) {
      return;
    }
    setResendInfo(null);
    setResendError(null);
    try {
      await forgotPasswordMutation({ email }).unwrap();
      setResendInfo("Đã gửi lại OTP. Kiểm tra email.");
      setResendSecondsLeft(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setResendError(extractMutationErrorMessage(err) ?? "Không gửi lại được OTP.");
    }
  };

  return (
    <View className="gap-5">
      <OtpCodeInput
        value={otp}
        onChange={(next) => {
          setOtp(next);
          setOtpError(undefined);
        }}
        error={Boolean(otpError)}
      />
      {otpError ? <Text className="text-xs text-destructive">{otpError}</Text> : null}

      {mode === "reset" ? (
        <View className="gap-4 border-t border-border/40 pt-5">
          <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bước 2 — Mật khẩu mới
          </Text>
          <Input
            label="Mật khẩu mới"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            enablePasswordToggle
            error={passwordError}
          />
        </View>
      ) : null}

      {errorMessage ? <Text className="text-sm text-destructive">{errorMessage}</Text> : null}
      {infoMessage ? <Text className="text-sm text-muted-foreground">{infoMessage}</Text> : null}
      {resendInfo ? <Text className="text-sm text-primary">{resendInfo}</Text> : null}
      {resendError ? <Text className="text-sm text-destructive">{resendError}</Text> : null}

      <Button label="Xác thực OTP" onPress={handleVerify} loading={isLoading} />

      {mode === "reset" ? (
        <View className="gap-2">
          <Pressable
            onPress={handleResendResetOtp}
            disabled={!email || resendSecondsLeft > 0 || forgotPasswordState.isLoading}
            className={`items-center py-2 active:opacity-80 ${!email || resendSecondsLeft > 0 ? "opacity-50" : ""}`}
            accessibilityRole="button"
            accessibilityLabel="Gửi lại OTP đặt lại mật khẩu"
          >
            <Text className="text-center text-sm font-semibold text-primary">
              {resendSecondsLeft > 0 ? `Gửi lại OTP (${resendSecondsLeft}s)` : "Gửi lại OTP"}
            </Text>
          </Pressable>
          <Text className="text-center text-xs text-muted-foreground">
            Đăng nhập hoặc đăng ký cần gửi lại OTP? Quay lại màn hình trước và thử lại.
          </Text>
        </View>
      ) : (
        <Text className="text-center text-xs text-muted-foreground">
          Không nhận được mã? Kiểm tra thư mục spam hoặc quay lại bước trước để gửi lại.
        </Text>
      )}

      <Link href="/(auth)/login" asChild>
        <Pressable
          className="py-2 active:opacity-80"
          accessibilityRole="link"
          accessibilityLabel="Quay lại đăng nhập"
        >
          <Text className="text-center text-sm text-primary">Quay lại đăng nhập</Text>
        </Pressable>
      </Link>
    </View>
  );
};
