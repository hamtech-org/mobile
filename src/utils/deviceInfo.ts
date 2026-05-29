import { Platform } from "react-native";

type PlatformConstants = typeof Platform.constants & {
  Brand?: string;
  Manufacturer?: string;
  Model?: string;
  Release?: string;
  osVersion?: string;
  systemName?: string;
  interfaceIdiom?: string;
};

export type MobileDeviceInfo = {
  source: "mobile";
  os: string;
  osVersion?: string;
  deviceName: string;
  model?: string;
  brand?: string;
  manufacturer?: string;
  appClient: string;
};

function clean(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getMobileDeviceInfo(): MobileDeviceInfo {
  const constants = Platform.constants as PlatformConstants;

  if (Platform.OS === "android") {
    const brand = clean(constants.Brand);
    const manufacturer = clean(constants.Manufacturer);
    const model = clean(constants.Model);
    const osVersion = clean(constants.Release) ?? String(Platform.Version);
    const deviceName = [brand, model].filter(Boolean).join(" ") || model || "Android device";

    return {
      source: "mobile",
      os: "Android",
      osVersion,
      deviceName,
      model,
      brand,
      manufacturer,
      appClient: "HamTech Mobile",
    };
  }

  if (Platform.OS === "ios") {
    const idiom = clean(constants.interfaceIdiom);
    const deviceName = Platform.isPad ? "iPad" : idiom === "phone" ? "iPhone" : "iOS device";

    return {
      source: "mobile",
      os: "iOS",
      osVersion: clean(constants.osVersion) ?? String(Platform.Version),
      deviceName,
      appClient: "HamTech Mobile",
    };
  }

  return {
    source: "mobile",
    os: Platform.OS,
    osVersion: String(Platform.Version),
    deviceName: `${Platform.OS} device`,
    appClient: "HamTech Mobile",
  };
}

export function getMobileDeviceInfoHeader(): string {
  return JSON.stringify(getMobileDeviceInfo());
}
