import Constants from "expo-constants";

/**
 * Remote push (FCM/APNs via Expo) không chạy trên Expo Go từ SDK 53+.
 * Cần development build: `npx expo run:android` / EAS build.
 */
export function isRemotePushSupported(): boolean {
  return Constants.appOwnership !== "expo";
}
