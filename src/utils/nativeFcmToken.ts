import { NativeModules } from "react-native";

interface HamtechFcmTokenModule {
  getToken?: () => Promise<string>;
}

interface RnfbMessagingModule {
  [key: string]: unknown;
}

function getHamtechFcmTokenModule(): HamtechFcmTokenModule | undefined {
  return NativeModules.HamtechFcmToken as HamtechFcmTokenModule | undefined;
}

function getRnfbMessagingModule(): RnfbMessagingModule | undefined {
  return NativeModules.RNFBMessagingModule as RnfbMessagingModule | undefined;
}

export function getNativeMessagingDebugInfo(): string {
  const rnfbMessaging = getRnfbMessagingModule();
  const rnfbKeys = rnfbMessaging ? Object.keys(rnfbMessaging).sort() : [];
  const hamtechFcm = getHamtechFcmTokenModule();
  const hamtechKeys = hamtechFcm ? Object.keys(hamtechFcm).sort() : [];

  return `RNFBMessagingModule keys=${
    rnfbKeys.length > 0 ? rnfbKeys.join(",") : "none"
  }; HamtechFcmToken keys=${hamtechKeys.length > 0 ? hamtechKeys.join(",") : "none"}`;
}

export async function getNativeFcmTokenFallbackAsync(): Promise<string | null> {
  const tokenModule = getHamtechFcmTokenModule();
  if (typeof tokenModule?.getToken !== "function") {
    console.warn("[PushToken] HamtechFcmToken native module is not available.");
    return null;
  }

  try {
    const token = await tokenModule.getToken();
    return typeof token === "string" && token.trim() ? token : null;
  } catch (error) {
    console.warn(
      "[PushToken] HamtechFcmToken fallback failed:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}
