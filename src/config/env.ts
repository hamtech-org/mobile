import Constants from "expo-constants";
import { Platform } from "react-native";

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
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? `http://${defaultHost}:3000/api/v1`,
  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? `http://${defaultHost}:3000`,
  host: defaultHost,
};
