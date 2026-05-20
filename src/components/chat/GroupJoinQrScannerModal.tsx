import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, QrCode } from "lucide-react-native";

import { extractJoinSuffixFromText } from "@/utils/groupJoinLinkMessage";
import { toast } from "@/utils/appToast";

type Props = {
  visible: boolean;
  onClose: () => void;
  onScannedSuffix: (suffix: string) => void;
};

export function GroupJoinQrScannerModal({ visible, onClose, onScannedSuffix }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [requesting, setRequesting] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      handledRef.current = false;
      return;
    }
    if (permission?.granted || permission?.canAskAgain === false) return;
    setRequesting(true);
    void requestPermission().finally(() => setRequesting(false));
  }, [visible, permission?.granted, permission?.canAskAgain, requestPermission]);

  const handleBarcode = useCallback(
    ({ data }: { data: string }) => {
      if (handledRef.current) return;
      const suffix = extractJoinSuffixFromText(data);
      if (!suffix) {
        toast.error("Mã QR không hợp lệ — cần link mời tham gia nhóm HamTech");
        return;
      }
      handledRef.current = true;
      onScannedSuffix(suffix);
    },
    [onScannedSuffix],
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
            {requesting || !permission ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <QrCode size={48} color="#fff" strokeWidth={1.5} />
                <Text style={styles.permissionTitle}>Cần quyền camera</Text>
                <Text style={styles.permissionHint}>
                  Cho phép truy cập camera để quét mã QR tham gia nhóm.
                </Text>
                {permission.canAskAgain ? (
                  <Pressable
                    style={styles.permissionBtn}
                    onPress={() => {
                      setRequesting(true);
                      void requestPermission().finally(() => setRequesting(false));
                    }}
                  >
                    <Text style={styles.permissionBtnText}>Cho phép camera</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.permissionHint}>
                    Vào Cài đặt thiết bị để bật quyền camera cho ứng dụng.
                  </Text>
                )}
              </>
            )}
          </View>
        )}

        <SafeAreaView style={styles.overlay} edges={["top", "bottom"]} pointerEvents="box-none">
          <View style={styles.topBar}>
            <Pressable
              style={styles.backBtn}
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Đóng"
            >
              <ArrowLeft size={22} color="#fff" strokeWidth={2} />
            </Pressable>
            <Text style={styles.title}>Quét mã QR tham gia nhóm</Text>
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
