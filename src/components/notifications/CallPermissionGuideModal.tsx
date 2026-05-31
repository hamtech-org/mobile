import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, Platform, Linking, StyleSheet } from "react-native";
import notifee from "@notifee/react-native";
import * as Notifications from "expo-notifications";
import {
  canUseFullScreenIntentAsync,
  openFullScreenIntentSettingsAsync,
} from "@/utils/fullScreenIntentPermission";

export function CallPermissionGuideModal() {
  const [visible, setVisible] = useState(false);
  const [fullScreenBlocked, setFullScreenBlocked] = useState(false);
  const [batteryOptimized, setBatteryOptimized] = useState(false);
  const [notificationBlocked, setNotificationBlocked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    void (async () => {
      try {
        const [batteryEnabled, canUseFullScreen, notificationPermission] = await Promise.all([
          notifee.isBatteryOptimizationEnabled(),
          canUseFullScreenIntentAsync(),
          Notifications.getPermissionsAsync(),
        ]);
        const notificationsDenied =
          !notificationPermission.granted && notificationPermission.status !== "granted";
        setBatteryOptimized(batteryEnabled);
        setFullScreenBlocked(!canUseFullScreen);
        setNotificationBlocked(notificationsDenied);

        if (batteryEnabled || !canUseFullScreen || notificationsDenied) {
          setVisible(true);
        }
      } catch (error) {
        console.warn("[PermissionGuide] Failed to check battery optimization:", error);
      }
    })();
  }, []);

  const handleOpenSettings = async () => {
    setVisible(false);
    try {
      if (fullScreenBlocked) {
        await openFullScreenIntentSettingsAsync();
        return;
      }
      if (batteryOptimized) {
        await notifee.openBatteryOptimizationSettings();
        setTimeout(() => {
          void Linking.openSettings();
        }, 1500);
        return;
      }
      await Linking.openSettings();
    } catch (error) {
      console.warn("[PermissionGuide] Failed to open settings:", error);
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Quyền cuộc gọi ngầm & Khóa màn hình</Text>

          <Text style={styles.description}>
            Để nhận cuộc gọi ổn định khi tắt màn hình hoặc khi thoát hoàn toàn ứng dụng (đặc biệt
            trên máy Tecno, Xiaomi, Oppo...), vui lòng thực hiện:
          </Text>

          <View style={styles.stepContainer}>
            {notificationBlocked ? (
              <Text style={styles.stepText}>
                <Text style={styles.boldText}>1. Thông báo:</Text> Bật quyền{" "}
                <Text style={styles.highlightText}>"Cho phép thông báo"</Text> cho Hamtech.
              </Text>
            ) : null}
            {fullScreenBlocked ? (
              <Text style={styles.stepText}>
                <Text style={styles.boldText}>2. Cuộc gọi toàn màn hình:</Text> Bật quyền{" "}
                <Text style={styles.highlightText}>"Thông báo toàn màn hình"</Text> để cuộc gọi có
                thể tự bật khi khóa màn hình.
              </Text>
            ) : null}
            {batteryOptimized ? (
              <>
                <Text style={styles.stepText}>
                  <Text style={styles.boldText}>3. Quản lý pin:</Text> Chọn{" "}
                  <Text style={styles.highlightText}>"Không tối ưu hóa" (Don't optimize)</Text> cho
                  ứng dụng Hamtech.
                </Text>
                <Text style={styles.stepText}>
                  <Text style={styles.boldText}>4. Quyền ứng dụng (Quyền khác):</Text> Cho phép ứng
                  dụng <Text style={styles.highlightText}>"Hiển thị trên màn hình khóa"</Text> và{" "}
                  <Text style={styles.highlightText}>
                    "Khởi chạy trong nền" (Hiển thị pop-up ngầm)
                  </Text>
                  .
                </Text>
              </>
            ) : null}
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity onPress={handleClose} style={[styles.button, styles.cancelButton]}>
              <Text style={styles.cancelButtonText}>Bỏ qua</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenSettings}
              style={[styles.button, styles.primaryButton]}
            >
              <Text style={styles.primaryButtonText}>Cài đặt ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1c1c1e",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 13,
    color: "#6e6e73",
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  stepContainer: {
    backgroundColor: "#f5f5f7",
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  stepText: {
    fontSize: 12,
    color: "#333333",
    lineHeight: 18,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: "600",
    color: "#1c1c1e",
  },
  highlightText: {
    color: "#0068FF",
    fontWeight: "600",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#eaeaea",
  },
  cancelButtonText: {
    color: "#555555",
    fontWeight: "600",
    fontSize: 13,
  },
  primaryButton: {
    backgroundColor: "#0068FF",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 13,
  },
});
