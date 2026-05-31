import { NativeModules } from "react-native";

interface NativeFirebaseAppEntry {
  appConfig?: {
    name?: unknown;
  };
  name?: unknown;
  options?: {
    appId?: unknown;
    projectId?: unknown;
  };
}

function getRnfbAppModule(): { NATIVE_FIREBASE_APPS?: unknown } | undefined {
  return NativeModules.RNFBAppModule as { NATIVE_FIREBASE_APPS?: unknown } | undefined;
}

export function getNativeFirebaseApps(): NativeFirebaseAppEntry[] {
  const nativeApps = getRnfbAppModule()?.NATIVE_FIREBASE_APPS;
  return Array.isArray(nativeApps) ? (nativeApps as NativeFirebaseAppEntry[]) : [];
}

export function getNativeFirebaseAppCount(): number {
  return getNativeFirebaseApps().length;
}

export function getNativeFirebaseAppsDebugInfo(): string {
  const nativeApps = getNativeFirebaseApps();

  if (nativeApps.length === 0) return "count=0";

  const names = nativeApps.map((app) => {
    const name = app.appConfig?.name ?? app.name;
    return typeof name === "string" ? name : "unknown";
  });

  const projectIds = nativeApps
    .map((app) => app.options?.projectId)
    .filter((projectId): projectId is string => typeof projectId === "string");

  return `count=${nativeApps.length}, names=${names.join(",")}, projectIds=${
    projectIds.length > 0 ? projectIds.join(",") : "none"
  }`;
}
