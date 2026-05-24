import { Platform } from "react-native";

import type { INotificationRouteData } from "@/types/notification.types";
import { cacheNotificationAvatarForNative } from "@/utils/notificationAvatarCache";
import { NOTIFICATION_ACTION, type SystemNotificationCategory } from "@/utils/notificationRegistry";

const ZALO_ACCENT = "#0068FF";
const PRESS_DEFAULT = "default";

export type NativeSystemNotificationChannel = "messages" | "calls" | "social" | "default";

interface NotificationCacheEntry {
  count: number;
  messages: any[];
  lines: string[];
  updatedAt: number;
}
const notificationStateCache = new Map<string, NotificationCacheEntry>();

export interface NotifeeSystemNotificationInput {
  title: string;
  body: string;
  channel: NativeSystemNotificationChannel;
  avatarUrl?: string | null;
  subtitle?: string | null;
  categoryIdentifier?: SystemNotificationCategory;
  notificationId?: string;
  data?: INotificationRouteData & Record<string, unknown>;
}

type NotifeeModule = {
  default: {
    requestPermission?: () => Promise<unknown>;
    createChannel?: (channel: Record<string, unknown>) => Promise<string>;
    displayNotification?: (notification: Record<string, unknown>) => Promise<string>;
    cancelNotification?: (id: string) => Promise<void>;
    onForegroundEvent?: (observer: (event: unknown) => void | Promise<void>) => () => void;
    onBackgroundEvent?: (observer: (event: unknown) => void | Promise<void>) => void;
    getInitialNotification?: () => Promise<unknown>;
    getDisplayedNotifications?: () => Promise<Record<string, any>[]>;
  };
  AndroidCategory: Record<string, unknown>;
  AndroidImportance: Record<string, unknown>;
  AndroidStyle: Record<string, unknown>;
  AndroidVisibility: Record<string, unknown>;
  EventType: Record<string, unknown>;
};

let notifeeModulePromise: Promise<NotifeeModule | null> | null = null;
let channelsReady: Promise<boolean> | null = null;
let backgroundRegistered = false;

async function loadNotifee(): Promise<NotifeeModule | null> {
  if (Platform.OS === "web") return null;
  if (!notifeeModulePromise) {
    notifeeModulePromise = import("@notifee/react-native")
      .then((mod) => mod as unknown as NotifeeModule)
      .catch(() => null);
  }
  return notifeeModulePromise;
}

function stringifyData(data?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(data ?? {}).forEach(([key, value]) => {
    if (value == null) return;
    if (typeof value === "string") {
      out[key] = value;
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
      return;
    }
    try {
      out[key] = JSON.stringify(value);
    } catch {
      out[key] = String(value);
    }
  });
  return out;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function avatarUrlFor(input: NotifeeSystemNotificationInput): string | null {
  return (
    text(input.avatarUrl) ||
    text(input.data?.actorAvatar) ||
    text(input.data?.senderAvatar) ||
    text(input.data?.callerAvatar) ||
    text(input.data?.conversationAvatar) ||
    text(input.data?.groupAvatar) ||
    text(input.data?.imageUrl) ||
    null
  );
}

function channelIdFor(channel: NativeSystemNotificationChannel): string {
  if (channel === "messages") return "messages";
  if (channel === "calls") return "calls";
  if (channel === "social") return "social";
  return "default";
}

function importanceFor(mod: NotifeeModule, channel: NativeSystemNotificationChannel): unknown {
  if (channel === "messages" || channel === "calls") {
    return mod.AndroidImportance?.HIGH ?? 4;
  }
  return mod.AndroidImportance?.DEFAULT ?? 3;
}

function androidCategoryFor(mod: NotifeeModule, channel: NativeSystemNotificationChannel): unknown {
  if (channel === "calls") return mod.AndroidCategory?.CALL ?? "call";
  if (channel === "messages") return mod.AndroidCategory?.MESSAGE ?? "msg";
  if (channel === "social") return mod.AndroidCategory?.SOCIAL ?? "social";
  return mod.AndroidCategory?.STATUS ?? "status";
}

function isIncomingCall(input: NotifeeSystemNotificationInput): boolean {
  return (
    input.categoryIdentifier === "hamtech_call_direct" ||
    input.categoryIdentifier === "hamtech_call_group" ||
    input.data?.callStatus === "incoming"
  );
}

function actionsFor(input: NotifeeSystemNotificationInput): unknown[] | undefined {
  if (input.categoryIdentifier === "hamtech_message") {
    return [
      {
        title: "Trả lời",
        pressAction: { id: NOTIFICATION_ACTION.REPLY },
        input: {
          allowFreeFormInput: true,
          placeholder: "Nhập tin nhắn...",
        },
      },
    ];
  }

  if (isIncomingCall(input)) {
    return [
      {
        title: "Từ chối",
        pressAction: { id: NOTIFICATION_ACTION.DECLINE },
      },
      {
        title: "Trả lời",
        pressAction: { id: NOTIFICATION_ACTION.ANSWER, launchActivity: "default" },
      },
    ];
  }

  if (input.categoryIdentifier === "hamtech_call_missed") {
    return [
      {
        title: "Nhắn tin",
        pressAction: { id: NOTIFICATION_ACTION.MESSAGE, launchActivity: "default" },
      },
      {
        title: "Gọi lại",
        pressAction: { id: NOTIFICATION_ACTION.CALLBACK, launchActivity: "default" },
      },
    ];
  }

  return undefined;
}

function styleFor(
  mod: NotifeeModule,
  input: NotifeeSystemNotificationInput,
  largeIcon?: string,
  senderIcon?: string,
): unknown {
  if (input.channel === "messages" && mod.AndroidStyle?.MESSAGING) {
    const isGroup = input.data?.chatScope === "group" || input.data?.conversationType === "group";
    const conversationTitle =
      text(input.data?.conversationName) || text(input.data?.groupName) || input.title;
    const senderName =
      input.subtitle?.trim() ||
      text(input.data?.senderName) ||
      text(input.data?.actorName) ||
      (isGroup ? "Ai đó" : input.title);

    // For 1-on-1, use senderIcon or largeIcon. For groups, force largeIcon (Group Avatar) to the left by making it the person icon.
    const iconForPerson = isGroup ? largeIcon : (senderIcon ?? largeIcon);

    // The top-level person represents the current device user.
    const deviceUser = {
      name: "Tôi",
    };

    // The message sender person.
    const senderPerson = {
      name: senderName,
      ...(iconForPerson ? { icon: iconForPerson } : {}),
    };

    return {
      type: mod.AndroidStyle.MESSAGING,
      person: deviceUser,
      title: isGroup ? conversationTitle : undefined,
      isGroupConversation: isGroup,
      messages: [
        {
          text:
            isGroup && input.body.startsWith(`${senderName}: `)
              ? input.body.substring(senderName.length + 2)
              : input.body,
          timestamp: Date.now(),
          person: senderPerson,
        },
      ],
    };
  }

  if (mod.AndroidStyle?.BIGTEXT) {
    return {
      type: mod.AndroidStyle.BIGTEXT,
      text: input.body,
    };
  }

  return undefined;
}

function isPressEvent(mod: NotifeeModule, event: unknown): boolean {
  const type = (event as { type?: unknown })?.type;
  return type === mod.EventType?.PRESS || type === mod.EventType?.ACTION_PRESS;
}

async function createChannels(mod: NotifeeModule): Promise<boolean> {
  if (!mod.default.createChannel) return false;

  await mod.default.createChannel({
    id: "messages",
    name: "Tin nhắn",
    lights: true,
    lightColor: ZALO_ACCENT,
    vibration: true,
    vibrationPattern: [10, 120, 80, 120],
    sound: "default",
    importance: mod.AndroidImportance?.HIGH ?? 4,
  });

  await mod.default.createChannel({
    id: "calls",
    name: "Cuộc gọi",
    lights: true,
    lightColor: ZALO_ACCENT,
    vibration: true,
    vibrationPattern: [10, 400, 200, 400],
    sound: "default",
    importance: mod.AndroidImportance?.HIGH ?? 4,
  });

  await mod.default.createChannel({
    id: "social",
    name: "Hoạt động",
    lights: true,
    lightColor: ZALO_ACCENT,
    vibration: true,
    vibrationPattern: [10, 100],
    sound: "default",
    importance: mod.AndroidImportance?.DEFAULT ?? 3,
  });

  await mod.default.createChannel({
    id: "default",
    name: "Thông báo",
    lights: true,
    lightColor: ZALO_ACCENT,
    sound: "default",
    importance: mod.AndroidImportance?.DEFAULT ?? 3,
  });

  return true;
}

export async function ensureNotifeeNotificationInfrastructure(): Promise<boolean> {
  const mod = await loadNotifee();
  if (!mod?.default) return false;

  try {
    console.log("[NotifeeNotif] Requesting Notifee permission...");
    await mod.default.requestPermission?.();
    console.log("[NotifeeNotif] Creating Notifee channels...");
    const success = await createChannels(mod);
    console.log("[NotifeeNotif] createChannels success:", success);
    return success;
  } catch (err) {
    console.error("[NotifeeNotif] Infrastructure setup caught exception:", err);
    return false;
  }
}

const notificationQueues: Record<string, Promise<any>> = {};

export async function showNotifeeSystemNotification(
  input: NotifeeSystemNotificationInput,
): Promise<boolean> {
  const notifId =
    typeof input.notificationId === "string" && input.notificationId.trim()
      ? input.notificationId.trim()
      : "global";

  // Use a promise queue to prevent race conditions when reading existing messages
  const previousTask = notificationQueues[notifId] || Promise.resolve();

  const currentTask = previousTask.then(async () => {
    console.log(
      "[NotifeeNotif] showNotifeeSystemNotification called. Input avatarUrl:",
      input.avatarUrl,
    );
    const mod = await loadNotifee();
    if (!mod) {
      console.warn("[NotifeeNotif] Notifee module is null/undefined!");
      return false;
    }
    if (!mod.default?.displayNotification) {
      console.warn(
        "[NotifeeNotif] displayNotification function is not available on module default!",
      );
      return false;
    }

    try {
      const ready = await ensureNotifeeNotificationInfrastructure();
      console.log("[NotifeeNotif] Infrastructure ready status:", ready);
      if (!ready) return false;

      const channelId = channelIdFor(input.channel);
      const avatarUrl = avatarUrlFor(input);
      const largeIcon =
        (await cacheNotificationAvatarForNative(avatarUrl)) ?? avatarUrl ?? undefined;

      const senderAvatarUrl =
        text(input.data?.senderAvatar) || text(input.data?.actorAvatar) || undefined;
      const senderIcon = senderAvatarUrl
        ? ((await cacheNotificationAvatarForNative(senderAvatarUrl)) ?? senderAvatarUrl)
        : undefined;

      const incomingCall = isIncomingCall(input);
      const actions = actionsFor(input);
      const style = styleFor(mod, input, largeIcon, senderIcon);

      // Check for existing displayed notification to append messages
      let existingMessages: any[] = [];
      let existingLines: string[] = [];
      let existingCount = 0;

      if (notifId) {
        // Prefer in-memory cache to bypass Android's getDisplayedNotifications latency
        const cached = notificationStateCache.get(notifId);
        if (cached && Date.now() - cached.updatedAt < 60000) {
          existingCount = cached.count;
          existingMessages = cached.messages.map((m: any) => ({
            ...m,
            text:
              typeof m.text === "string"
                ? m.text.replace(/\n\n\(Có \d+ tin nhắn mới\)$/, "")
                : m.text,
          }));
          existingLines = [...cached.lines];
        } else {
          try {
            const displayed = (await mod.default.getDisplayedNotifications?.()) || [];
            const existing = displayed.find((n: any) => n.id === notifId);
            if (existing) {
              existingCount =
                parseInt(String(existing.notification?.data?.localMessageCount || "0"), 10) || 0;

              if (existing.notification?.data?.localMessages) {
                try {
                  const parsedData = JSON.parse(existing.notification.data.localMessages);
                  if (Array.isArray(parsedData)) {
                    if (parsedData.length > 0 && typeof parsedData[0] === "string") {
                      existingLines = parsedData;
                    } else {
                      existingMessages = parsedData.map((m: any) => ({
                        ...m,
                        text:
                          typeof m.text === "string"
                            ? m.text.replace(/\n\n\(Có \d+ tin nhắn mới\)$/, "")
                            : m.text,
                      }));
                    }
                  }
                } catch (err) {
                  // Ignore JSON parse errors
                }
              } else if (existing.notification?.android?.style) {
                // Fallback for older notifications that didn't use localMessages
                const s = existing.notification.android.style;
                if (s.type === mod.AndroidStyle.MESSAGING && Array.isArray(s.messages)) {
                  existingMessages = s.messages.map((m: any) => ({
                    ...m,
                    text:
                      typeof m.text === "string"
                        ? m.text.replace(/\n\n\(Có \d+ tin nhắn mới\)$/, "")
                        : m.text,
                  }));
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }

      const currentMessageCount =
        (existingCount > 0
          ? existingCount
          : Math.max(existingMessages.length, existingLines.length)) + 1;

      let finalStyle = style;
      let subText: string | undefined = undefined;
      let msgCountLabel: string | undefined =
        currentMessageCount > 1 ? `(${currentMessageCount} tin nhắn mới)` : undefined;

      const isGroupChat =
        input.data?.chatScope === "group" || input.data?.conversationType === "group";

      let newMsgs: any[] = [];
      let newLines: string[] = [];
      if (finalStyle && (finalStyle as any).type === mod.AndroidStyle.MESSAGING) {
        newMsgs = [...existingMessages, ...(finalStyle as any).messages];

        // For 1:1 chats, Android ignores the title override, so we must append the count to the last message body.
        if (!isGroupChat && currentMessageCount > 1 && newMsgs.length > 0) {
          const lastMsg = newMsgs[newMsgs.length - 1];
          lastMsg.text = `${lastMsg.text}\n\n(Có ${currentMessageCount} tin nhắn mới)`;
        }

        finalStyle = {
          ...(finalStyle as any),
          title: isGroupChat && msgCountLabel ? `${input.title} ${msgCountLabel}` : input.title,
          messages: newMsgs.slice(-3), // limit to 3 latest
        };
      } else if (finalStyle && (finalStyle as any).type === mod.AndroidStyle.BIGTEXT && notifId) {
        newLines = [...existingLines, input.body];
        finalStyle = {
          type: mod.AndroidStyle.INBOX,
          lines: newLines.slice(-3), // limit to 3 latest
          summary:
            currentMessageCount > 3
              ? `+${currentMessageCount - 3} tin nhắn mới`
              : `${currentMessageCount} tin nhắn`,
        };
      }

      const enrichedData = {
        ...(input.data || {}),
        localMessageCount: currentMessageCount,
        localMessages: JSON.stringify(
          newMsgs.length > 0
            ? newMsgs.map((m: any) => ({
                ...m,
                text:
                  typeof m.text === "string"
                    ? m.text.replace(/\n\n\(Có \d+ tin nhắn mới\)$/, "")
                    : m.text,
              }))
            : newLines,
        ),
      };

      const notificationOptions: Record<string, any> = {
        title: msgCountLabel ? `${input.title} ${msgCountLabel}` : input.title,
        body: input.body,
        subtitle: input.subtitle ?? undefined,
        data: stringifyData(enrichedData),
        android: {
          channelId,
          color: ZALO_ACCENT,
          category: androidCategoryFor(mod, input.channel),
          importance: importanceFor(mod, input.channel),
          visibility: mod.AndroidVisibility?.PUBLIC ?? 1,
          timestamp: Date.now(),
          showTimestamp: true,
          ...(subText ? { subText } : {}),
          pressAction: { id: PRESS_DEFAULT, launchActivity: "default" },
          ...(largeIcon ? { largeIcon } : {}),
          ...(finalStyle ? { style: finalStyle } : {}),
          ...(actions ? { actions } : {}),
          ...(incomingCall
            ? {
                ongoing: true,
                autoCancel: false,
                fullScreenAction: {
                  id: NOTIFICATION_ACTION.ANSWER,
                  launchActivity: "default",
                },
              }
            : { autoCancel: true }),
        },
        ios: {
          sound: "default",
          categoryId: input.categoryIdentifier,
          attachments: largeIcon ? [{ url: largeIcon }] : undefined,
        },
      };

      if (notifId) {
        notificationOptions.id = notifId;
        // Update the in-memory cache to ensure perfect stacking for rapid messages
        notificationStateCache.set(notifId, {
          count: currentMessageCount,
          messages: newMsgs.length > 0 ? newMsgs : existingMessages,
          lines: newLines.length > 0 ? newLines : existingLines,
          updatedAt: Date.now(),
        });
      }

      await mod.default.displayNotification(notificationOptions);
      return true;
    } catch (e) {
      if (__DEV__) {
        console.warn("[notifeeSystemNotification] display failed:", e);
      }
      return false;
    }
  });

  notificationQueues[notifId] = currentTask.catch(() => false);
  return currentTask;
}

export async function cancelNotifeeNotification(notificationId: string): Promise<boolean> {
  const mod = await loadNotifee();
  if (!mod?.default?.cancelNotification) return false;
  try {
    await mod.default.cancelNotification(notificationId);
    return true;
  } catch {
    return false;
  }
}

export function subscribeNotifeeForegroundEvents(
  onResponse: (response: unknown) => void | Promise<void>,
): () => void {
  let disposed = false;
  let unsubscribe: (() => void) | undefined;

  void loadNotifee().then((mod) => {
    if (disposed || !mod?.default?.onForegroundEvent) return;
    unsubscribe = mod.default.onForegroundEvent((event) => {
      if (!isPressEvent(mod, event)) return;
      void onResponse({ detail: (event as { detail?: unknown })?.detail });
    });
  });

  return () => {
    disposed = true;
    unsubscribe?.();
  };
}

export function registerNotifeeBackgroundEvents(
  onResponse: (response: unknown) => void | Promise<void>,
): void {
  if (backgroundRegistered) return;
  backgroundRegistered = true;

  void loadNotifee().then((mod) => {
    if (!mod?.default?.onBackgroundEvent) return;
    mod.default.onBackgroundEvent(async (event) => {
      if (!isPressEvent(mod, event)) return;
      await onResponse({ detail: (event as { detail?: unknown })?.detail });
    });
  });
}

export async function getInitialNotifeeNotificationResponse(): Promise<unknown | null> {
  const mod = await loadNotifee();
  if (!mod?.default?.getInitialNotification) return null;
  try {
    const initial = await mod.default.getInitialNotification();
    if (!initial) return null;
    return { detail: initial };
  } catch {
    return null;
  }
}
