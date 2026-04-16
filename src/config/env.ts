import Constants from "expo-constants";
import { Platform } from "react-native";

type ExtraConfig = {
  apiBaseUrl?: string;
  socketUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const resolveDevServerHost = (): string | null => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    return null;
  }

  return hostUri.split(":")[0] ?? null;
};

const resolvedHost = resolveDevServerHost();
const localhostFallback = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const defaultHost = resolvedHost ?? localhostFallback;

export const env = {
  apiBaseUrl: extra.apiBaseUrl ?? `http://${defaultHost}:3000/api/v1`,
  socketUrl: extra.socketUrl ?? `http://${defaultHost}:3000`,
};
