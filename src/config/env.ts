import Constants from "expo-constants";
import { Platform } from "react-native";

type ExtraConfig = {
  apiBaseUrl?: string;
  socketUrl?: string;
  agoraAppId?: string;
  awsCognitoIdentityPoolId?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

const resolveDevServerHost = (): string | null => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    return null;
  }
  return hostUri.split(":")[0] ?? null;
};

/** Bỏ hậu tố /api/v1 để suy ra origin socket khi chỉ cấu hình API. */
function socketOriginFromApiBase(apiBaseUrl: string): string {
  try {
    const u = new URL(apiBaseUrl);
    const path = u.pathname.replace(/\/api\/v1\/?$/i, "");
    u.pathname = path === "" ? "/" : path;
    const origin = u.origin;
    if (u.pathname === "/" || u.pathname === "") {
      return origin;
    }
    return `${origin}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return apiBaseUrl.replace(/\/api\/v1\/?$/i, "").replace(/\/$/, "") || apiBaseUrl;
  }
}

const localhostFallback = Platform.OS === "android" ? "10.0.2.2" : "localhost";
const resolvedHost = resolveDevServerHost();
const defaultHost = resolvedHost ?? localhostFallback;

const explicitApi =
  (typeof extra.apiBaseUrl === "string" && extra.apiBaseUrl.trim()) ||
  (typeof process.env.EXPO_PUBLIC_API_BASE_URL === "string" &&
    process.env.EXPO_PUBLIC_API_BASE_URL.trim()) ||
  (typeof process.env.EXPO_API_BASE_URL === "string" && process.env.EXPO_API_BASE_URL.trim()) ||
  (typeof process.env.EXPO_PUBLIC_API_URL === "string" && process.env.EXPO_PUBLIC_API_URL.trim()) ||
  "";

const explicitSocket =
  (typeof extra.socketUrl === "string" && extra.socketUrl.trim()) ||
  (typeof process.env.EXPO_PUBLIC_SOCKET_URL === "string" &&
    process.env.EXPO_PUBLIC_SOCKET_URL.trim()) ||
  (typeof process.env.EXPO_SOCKET_URL === "string" && process.env.EXPO_SOCKET_URL.trim()) ||
  "";

const useDevAuto = __DEV__ || Boolean(Constants.expoConfig?.hostUri);

const devApiBase = `http://${defaultHost}:3000/api/v1`;
const devSocket = `http://${defaultHost}:3000`;

const apiBaseUrl = explicitApi || devApiBase;
const socketUrl =
  explicitSocket || (explicitApi ? socketOriginFromApiBase(explicitApi) : devSocket);

const agoraFromEnv =
  (typeof process.env.EXPO_PUBLIC_AGORA_APP_ID === "string" &&
    process.env.EXPO_PUBLIC_AGORA_APP_ID.trim()) ||
  "";
const agoraAppId =
  (typeof extra.agoraAppId === "string" && extra.agoraAppId.trim()) || agoraFromEnv;

const awsCognitoIdentityPoolId =
  (typeof extra.awsCognitoIdentityPoolId === "string" && extra.awsCognitoIdentityPoolId.trim()) ||
  (typeof process.env.EXPO_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID === "string" &&
    process.env.EXPO_PUBLIC_AWS_COGNITO_IDENTITY_POOL_ID.trim()) ||
  (typeof process.env.EXPO_AWS_COGNITO_IDENTITY_POOL_ID === "string" &&
    process.env.EXPO_AWS_COGNITO_IDENTITY_POOL_ID.trim()) ||
  (typeof process.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID === "string" &&
    process.env.VITE_AWS_COGNITO_IDENTITY_POOL_ID.trim()) ||
  "us-east-1:93d5a993-ce60-4eb7-82d7-daee331ea66f";

const awsRegion =
  (typeof process.env.EXPO_PUBLIC_AWS_REGION === "string" &&
    process.env.EXPO_PUBLIC_AWS_REGION.trim()) ||
  (typeof process.env.EXPO_AWS_REGION === "string" && process.env.EXPO_AWS_REGION.trim()) ||
  (typeof process.env.VITE_AWS_REGION === "string" && process.env.VITE_AWS_REGION.trim()) ||
  "us-east-1";

const publicWebOrigin =
  (typeof process.env.EXPO_PUBLIC_WEB_ORIGIN === "string" &&
    process.env.EXPO_PUBLIC_WEB_ORIGIN.trim()) ||
  "";

export const env = {
  apiBaseUrl,
  socketUrl,
  host: defaultHost,
  agoraAppId,
  awsRegion,
  awsCognitoIdentityPoolId,
  /** Domain web cho link mời nhóm (copy/chia sẻ), vd. https://hamtech.app */
  publicWebOrigin,
  hasReleaseBackendUrl: useDevAuto || Boolean(explicitApi),
};

if (__DEV__) {
  // Kiểm tra Metro log: máy thật không dùng được 10.0.2.2 / localhost nếu thiếu .env
  console.log("[env] apiBaseUrl:", apiBaseUrl);
  console.log("[env] socketUrl:", socketUrl);
  if (
    Platform.OS === "android" &&
    Constants.isDevice &&
    !explicitApi &&
    (apiBaseUrl.includes("10.0.2.2") || apiBaseUrl.includes("localhost"))
  ) {
    console.warn(
      "[env] Máy Android thật cần EXPO_PUBLIC_API_BASE_URL trong mobile/.env (ngrok hoặc IP LAN), sau đó chạy: npx expo start -c",
    );
  }
}
