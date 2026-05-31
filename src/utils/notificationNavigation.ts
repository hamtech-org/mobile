import { type Href, router } from "expo-router";

import { hydrateIncomingCallFromNotification, setReturnTo } from "@/store/slices/callSlice";
import { store } from "@/store/store";
import type { CallScope, CallType, IncomingCallData } from "@/types/call.types";
import type { INotification } from "@/types/notification.types";
import { clearConversationNotificationState } from "@/utils/chatNotificationState";
import { isCallLifecycleClosed } from "@/utils/callNotificationActions";

function openChatConversation(conversationId: string): void {
  const id = conversationId.trim();
  if (!id) {
    router.replace("/(main)/(chat)" as Href);
    return;
  }

  clearConversationNotificationState(id);
  router.replace(`/(main)/(chat)/${id}` as Href);
}

function pushCallRoute(data: INotification["data"]): void {
  const channel = String(data.channelName ?? data.entityId ?? data.id ?? "").trim();
  const conversationId = String(data.conversationId ?? data.extra?.conversationId ?? "").trim();
  const type = String(data.callType ?? data.extra?.callType ?? "audio").trim();
  const scope = String(data.callScope ?? data.extra?.callScope ?? "direct").trim();
  const hostId = String(data.hostId ?? data.extra?.hostId ?? "").trim();
  const returnTo = String(data.returnTo ?? data.extra?.returnTo ?? "/(main)/(chat)").trim();

  if (!channel || !conversationId) {
    router.replace("/call" as Href);
    return;
  }

  router.replace({
    pathname: "/call",
    params: {
      channel,
      conversationId,
      type,
      scope,
      returnTo: encodeURIComponent(returnTo),
      ...(hostId ? { hostId } : {}),
    },
  } as Href);
}

/** Điều hướng từ notification — hỗ trợ deepLink, entityType, route. */
function incomingCallPayloadFromNotification(data: INotification["data"]): IncomingCallData | null {
  const channelName = String(data.channelName ?? data.entityId ?? data.id ?? "").trim();
  const conversationId = String(data.conversationId ?? data.extra?.conversationId ?? "").trim();
  const callerId = String(data.callerId ?? data.extra?.callerId ?? "").trim();
  if (!channelName || !conversationId || !callerId) return null;

  const type: CallType =
    String(data.callType ?? data.extra?.callType) === "video" ? "video" : "audio";
  const scope: CallScope =
    String(data.callScope ?? data.extra?.callScope) === "group" ? "group" : "direct";
  const callerName = String(data.callerName ?? data.extra?.callerName ?? "").trim();
  const hostId = String(data.hostId ?? data.extra?.hostId ?? callerId).trim() || callerId;
  const sessionId = String(data.sessionId ?? data.extra?.sessionId ?? "").trim();

  return {
    channelName,
    conversationId,
    callerId,
    callerName: callerName || "Cuộc gọi đến",
    type,
    scope,
    hostId,
    ...(sessionId ? { sessionId } : {}),
  };
}

async function openIncomingCallModal(data: INotification["data"]): Promise<boolean> {
  if (String(data.callStatus ?? data.extra?.callStatus ?? "") !== "incoming") return false;
  if (await isCallLifecycleClosed(data as Record<string, unknown>)) return true;

  const payload = incomingCallPayloadFromNotification(data);
  if (!payload) return false;

  const currentCall = store.getState().call;
  const isSameIncomingCall =
    currentCall.status === "incoming-ringing" &&
    currentCall.channelName === payload.channelName &&
    currentCall.conversationId === payload.conversationId;
  if (isSameIncomingCall) return true;

  if (currentCall.status !== "idle" && currentCall.status !== "ended") return true;

  store.dispatch(setReturnTo("/(main)/(chat)"));
  store.dispatch(hydrateIncomingCallFromNotification(payload));
  router.replace("/(main)/(chat)" as Href);
  return true;
}

export function navigateFromNotification(data: INotification["data"]): void {
  setTimeout(() => {
    void (async () => {
      try {
        if (await openIncomingCallModal(data)) return;

        const deepLink = typeof data.deepLink === "string" ? data.deepLink.trim() : "";
        if (deepLink) {
          if (deepLink.startsWith("/(main)")) {
            router.replace(deepLink as Href);
            return;
          }
          if (deepLink.startsWith("/communities/")) {
            const pathWithQuery = deepLink.replace(/^\/communities\//, "");
            router.replace(`/(main)/(communities)/${pathWithQuery}` as Href);
            return;
          }
          if (deepLink.startsWith("/chat/")) {
            const id = deepLink.replace(/^\/chat\//, "").split("?")[0];
            if (id) openChatConversation(id);
            return;
          }
          if (deepLink.startsWith("/reels/")) {
            router.replace("/(main)/(reels)" as Href);
            return;
          }
          if (deepLink.startsWith("/live/")) {
            const id = deepLink.replace(/^\/live\//, "").split("/")[0];
            if (id) router.replace(`/(main)/(live)/${id}/watch` as Href);
            else router.replace("/(main)/(live)" as Href);
            return;
          }
          if (deepLink === "/community") {
            router.replace("/(main)/(contacts)" as Href);
            return;
          }
          if (deepLink.startsWith("/call")) {
            pushCallRoute(data);
            return;
          }
        }

        const entityType =
          (typeof data.entityType === "string" && data.entityType) ||
          (typeof data.route === "string" && data.route) ||
          "";
        const entityId = String(
          data.entityId ?? data.id ?? data.conversationId ?? data.postId ?? data.reelId ?? "",
        ).trim();

        switch (entityType) {
          case "chat":
          case "conversation":
          case "message":
            openChatConversation(entityId);
            return;
          case "post":
            router.replace("/(main)/(newsfeed)" as Href);
            return;
          case "reel":
            router.replace("/(main)/(reels)" as Href);
            return;
          case "friends":
          case "friend":
            router.replace("/(main)/(contacts)" as Href);
            return;
          case "profile":
          case "user":
            router.replace("/(main)/(profile)" as Href);
            return;
          case "live":
            if (entityId) router.replace(`/(main)/(live)/${entityId}/watch` as Href);
            else router.replace("/(main)/(live)" as Href);
            return;
          case "call":
            pushCallRoute(data);
            return;
          case "community":
            if (entityId) router.replace(`/(main)/(communities)/${entityId}?joinChat=true` as Href);
            else router.replace("/(main)/(communities)" as Href);
            return;
          default:
            if (entityId && data.route === "chat") {
              openChatConversation(entityId);
            }
            break;
        }
      } catch (error) {
        console.warn("Notification navigation delayed execution failed:", error);
      }
    })();
  }, 500);
}

export function openNotificationFromItem(item: INotification): void {
  navigateFromNotification(item.data);
}
