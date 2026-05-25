import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, QrCode } from "lucide-react-native";

import { extractJoinSuffixFromText } from "@/utils/groupJoinLinkMessage";
import { tryParseUserQrPayload, type UserQrPayload } from "@/utils/userQrPayload";
import { toast } from "@/utils/appToast";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScannedSuffix: (suffix: string) => void;
  onScannedUser?: (user: UserQrPayload) => void;
};

export function GroupJoinQrScannerModal({
  visible,
  onClose,
  onScannedSuffix,
  onScannedUser,
}: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);
  const handledRef = useRef(false);
  const requestedOnOpenRef = useRef(false);

  const askCameraPermission = useCallback(async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const nextPermission = await requestPermission();
      if (!nextPermission.granted && nextPermission.canAskAgain === false) {
        toast.error("Vui long bat quyen camera trong Cai dat thiet bi.");
      }
    } finally {
      setRequesting(false);
    }
  }, [requestPermission, requesting]);

  useEffect(() => {
    if (!visible) {
      handledRef.current = false;
      requestedOnOpenRef.current = false;
      return;
    }
    if (permission?.granted || permission?.canAskAgain === false || requestedOnOpenRef.current) {
      return;
    }
    requestedOnOpenRef.current = true;
    void askCameraPermission();
  }, [visible, permission?.granted, permission?.canAskAgain, askCameraPermission]);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (handledRef.current) return;

      const user = tryParseUserQrPayload(data);
      if (user) {
        handledRef.current = true;
        onScannedUser?.(user);
        return;
      }

      const suffix = extractJoinSuffixFromText(data);
      if (!suffix) {
        toast.error("Mã qr không hợp lệ.");
        return;
      }

      handledRef.current = true;
      onScannedSuffix(suffix);
    },
    [onScannedSuffix, onScannedUser],
  );

  const showCamera = Boolean(permission?.granted);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {showCamera ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcode}
          />
        ) : (
          <View style={styles.permissionFallback}>
            <QrCode size={48} color="#fff" strokeWidth={1.5} />
            <Text style={styles.permissionTitle}>Cần quyền camera</Text>
            <Text style={styles.permissionHint}>
              Cho phép truy cập camera để quét mã QR HamTech.
            </Text>
            {requesting ? <ActivityIndicator size="small" color="#fff" /> : null}
            {permission?.canAskAgain === false ? (
              <>
                <Text style={styles.permissionHint}>
                  Cài đặt thiết bị để bật quyền camera cho ứng dụng.
                </Text>
                <Pressable style={styles.permissionBtn} onPress={() => void Linking.openSettings()}>
                  <Text style={styles.permissionBtnText}>Mở Cài đặt</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.permissionBtn, requesting && styles.permissionBtnDisabled]}
                onPress={() => void askCameraPermission()}
                disabled={requesting}
              >
                <Text style={styles.permissionBtnText}>
                  {requesting ? "Đang xin quyền..." : "Cho phép camera"}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <SafeAreaView style={styles.overlay} edges={["top", "bottom"]} pointerEvents="box-none">
          <View style={styles.topBar}>
            <Pressable
              style={styles.backBtn}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Dong"
            >
              <ArrowLeft size={22} color="#fff" strokeWidth={2} />
            </Pressable>
            <Text style={styles.title}>Quét mã QR HamTech</Text>
            <View style={styles.backBtnPlaceholder} />
          </View>

          {showCamera ? (
            <View style={styles.hintWrap} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>Đưa mã QR vào khung hình</Text>
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const FRAME = 248;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
    backgroundColor: "#111827",
  },
  permissionTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  permissionHint: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
  permissionBtn: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#0068FF",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  permissionBtnDisabled: {
    opacity: 0.65,
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnPlaceholder: {
    width: 44,
    height: 44,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  hintWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  frame: {
    width: FRAME,
    height: FRAME,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "transparent",
  },
  hint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
});
