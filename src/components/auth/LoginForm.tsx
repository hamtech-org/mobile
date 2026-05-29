import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Camera } from "expo-camera";
import { z } from "zod";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { FaceLivenessWebViewModal } from "@/components/auth/FaceLivenessWebViewModal";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự."),
});

const faceEmailSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
});

export const LoginForm = ({ redirectPath }: { redirectPath?: string }) => {
  const { login, createFaceLivenessSession, loginWithFace, isLoading, errorMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [localSubmitMessage, setLocalSubmitMessage] = useState<string | null>(null);
  const [faceEmail, setFaceEmail] = useState("");
  const [faceEmailError, setFaceEmailError] = useState<string | undefined>();
  const [faceMessage, setFaceMessage] = useState<string | null>(null);
  const [isFaceEmailModalOpen, setIsFaceEmailModalOpen] = useState(false);
  const [livenessSessionId, setLivenessSessionId] = useState("");
  const [keyboardLift, setKeyboardLift] = useState(0);

  useEffect(() => {
    if (!isFaceEmailModalOpen) {
      setKeyboardLift(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardLift(Math.min(event.endCoordinates.height / 2, 180));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardLift(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [isFaceEmailModalOpen]);

  const handleSubmit = async () => {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const formatted = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: formatted.email?.[0],
        password: formatted.password?.[0],
      });
      return;
    }

    setFieldErrors({});
    const success = await login(parsed.data.email, parsed.data.password, redirectPath);
    if (success) {
      setLocalSubmitMessage("Đăng nhập bước 1 thành công. Vui lòng nhập OTP.");
    }
  };

  const openFaceLogin = () => {
    setFaceEmail(email.trim());
    setFaceEmailError(undefined);
    setFaceMessage(null);
    setIsFaceEmailModalOpen(true);
  };

  const startFaceLogin = async () => {
    const parsed = faceEmailSchema.safeParse({ email: faceEmail.trim() });
    if (!parsed.success) {
      setFaceEmailError(parsed.error.flatten().fieldErrors.email?.[0]);
      return;
    }

    setFaceEmailError(undefined);
    setFaceMessage(null);

    const cameraPermission = await Camera.getCameraPermissionsAsync();
    if (!cameraPermission.granted) {
      if (cameraPermission.canAskAgain === false) {
        setFaceMessage(
          "Ứng dụng chưa có quyền camera. Vào Cài đặt thiết bị để bật quyền camera cho HamTech.",
        );
        return;
      }

      const nextPermission = await Camera.requestCameraPermissionsAsync();
      if (!nextPermission.granted) {
        setFaceMessage("Cần quyền camera để xác thực khuôn mặt.");
        return;
      }
    }

    const sessionId = await createFaceLivenessSession();
    if (!sessionId) {
      setFaceMessage(errorMessage || "Không thể tạo phiên xác thực khuôn mặt.");
      return;
    }

    setLivenessSessionId(sessionId);
    setIsFaceEmailModalOpen(false);
  };

  const handleFaceLivenessSuccess = async () => {
    const success = await loginWithFace(faceEmail.trim(), livenessSessionId, redirectPath);
    if (success) {
      setLivenessSessionId("");
      setFaceEmail("");
      setFaceMessage(null);
      return;
    }

    setLivenessSessionId("");
    setIsFaceEmailModalOpen(true);
    setFaceMessage(errorMessage || "Đăng nhập bằng khuôn mặt thất bại. Vui lòng thử lại.");
  };

  const cancelFaceLiveness = () => {
    setLivenessSessionId("");
    setIsFaceEmailModalOpen(true);
  };

  return (
    <View className="gap-4">
      <Input
        label="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setLocalSubmitMessage(null);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        error={fieldErrors.email}
        clearErrorOnChange={() => setFieldErrors((prev) => ({ ...prev, email: undefined }))}
      />
      <Input
        label="Mật khẩu"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setLocalSubmitMessage(null);
        }}
        secureTextEntry
        enablePasswordToggle
        error={fieldErrors.password}
        clearErrorOnChange={() => setFieldErrors((prev) => ({ ...prev, password: undefined }))}
      />
      <Link href="/(auth)/forgot-password" asChild>
        <Pressable
          className="self-end py-1 active:opacity-80"
          accessibilityRole="link"
          accessibilityLabel="Quên mật khẩu"
        >
          <Text className="text-sm text-primary">Quên mật khẩu?</Text>
        </Pressable>
      </Link>
      {errorMessage ? <Text className="text-sm text-destructive">{errorMessage}</Text> : null}
      {!errorMessage && localSubmitMessage ? (
        <Text className="text-sm text-primary">{localSubmitMessage}</Text>
      ) : null}
      <Button label="Đăng nhập" onPress={handleSubmit} loading={isLoading} />

      <View className="my-1 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs text-muted-foreground">hoặc</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <Button
        label="Đăng nhập bằng khuôn mặt"
        variant="secondary"
        onPress={openFaceLogin}
        leftIcon={<Ionicons name="scan-outline" size={18} color="hsl(var(--foreground) / 1)" />}
      />

      <Modal
        visible={isFaceEmailModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsFaceEmailModalOpen(false)}
      >
        <Pressable
          className="flex-1 justify-center bg-black/45 px-5 py-6"
          onPress={() => setIsFaceEmailModalOpen(false)}
        >
          <Pressable
            className="gap-4 rounded-3xl border border-border bg-card p-5"
            style={{ transform: [{ translateY: -keyboardLift }] }}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 gap-1">
                <Text className="text-xl font-bold text-foreground">Đăng nhập bằng khuôn mặt</Text>
                <Text className="text-sm leading-relaxed text-muted-foreground">
                  Nhập email để xác minh danh tính của bạn.
                </Text>
              </View>
              <Pressable
                onPress={() => setIsFaceEmailModalOpen(false)}
                className="size-9 items-center justify-center rounded-full bg-muted active:opacity-70"
                accessibilityLabel="Đóng"
              >
                <Ionicons name="close" size={18} color="hsl(var(--foreground) / 1)" />
              </Pressable>
            </View>

            <Input
              label="Email"
              value={faceEmail}
              onChangeText={(value) => {
                setFaceEmail(value);
                setFaceEmailError(undefined);
                setFaceMessage(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={faceEmailError}
            />

            {faceMessage ? <Text className="text-sm text-destructive">{faceMessage}</Text> : null}

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button
                  label="Hủy"
                  variant="secondary"
                  onPress={() => setIsFaceEmailModalOpen(false)}
                />
              </View>
              <View className="flex-1">
                <Button label="Tiếp tục" onPress={startFaceLogin} loading={isLoading} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <FaceLivenessWebViewModal
        visible={Boolean(livenessSessionId)}
        sessionId={livenessSessionId}
        onSuccess={() => {
          void handleFaceLivenessSuccess();
        }}
        onCancel={cancelFaceLiveness}
        onRetry={() => {
          setLivenessSessionId("");
          setIsFaceEmailModalOpen(true);
          setFaceMessage("Phiên xác thực đã hết hiệu lực. Bấm Tiếp tục để tạo phiên mới.");
        }}
        onError={(message) => {
          setFaceMessage(message);
        }}
      />
    </View>
  );
};
