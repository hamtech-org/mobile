import * as Notifications from "expo-notifications";
import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

let settingsPromptShown = false;

async function requestAndroidPostNotifications(): Promise<boolean> {
  if (Platform.OS !== "android" || Platform.Version < 33) {
    return true;
  }
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Bật thông báo",
        message: "HamTech cần quyền thông báo để hiện tin nhắn và cuộc gọi.",
        buttonPositive: "Cho phép",
        buttonNegative: "Từ chối",
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function promptOpenSettingsIfNeeded(granted: boolean, canAskAgain: boolean | undefined): void {
  if (granted || canAskAgain !== false || settingsPromptShown) return;
  settingsPromptShown = true;
  Alert.alert(
    "Bật thông báo",
    "Ứng dụng cần quyền thông báo để hiện tin nhắn và cuộc gọi. Vui lòng bật trong Cài đặt.",
    [
      { text: "Để sau", style: "cancel" },
      {
        text: "Mở Cài đặt",
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ],
  );
}

/**
 * Xin quyền POST_NOTIFICATIONS (Android 13+) / iOS alert.
 * Gọi sớm khi vào (main) — không chờ đến lúc có tin mới.
 */
export async function requestNotificationPermissionAsync(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted || existing.status === "granted") {
      return true;
    }

    if (Platform.OS === "android") {
      const androidGranted = await requestAndroidPostNotifications();
      if (androidGranted) {
        const after = await Notifications.getPermissionsAsync();
        if (after.granted || after.status === "granted") {
          return true;
        }
      }
    }

    const result = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });

    const granted = Boolean(result.granted ?? result.status === "granted");
    if (__DEV__) {
      console.log("[NotifPermission] request result:", {
        status: result.status,
        granted: result.granted,
        canAskAgain: result.canAskAgain,
      });
    }

    promptOpenSettingsIfNeeded(granted, result.canAskAgain);
    return granted;
  } catch (error) {
    if (__DEV__) {
      console.warn("[NotifPermission] request failed:", error);
    }
    return false;
  }
}
