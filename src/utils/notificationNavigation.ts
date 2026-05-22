import { type Href, router } from "expo-router";

import type { INotification } from "@/types/notification.types";

/** Điều hướng từ notification — hỗ trợ deepLink, entityType, route. */
export function navigateFromNotification(data: INotification["data"]): void {
  const deepLink = typeof data.deepLink === "string" ? data.deepLink.trim() : "";
  if (deepLink) {
    if (deepLink.startsWith("/(main)")) {
      router.push(deepLink as Href);
      return;
    }
    if (deepLink.startsWith("/communities/")) {
      const pathWithQuery = deepLink.replace(/^\/communities\//, "");
      router.push(`/(main)/(communities)/${pathWithQuery}` as Href);
      return;
    }
    if (deepLink.startsWith("/chat/")) {
      const id = deepLink.replace(/^\/chat\//, "").split("?")[0];
      if (id) router.push(`/(main)/(chat)/${id}` as Href);
      return;
    }
    if (deepLink.startsWith("/reels/")) {
      router.push("/(main)/(reels)" as Href);
      return;
    }
    if (deepLink.startsWith("/live/")) {
      const id = deepLink.replace(/^\/live\//, "").split("/")[0];
      if (id) router.push(`/(main)/(live)/${id}/watch` as Href);
      else router.push("/(main)/(live)" as Href);
      return;
    }
    if (deepLink === "/community") {
      router.push("/(main)/(contacts)" as Href);
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
      if (entityId) router.push(`/(main)/(chat)/${entityId}` as Href);
      else router.push("/(main)/(chat)" as Href);
      return;
    case "post":
      router.push("/(main)/(newsfeed)" as Href);
      return;
    case "reel":
      router.push("/(main)/(reels)" as Href);
      return;
    case "friends":
    case "friend":
      router.push("/(main)/(contacts)" as Href);
      return;
    case "profile":
    case "user":
      router.push("/(main)/(profile)" as Href);
      return;
    case "live":
      if (entityId) router.push(`/(main)/(live)/${entityId}/watch` as Href);
      else router.push("/(main)/(live)" as Href);
      return;
    case "community":
      if (entityId) router.push(`/(main)/(communities)/${entityId}?joinChat=true` as Href);
      else router.push("/(main)/(communities)" as Href);
      return;
    default:
      if (entityId && data.route === "chat") {
        router.push(`/(main)/(chat)/${entityId}` as Href);
      }
      break;
  }
}

export function openNotificationFromItem(item: INotification): void {
  navigateFromNotification(item.data);
}
