import { NativeModules, Platform } from "react-native";

interface FullScreenIntentNativeModule {
  canUseFullScreenIntent?: () => Promise<boolean>;
  openSettings?: () => Promise<boolean>;
}

const nativeModule = NativeModules.HamtechFullScreenIntent as
  | FullScreenIntentNativeModule
  | undefined;

export async function canUseFullScreenIntentAsync(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  if (!nativeModule?.canUseFullScreenIntent) return true;
  try {
    return await nativeModule.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

export async function openFullScreenIntentSettingsAsync(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (nativeModule?.openSettings) {
    await nativeModule.openSettings();
    return;
  }
}
