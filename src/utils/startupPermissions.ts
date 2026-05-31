import { Audio } from "expo-av";
import { Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { PermissionsAndroid, Platform } from "react-native";

import { requestNotificationPermissionAsync } from "@/utils/notificationPermission";

let startupPermissionsRequest: Promise<void> | null = null;

type AndroidPermission = Parameters<typeof PermissionsAndroid.check>[0];
type AndroidPermissionResultMap = Partial<Record<AndroidPermission, string>>;

type StartupPermissionResult = {
  camera: boolean;
  microphone: boolean;
  photosAndVideos: boolean;
  musicAndAudio: boolean;
  notifications: boolean;
};

const DEFAULT_RESULT: StartupPermissionResult = {
  camera: false,
  microphone: false,
  photosAndVideos: false,
  musicAndAudio: false,
  notifications: false,
};

function getAndroidApiLevel(): number {
  return typeof Platform.Version === "number"
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10);
}

async function isAndroidPermissionGranted(permission: AndroidPermission): Promise<boolean> {
  return PermissionsAndroid.check(permission);
}

async function requestAndroidStartupPermissions(): Promise<
  Omit<StartupPermissionResult, "notifications">
> {
  const apiLevel = getAndroidApiLevel();
  const permissions: AndroidPermission[] = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ];

  if (apiLevel >= 33) {
    permissions.push(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
    );
  } else {
    permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
  }

  const missing: AndroidPermission[] = [];
  for (const permission of permissions) {
    if (!(await isAndroidPermissionGranted(permission))) {
      missing.push(permission);
    }
  }

  const requested =
    missing.length > 0
      ? ((await PermissionsAndroid.requestMultiple(missing)) as AndroidPermissionResultMap)
      : undefined;

  const isGranted = async (permission: AndroidPermission): Promise<boolean> => {
    if (requested?.[permission] != null) {
      return requested[permission] === PermissionsAndroid.RESULTS.GRANTED;
    }
    return isAndroidPermissionGranted(permission);
  };

  const photosAndVideos =
    apiLevel >= 33
      ? (await isGranted(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES)) &&
        (await isGranted(PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO))
      : await isGranted(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);

  const musicAndAudio =
    apiLevel >= 33
      ? await isGranted(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO)
      : photosAndVideos;

  return {
    camera: await isGranted(PermissionsAndroid.PERMISSIONS.CAMERA),
    microphone: await isGranted(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
    photosAndVideos,
    musicAndAudio,
  };
}

async function requestIosStartupPermissions(): Promise<
  Omit<StartupPermissionResult, "notifications">
> {
  const [cameraExisting, microphoneExisting, mediaExisting] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Audio.getPermissionsAsync(),
    MediaLibrary.getPermissionsAsync(false, ["photo", "video"]),
  ]);

  const [camera, microphone, media] = await Promise.all([
    cameraExisting.granted ? cameraExisting : Camera.requestCameraPermissionsAsync(),
    microphoneExisting.granted ? microphoneExisting : Audio.requestPermissionsAsync(),
    mediaExisting.granted
      ? mediaExisting
      : MediaLibrary.requestPermissionsAsync(false, ["photo", "video"]),
  ]);

  return {
    camera: Boolean(camera.granted),
    microphone: Boolean(microphone.granted),
    photosAndVideos: Boolean(media.granted),
    musicAndAudio: true,
  };
}

async function requestStartupPermissionsOnce(): Promise<void> {
  if (Platform.OS === "web") return;

  const result: StartupPermissionResult = {
    ...DEFAULT_RESULT,
    notifications: await requestNotificationPermissionAsync(),
  };

  try {
    const runtime =
      Platform.OS === "android"
        ? await requestAndroidStartupPermissions()
        : await requestIosStartupPermissions();
    Object.assign(result, runtime);
  } catch (error) {
    if (__DEV__) {
      console.warn("[StartupPermissions] request failed:", error);
    }
  }

  if (__DEV__) {
    console.log("[StartupPermissions] request result:", result);
  }
}

export function requestStartupPermissionsAsync(): Promise<void> {
  startupPermissionsRequest ??= requestStartupPermissionsOnce().finally(() => {
    startupPermissionsRequest = null;
  });
  return startupPermissionsRequest;
}
