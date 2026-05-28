import * as Notifications from "expo-notifications";
import { NativeModules, Platform } from "react-native";

import type { INotificationRouteData } from "@/types/notification.types";
import { ensureExpoNotificationHandlerInstalled } from "@/utils/notificationExpoHandler";
import { pickActorAvatarFromData } from "@/utils/notificationAvatar";
import {
  buildAvatarNotificationFieldsSync,
  cacheNotificationAvatarForNative,
  readCachedNotificationAvatarBase64,
} from "@/utils/notificationAvatarCache";
import { subscribeHamtechNotificationActions } from "@/utils/hamtechNotificationActions";
import { requestNotificationPermissionAsync } from "@/utils/notificationPermission";
import { isRemotePushSupported } from "@/utils/pushNotificationsSupport";
import {
  CALL_NOTIFICATION_SOUND,
  CALLS_NOTIFICATION_CHANNEL_ID,
} from "@/utils/notificationConstants";
import { NOTIFICATION_ACTION, type SystemNotificationCategory } from "@/utils/notificationRegistry";
import { sanitizeNotificationText } from "@/utils/systemNotificationLayout";

/** Màu accent giống Zalo trên thanh thông báo Android. */
const ZALO_ACCENT = "#0068FF";
const FALLBACK_SENDER = "Tin nhắn mới";
const CATEGORY_SOCIAL: SystemNotificationCategory = "hamtech_social";

/** Đánh dấu thông báo tạo từ socket — không trùng với Expo push từ server. */
export const NOTIFICATION_DELIVERY_SOCKET = "socket";
/** Đánh dấu banner gộp sau khi nhận Expo push (hiển thị 1 banner / hội thoại). */
export const NOTIFICATION_DELIVERY_PUSH = "push";

/**
 * Dev build: ưu tiên Expo push từ server, tắt banner socket (tránh trùng).
 * Expo Go / chưa đăng ký token: tự bật lại banner local.
 */
export const PREFER_REMOTE_PUSH_NOTIFICATIONS = true;

let pushTokenRegistered = false;

export function markPushTokenRegistered(): void {
  pushTokenRegistered = true;
}

export function clearPushTokenRegistered(): void {
  pushTokenRegistered = false;
}

export function isSocketLocalNotificationEnabled(): boolean {
  if (!isRemotePushSupported()) return true;
  if (!pushTokenRegistered) return true;
  return !PREFER_REMOTE_PUSH_NOTIFICATIONS;
}

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
let hamtechActionSub: (() => void) | null = null;
const recentKeys = new Map<string, number>();
const DEDUPE_MS = 1200;

type HamtechNotificationsNativeModule = {
  showAvatarNotification?: (options: Record<string, unknown>) => Promise<boolean>;
  dismissNotification?: (notificationId: string) => Promise<boolean>;
};

const hamtechNotifications = NativeModules.HamtechNotifications as
  | HamtechNotificationsNativeModule
  | undefined;

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

async function showNativeAvatarNotification(input: {
  notificationId?: string;
  title: string;
  body: string;
  subtitle?: string;
  channelId: string;
  data: Record<string, unknown>;
}): Promise<boolean> {
  if (Platform.OS !== "android" || !hamtechNotifications?.showAvatarNotification) return false;
  if (!input.data.localAvatarUri && !input.data.avatarBase64 && !input.data.actorAvatar) {
    return false;
  }
  try {
    return Boolean(await hamtechNotifications.showAvatarNotification(input));
  } catch (error) {
    if (__DEV__) {
      console.warn("[LocalNotif] native avatar notification failed:", error);
    }
    return false;
  }
}

/** Xin quyền thông báo hệ thống (Android 13+). */
export async function ensureNotificationPermission(): Promise<boolean> {
  return requestNotificationPermissionAsync();
}

/** Đăng ký category + action (Trả lời) — giống Zalo messaging notification. */
export async function ensureNotificationCategories(): Promise<void> {
  if (categoriesReady) return categoriesReady;

  categoriesReady = (async () => {
    try {
      const messageActions = [
        {
          identifier: NOTIFICATION_ACTION.REPLY,
          buttonTitle: "Trả lời",
          options: { opensAppToForeground: false },
          textInput: { submitButtonTitle: "Gửi", placeholder: "Nhập tin nhắn..." },
        },
        {
          identifier: NOTIFICATION_ACTION.MUTE_1M,
          buttonTitle: "Tắt 1 phút",
          options: { opensAppToForeground: false },
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
      const socialFriendActions = [
        {
          identifier: NOTIFICATION_ACTION.FRIEND_DECLINE,
          buttonTitle: "Từ chối",
          options: { opensAppToForeground: false },
        },
        {
          identifier: NOTIFICATION_ACTION.ACCEPT,
          buttonTitle: "Chấp nhận",
          options: { opensAppToForeground: false },
        },
      ];
      const socialViewActions = [
        {
          identifier: NOTIFICATION_ACTION.VIEW,
          buttonTitle: "Xem",
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
      await Notifications.setNotificationCategoryAsync(
        "hamtech_social_friend",
        socialFriendActions,
        {},
      );
      await Notifications.setNotificationCategoryAsync(
        "hamtech_social_view",
        socialViewActions,
        {},
      );
      await Notifications.setNotificationCategoryAsync(CATEGORY_SOCIAL, socialViewActions, {});
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
    ensureExpoNotificationHandlerInstalled();
    await requestNotificationPermissionAsync();
    await ensureSystemNotificationChannels();
    await ensureNotificationCategories();
    if (isSocketLocalNotificationEnabled() && !hamtechActionSub) {
      hamtechActionSub = subscribeHamtechNotificationActions();
    }
  } catch {
    /* ignore */
  }
}

/** Kênh Android — nền sáng, rung nhẹ, accent xanh Zalo (Material). */
export async function ensureSystemNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (channelsReady) return channelsReady;

  channelsReady = (async () => {
    try {
      await Notifications.deleteNotificationChannelAsync(CALLS_NOTIFICATION_CHANNEL_ID);
    } catch {
      /* ignore — channel may not exist */
    }

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
    await Notifications.setNotificationChannelAsync(CALLS_NOTIFICATION_CHANNEL_ID, {
      name: "Cuộc gọi",
      description: "Cuộc gọi đến 1-1 và nhóm",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: ZALO_ACCENT,
      sound: CALL_NOTIFICATION_SOUND,
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
  options?: { fromRemotePush?: boolean },
): Promise<void> {
  if (Platform.OS === "web") return;
  if (!options?.fromRemotePush && !isSocketLocalNotificationEnabled()) return;

  const channel: SystemNotificationChannel = input.channel ?? "default";

  const messageId = String(input.data?.messageId ?? input.notificationId ?? "").replace(
    /^msg-/,
    "",
  );
  if (messageId && isMessageAlreadyNotified(messageId)) return;

  const dedupeKey = buildDedupeKey(input);
  if (isDuplicate(dedupeKey)) return;

  try {
    const channelId =
      channel === "messages"
        ? "messages"
        : channel === "calls"
          ? CALLS_NOTIFICATION_CHANNEL_ID
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
    if (categoryIdentifier) {
      notificationData.categoryIdentifier = categoryIdentifier;
    }
    if (input.notificationId) {
      notificationData.notificationId = input.notificationId;
    }
    const subtitle = input.subtitle?.trim() || undefined;
    const avatarSource = input.avatarUrl ?? pickActorAvatarFromData(notificationData);
    const localAvatarUri = await cacheNotificationAvatarForNative(avatarSource);
    if (localAvatarUri) {
      notificationData.localAvatarUri = localAvatarUri;
      const avatarBase64 = await readCachedNotificationAvatarBase64(localAvatarUri);
      if (avatarBase64) {
        notificationData.avatarBase64 = avatarBase64;
      }
    }
    if (__DEV__) {
      console.log("[LocalNotif] avatar payload:", {
        avatarSource,
        actorAvatar: notificationData.actorAvatar,
        imageUrl: notificationData.imageUrl,
        localAvatarUri,
        hasAvatarBase64: typeof notificationData.avatarBase64 === "string",
        categoryIdentifier,
      });
    }

    console.log(
      `[LocalNotif] showLocalSystemNotification triggered. Title: "${title}", Body: "${body}", Channel: ${channel}, AvatarUrl: ${input.avatarUrl}`,
    );

    const granted = await ensureNotificationPermission();
    if (!granted) {
      console.warn(
        "[LocalNotif] Notification permission not granted — bật trong Cài đặt > Ứng dụng > HamTech > Thông báo.",
      );
      return;
    }

    await ensureSystemNotificationChannels();
    await ensureNotificationCategories();

    const displayedByNative = await showNativeAvatarNotification({
      notificationId: input.notificationId,
      title,
      body: body || title,
      subtitle,
      channelId,
      data: notificationData,
    });
    if (displayedByNative) return;

    const messageCount =
      typeof notificationData.messageCount === "number" && notificationData.messageCount > 1
        ? notificationData.messageCount
        : undefined;
    const messagingLines = notificationData.messagingLines;
    const stackFooter =
      typeof notificationData.stackFooter === "string" ? notificationData.stackFooter.trim() : "";
    const stackedBody =
      Array.isArray(messagingLines) && messagingLines.length > 0
        ? [
            ...messagingLines.map((line) => {
              const row = line as { senderName?: string; text?: string };
              const t = String(row.text ?? "").trim();
              const s = String(row.senderName ?? "").trim();
              return s && !t.startsWith(`${s}:`) ? `${s}: ${t}` : t;
            }),
            ...(stackFooter ? [stackFooter] : []),
          ]
            .filter(Boolean)
            .join("\n")
        : null;

    await Notifications.scheduleNotificationAsync({
      identifier: input.notificationId,
      content: {
        title,
        body: stackedBody || body || title,
        ...(subtitle ? { subtitle } : {}),
        categoryIdentifier,
        data: notificationData,
        sound: channel === "calls" ? CALL_NOTIFICATION_SOUND : "default",
        ...(messageCount ? { badge: messageCount } : {}),
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
    await hamtechNotifications?.dismissNotification?.(`call-${channelName}`);
    await Notifications.dismissNotificationAsync(`call-${channelName}`);
  } catch {
    /* ignore */
  }
}
