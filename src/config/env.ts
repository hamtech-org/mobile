import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
  socketUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

export const env = {
  apiBaseUrl: extra.apiBaseUrl ?? "http://localhost:3000/api/v1",
  socketUrl: extra.socketUrl ?? "http://localhost:3000",
};
