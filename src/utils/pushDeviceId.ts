import AsyncStorage from "@react-native-async-storage/async-storage";

const PUSH_DEVICE_ID_KEY = "hamtech:push-device-id";

function createDeviceId(): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `rn-${Date.now().toString(36)}-${random}`;
}

export async function getStablePushDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(PUSH_DEVICE_ID_KEY);
  if (existing?.trim()) return existing;
  const next = createDeviceId();
  await AsyncStorage.setItem(PUSH_DEVICE_ID_KEY, next);
  return next;
}
