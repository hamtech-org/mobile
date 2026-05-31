import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
} from "@notifee/react-native";

import { canUseFullScreenIntentAsync } from "@/utils/fullScreenIntentPermission";

const CALL_CHANNEL_ID = "calls_voip_v2";

function formatDiagnosticError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { message: String(error) };
  }

  const nativeError = error as {
    code?: unknown;
    message?: unknown;
    name?: unknown;
    stack?: unknown;
  };

  return {
    name: nativeError.name,
    code: nativeError.code,
    message: nativeError.message,
    stack: nativeError.stack,
  };
}

export async function showFullScreenCallNotification(
  data: Record<string, string | undefined>,
): Promise<void> {
  const channelName = data.channelName || "";
  const callerName = data.pushTitle || data.callerName || "Cuộc gọi đến";
  const callType = data.callType || "audio";
  const conversationId = data.conversationId || "";
  const callerId = data.callerId || "";
  const hostId = data.hostId || "";
  const sessionId = data.sessionId || "";
  const callScope = data.callScope || "direct";

  const pushBody =
    data.pushBody || (callType === "video" ? "Cuộc gọi video đến" : "Cuộc gọi thoại đến");

  console.log("[Call Fullscreen] incoming payload", {
    route: data.route,
    callStatus: data.callStatus,
    channelName,
    callerName,
    callType,
    callScope,
    conversationId,
    callerId,
  });

  try {
    const channelId = await notifee.createChannel({
      id: CALL_CHANNEL_ID,
      name: "Cuộc gọi",
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: "amthanhnhan",
    });
    console.log("[Call Fullscreen] channel created", { channelId });

    const [channel, settings, canUseFullScreenIntent] = await Promise.all([
      notifee.getChannel(CALL_CHANNEL_ID),
      notifee.getNotificationSettings(),
      canUseFullScreenIntentAsync(),
    ]);
    console.log("[Call Fullscreen] channel state", channel);
    console.log("[Call Fullscreen] notification settings", settings);
    console.log("[Call Fullscreen] canUseFullScreenIntent", canUseFullScreenIntent);

    const notificationId = `call-${channelName}`;
    console.log("[Call Fullscreen] displayNotification start", {
      notificationId,
      channelId,
      title: callerName,
      body: pushBody,
    });

    await notifee.displayNotification({
      id: notificationId,
      title: callerName,
      body: pushBody,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        category: AndroidCategory.CALL,
        ongoing: true,
        autoCancel: false,
        pressAction: {
          id: "default",
          launchActivity: "com.hamtech.mobile.MainActivity",
        },
        fullScreenAction: {
          id: "default",
          launchActivity: "com.hamtech.mobile.MainActivity",
        },
        actions: [
          {
            title: "Từ chối",
            pressAction: {
              id: "decline",
            },
          },
          {
            title: "Trả lời",
            pressAction: {
              id: "answer",
              launchActivity: "com.hamtech.mobile.MainActivity",
            },
          },
        ],
      },
      data: {
        channelName,
        conversationId,
        callerId,
        callerName,
        callType,
        hostId,
        sessionId,
        callScope,
        click_action: "call",
        route: "call",
        callStatus: "incoming",
        pushBody,
      },
    });

    console.log("[Call Fullscreen] displayNotification success", { notificationId });
  } catch (error) {
    console.error("[Call Fullscreen] displayNotification failed", formatDiagnosticError(error));
    throw error;
  }
}
