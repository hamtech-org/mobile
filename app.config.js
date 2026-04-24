/* eslint-disable @typescript-eslint/no-require-imports */
const appJson = require("./app.json");

/**
 * Hợp nhất `app.json` với biến môi trường (EAS Secrets / .env) cho bản build release/preview.
 * - EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_SOCKET_URL
 * - EXPO_PUBLIC_AGORA_APP_ID (hoặc dùng extra trong app.json)
 */
module.exports = () => {
  const extra = { ...(appJson.expo.extra || {}) };
  if (process.env.EXPO_PUBLIC_AGORA_APP_ID) {
    extra.agoraAppId = process.env.EXPO_PUBLIC_AGORA_APP_ID;
  }
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    extra.apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    extra.socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;
  }
  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      extra,
    },
  };
};
