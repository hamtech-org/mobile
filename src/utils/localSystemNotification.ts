import { AppState, Platform } from "react-native";

import type { INotificationRouteData } from "@/types/notification.types";
import { pickActorAvatarFromData } from "@/utils/notificationAvatar";
import { buildAvatarNotificationFieldsSync } from "@/utils/notificationAvatarCache";
import {
  NOTIFICATION_ACTION,
  shouldSuppressRemotePushInForeground,
  type SystemNotificationCategory,
} from "@/utils/notificationRegistry";
import {
  cancelNotifeeNotification,
  ensureNotifeeNotificationInfrastructure,
  showNotifeeSystemNotification,
} from "@/utils/notifeeSystemNotification";
import { sanitizeNotificationText } from "@/utils/systemNotificationLayout";

/** Màu accent giống Zalo trên thanh thông báo Android. */
const ZALO_ACCENT = "#0068FF";
const FALLBACK_SENDER = "Tin nhắn mới";
const CATEGORY_SOCIAL: SystemNotificationCategory = "hamtech_social";

/** Đánh dấu thông báo tạo từ socket — không trùng với Expo push từ server. */
export const NOTIFICATION_DELIVERY_SOCKET = "socket";

const notifiedMessageIds = new Map<string, number>();
const MESSAGE_NOTIFY_TTL_MS = 60_000;

export type SystemNotificationChannel = "messages" | "calls" | "social" | "default";

export interface LocalSystemNotificationInput {
  title: string;
  body: string;
  channel?: SystemNotificationChannel;
  avatarUrl?: string | null;
  subtitle?: string | null;
  categoryIdentifier?: SystemNotificationCategory;
  notificationId?: string;
  data?: INotificationRouteData & Record<string, unknown>;
}

let channelsReady: Promise<void> | null = null;
let categoriesReady: Promise<void> | null = null;
let handlerReady = false;
const recentKeys = new Map<string, number>();
const DEDUPE_MS = 1200;

function buildDedupeKey(input: LocalSystemNotificationInput): string {
  const route = String(input.data?.route ?? "");
  const id = String(input.data?.id ?? input.data?.entityId ?? "");
  const messageId = String(input.data?.messageId ?? input.notificationId ?? "");
  if (messageId) {
    return `msg|${messageId}`;
  }
  return `${input.channel ?? "default"}|${route}|${id}|${input.title}|${input.body}`;
}

function isMessageAlreadyNotified(messageId: string): boolean {
  const mid = messageId.trim();
  if (!mid) return false;
  const now = Date.now();
  const prev = notifiedMessageIds.get(mid);
  if (prev != null && now - prev < MESSAGE_NOTIFY_TTL_MS) return true;
  notifiedMessageIds.set(mid, now);
  if (notifiedMessageIds.size > 300) {
    notifiedMessageIds.forEach((ts, k) => {
      if (now - ts > MESSAGE_NOTIFY_TTL_MS) notifiedMessageIds.delete(k);
    });
  }
  return false;
}

function isDuplicate(key: string): boolean {
  const now = Date.now();
  const prev = recentKeys.get(key);
  if (prev != null && now - prev < DEDUPE_MS) return true;
  recentKeys.set(key, now);
  if (recentKeys.size > 150) {
    recentKeys.forEach((ts, k) => {
      if (now - ts > 60_000) recentKeys.delete(k);
    });
  }
  return false;
}

function categoryForChannel(
  channel: SystemNotificationChannel,
  explicit?: SystemNotificationCategory,
): SystemNotificationCategory | undefined {
  if (explicit) return explicit;
  if (channel === "messages") return "hamtech_message";
  if (channel === "social") return CATEGORY_SOCIAL;
  return undefined;
}

function enrichNotificationData(
  base: LocalSystemNotificationInput["data"],
  avatarUrl?: string | null,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(base ?? {}) };
  const source = avatarUrl ?? pickActorAvatarFromData(merged) ?? null;
  return { ...merged, ...buildAvatarNotificationFieldsSync(source) };
}

/** Xin quyền thông báo hệ thống (Android 13+). */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const Notifications = await import("expo-notifications");
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    return status === "granted";
  } catch {
    return false;
  }
}

/** Đăng ký category + action (Trả lời) — giống Zalo messaging notification. */
export async function ensureNotificationCategories(): Promise<void> {
  if (categoriesReady) return categoriesReady;

  categoriesReady = (async () => {
    try {
      const Notifications = await import("expo-notifications");
      const messageActions = [
        {
          identifier: NOTIFICATION_ACTION.REPLY,
          buttonTitle: "Trả lời",
          options: { opensAppToForeground: false },
          textInput: { submitButtonTitle: "Gửi", placeholder: "Nhập tin nhắn..." },
        },
      ];
      const callActions = [
        {
          identifier: NOTIFICATION_ACTION.DECLINE,
          buttonTitle: "Từ chối",
          options: { opensAppToForeground: true },
        },
        {
          identifier: NOTIFICATION_ACTION.ANSWER,
          buttonTitle: "Trả lời",
          options: { opensAppToForeground: true },
        },
      ];
      const missedCallActions = [
        {
          identifier: NOTIFICATION_ACTION.MESSAGE,
          buttonTitle: "Nhắn tin",
          options: { opensAppToForeground: true },
        },
        {
          identifier: NOTIFICATION_ACTION.CALLBACK,
          buttonTitle: "Gọi lại",
          options: { opensAppToForeground: true },
        },
      ];
      await Notifications.setNotificationCategoryAsync("hamtech_message", messageActions, {
        previewPlaceholder: "Trả lời",
      });
      await Notifications.setNotificationCategoryAsync("hamtech_call_direct", callActions, {});
      await Notifications.setNotificationCategoryAsync("hamtech_call_group", callActions, {});
      await Notifications.setNotificationCategoryAsync(
        "hamtech_call_missed",
        missedCallActions,
        {},
      );
      await Notifications.setNotificationCategoryAsync(CATEGORY_SOCIAL, [], {});
    } catch {
      /* ignore */
    }
  })();

  return categoriesReady;
}

/** Gọi sớm khi vào app — kênh + hiển thị thông báo khi app đang mở. */
export async function initSystemNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await import("expo-notifications");
    if (!handlerReady) {
      handlerReady = true;
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const data = notification.request.content.data as Record<string, unknown> | undefined;
          const delivery = String(data?.deliverySource ?? "");
          const route = String(data?.route ?? "");
          const kind = String(data?.notificationKind ?? "");

          const isForeground = AppState.currentState === "active";
          const isSocketLocal = delivery === NOTIFICATION_DELIVERY_SOCKET;
          const suppressRemote =
            isForeground &&
            !isSocketLocal &&
            (shouldSuppressRemotePushInForeground(kind) || (route === "chat" && !kind));

          if (suppressRemote) {
            return {
              shouldPlaySound: false,
              shouldSetBadge: false,
              shouldShowBanner: false,
              shouldShowList: false,
            };
          }

          return {
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        },
      });
    }
    await ensureSystemNotificationChannels();
    await ensureNotificationCategories();
    await ensureNotifeeNotificationInfrastructure();
  } catch {
    /* ignore */
  }
}

/** Kênh Android — nền sáng, rung nhẹ, accent xanh Zalo (Material). */
export async function ensureSystemNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (channelsReady) return channelsReady;

  channelsReady = (async () => {
    const Notifications = await import("expo-notifications");
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Tin nhắn",
      description: "Tin nhắn 1-1 và nhóm",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 120, 80, 120],
      lightColor: ZALO_ACCENT,
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync("calls", {
      name: "Cuộc gọi",
      description: "Cuộc gọi đến 1-1 và nhóm",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: ZALO_ACCENT,
      sound: "default",
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync("social", {
      name: "Hoạt động",
      description: "Bạn bè, bảng tin, live",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
      lightColor: ZALO_ACCENT,
      sound: "default",
      enableVibrate: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync("default", {
      name: "Thông báo",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: ZALO_ACCENT,
      sound: "default",
    });
  })();

  return channelsReady;
}

/**
 * Thông báo hệ thống — avatar tải sẵn + MessagingStyle (Android).
 */
export async function showLocalSystemNotification(
  input: LocalSystemNotificationInput,
): Promise<void> {
  if (Platform.OS === "web") return;

  const messageId = String(input.data?.messageId ?? input.notificationId ?? "").replace(
    /^msg-/,
    "",
  );
  if (messageId && isMessageAlreadyNotified(messageId)) return;

  const dedupeKey = buildDedupeKey(input);
  if (isDuplicate(dedupeKey)) return;

  try {
    const channel: SystemNotificationChannel = input.channel ?? "default";
    const channelId =
      channel === "messages"
        ? "messages"
        : channel === "calls"
          ? "calls"
          : channel === "social"
            ? "social"
            : "default";

    const title = sanitizeNotificationText(input.title, FALLBACK_SENDER);
    const body = sanitizeNotificationText(input.body, title);
    if (!body && !title) return;

    const notificationData = enrichNotificationData(input.data, input.avatarUrl);
    notificationData.deliverySource =
      (input.data?.deliverySource as string | undefined) ?? NOTIFICATION_DELIVERY_SOCKET;
    const categoryIdentifier = categoryForChannel(channel, input.categoryIdentifier);
    const subtitle = input.subtitle?.trim() || undefined;

    console.log(
      `[LocalNotif] showLocalSystemNotification triggered. Title: "${title}", Body: "${body}", Channel: ${channel}, AvatarUrl: ${input.avatarUrl}`,
    );

    const displayedByNotifee = await showNotifeeSystemNotification({
      ...input,
      title,
      body: body || title,
      subtitle,
      channel,
      categoryIdentifier,
      data: notificationData as LocalSystemNotificationInput["data"],
    });

    console.log(`[LocalNotif] displayedByNotifee result: ${displayedByNotifee}`);
    if (displayedByNotifee) return;

    console.log("[LocalNotif] Falling back to Expo Notifications...");
    const granted = await ensureNotificationPermission();
    if (!granted) {
      console.log("[LocalNotif] Notification permission not granted, cannot fallback.");
      return;
    }

    const Notifications = await import("expo-notifications");
    await ensureSystemNotificationChannels();
    await ensureNotificationCategories();

    await Notifications.scheduleNotificationAsync({
      identifier: input.notificationId,
      content: {
        title,
        body: body || title,
        ...(subtitle ? { subtitle } : {}),
        categoryIdentifier,
        data: notificationData,
        sound: "default",
        ...(Platform.OS === "android"
          ? {
              channelId,
              color: ZALO_ACCENT,
              priority:
                channel === "calls"
                  ? Notifications.AndroidNotificationPriority.MAX
                  : Notifications.AndroidNotificationPriority.HIGH,
              sticky: channel === "calls",
              autoDismiss: channel !== "calls",
            }
          : {}),
      },
      trigger: null,
    });
  } catch (e) {
    if (__DEV__) {
      console.warn("[localSystemNotification] schedule failed:", e);
    }
  }
}

export async function dismissCallSystemNotification(channelName: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await cancelNotifeeNotification(`call-${channelName}`);
    const Notifications = await import("expo-notifications");
    await Notifications.dismissNotificationAsync(`call-${channelName}`);
  } catch {
    /* ignore */
  }
}
