import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { env } from "@/config/env";

type NativeFaceLivenessResult = {
  success?: boolean;
  cancelled?: boolean;
  message?: string;
};

type NativeFaceLivenessModule = {
  start: (options: {
    sessionId: string;
    region: string;
    identityPoolId: string;
  }) => Promise<NativeFaceLivenessResult | void>;
};

interface FaceLivenessWebViewModalProps {
  visible: boolean;
  sessionId: string;
  onSuccess: () => void;
  onCancel: () => void;
  onRetry?: () => void;
  onError?: (message: string) => void;
}

const getNativeModule = (): NativeFaceLivenessModule | null => {
  const mod = NativeModules.HamtechFaceLiveness as NativeFaceLivenessModule | undefined;
  return mod && typeof mod.start === "function" ? mod : null;
};

function nativeModuleMissingMessage() {
  return [
    "Chưa có native module HamtechFaceLiveness trong build này.",
    "Cần thêm bridge Android/Swift dùng AWS Amplify UI Liveness rồi build lại bằng EAS hoặc expo prebuild.",
  ].join(" ");
}

/**
 * FaceLivenessWebViewModal giữ tên cũ để không phải đổi các nơi import, nhưng không còn dùng WebView.
 * Component này gọi native bridge `HamtechFaceLiveness.start(...)`.
 */
export const FaceLivenessWebViewModal = ({
  visible,
  sessionId,
  onSuccess,
  onCancel,
  onRetry,
  onError,
}: FaceLivenessWebViewModalProps) => {
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const activeRunKeyRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onSuccess, onCancel, onError });

  useEffect(() => {
    callbacksRef.current = { onSuccess, onCancel, onError };
  }, [onCancel, onError, onSuccess]);

  const canStart = useMemo(
    () =>
      Boolean(
        visible && sessionId.trim() && env.awsRegion.trim() && env.awsCognitoIdentityPoolId.trim(),
      ),
    [visible, sessionId],
  );

  useEffect(() => {
    if (!visible) {
      setRunning(false);
      setMessage(null);
      activeRunKeyRef.current = null;
      return;
    }

    if (!canStart) {
      const msg = "Thiếu thông tin phiên hoặc cấu hình AWS Face Liveness.";
      setMessage(msg);
      callbacksRef.current.onError?.(msg);
      return;
    }

    const runKey = `${Platform.OS}:${sessionId}`;
    if (activeRunKeyRef.current === runKey) return;

    activeRunKeyRef.current = runKey;
    setRunning(true);
    setMessage("Đang mở xác thực khuôn mặt native...");

    const nativeFaceLiveness = getNativeModule();
    if (!nativeFaceLiveness) {
      const msg = nativeModuleMissingMessage();
      setRunning(false);
      setMessage(msg);
      callbacksRef.current.onError?.(msg);
      return;
    }

    void nativeFaceLiveness
      .start({
        sessionId,
        region: env.awsRegion,
        identityPoolId: env.awsCognitoIdentityPoolId,
      })
      .then((result) => {
        if (activeRunKeyRef.current !== runKey) return;
        setRunning(false);
        if (result?.cancelled) {
          callbacksRef.current.onCancel();
          return;
        }
        callbacksRef.current.onSuccess();
      })
      .catch((error: unknown) => {
        if (activeRunKeyRef.current !== runKey) return;
        const err = error as { code?: string; message?: string };
        setRunning(false);
        if (err.code === "CANCELLED") {
          callbacksRef.current.onCancel();
          return;
        }
        const msg = err.message?.trim() || "Không xác thực được khuôn mặt bằng native liveness.";
        setMessage(msg);
        callbacksRef.current.onError?.(msg);
      });
  }, [canStart, sessionId, visible]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-black/50 px-5">
        <SafeAreaView edges={["top", "bottom"]}>
          <View className="rounded-3xl border border-border bg-card p-5">
            <View className="mb-4 flex-row items-start justify-between gap-4">
              <View className="min-w-0 flex-1">
                <Text className="text-xl font-bold text-foreground">Xác thực khuôn mặt</Text>
                <Text className="mt-1 text-sm leading-5 text-muted-foreground">
                  HamTech sẽ mở trình xác thực native của AWS trên thiết bị.
                </Text>
              </View>
              <Pressable
                onPress={onCancel}
                className="size-10 items-center justify-center rounded-full bg-muted active:opacity-70"
                accessibilityLabel="Đóng xác thực khuôn mặt"
              >
                <Ionicons name="close" size={22} color="hsl(var(--foreground) / 1)" />
              </Pressable>
            </View>

            <View className="items-center rounded-2xl bg-muted/40 px-4 py-6">
              {running ? (
                <ActivityIndicator size="large" color="hsl(var(--primary) / 1)" />
              ) : (
                <View className="size-14 items-center justify-center rounded-full bg-destructive/10">
                  <Ionicons name="warning-outline" size={28} color="hsl(var(--destructive) / 1)" />
                </View>
              )}
              <Text className="mt-4 text-center text-sm leading-5 text-muted-foreground">
                {message || "Đang chuẩn bị xác thực..."}
              </Text>
            </View>

            {!running ? (
              <View className="mt-4 flex-row gap-3">
                <Pressable
                  onPress={onRetry ?? onCancel}
                  className="flex-1 items-center rounded-2xl bg-primary px-4 py-3 active:opacity-80"
                >
                  <Text className="font-semibold text-primary-foreground">Thử lại</Text>
                </Pressable>
                <Pressable
                  onPress={onCancel}
                  className="flex-1 items-center rounded-2xl bg-muted px-4 py-3 active:opacity-80"
                >
                  <Text className="font-semibold text-foreground">Quay lại</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
