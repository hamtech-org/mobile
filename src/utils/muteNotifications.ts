import type { PatchConversationPreferencesRequest } from "@/store/api/endpoints/conversationApi";

/** Đồng bộ payload với web `MuteNotificationsModal.tsx`. */
export type MuteNotificationsApplyPayload =
  | { kind: "muteFor"; muteFor: "1m" | "5m" | "10m" }
  | { kind: "untilIso"; notificationsMutedUntil: string }
  | { kind: "untilUserUnmutes" }
  | { kind: "clearScheduledMute" };

/** 8:00 sáng theo giờ máy — dùng khi so sánh toast (giống web). */
export function nextLocalEightAmIsoString(): string {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (t.getTime() <= now.getTime()) {
    t.setDate(t.getDate() + 1);
  }
  return t.toISOString();
}

export function buildPatchForMutePayload(
  conversationId: string,
  payload: MuteNotificationsApplyPayload,
): PatchConversationPreferencesRequest {
  const base: PatchConversationPreferencesRequest = { conversationId };
  if (payload.kind === "muteFor") {
    return { ...base, muteFor: payload.muteFor };
  }
  if (payload.kind === "untilIso") {
    return {
      ...base,
      isMuted: false,
      notificationsMutedUntil: payload.notificationsMutedUntil,
    };
  }
  if (payload.kind === "clearScheduledMute") {
    return { ...base, notificationsMutedUntil: null };
  }
  return { ...base, isMuted: true };
}

export function describeMuteSuccess(payload: MuteNotificationsApplyPayload): string {
  if (payload.kind === "muteFor") {
    if (payload.muteFor === "1m") return "Đã tắt thông báo trong 1 phút";
    if (payload.muteFor === "5m") return "Đã tắt thông báo trong 5 phút";
    return "Đã tắt thông báo trong 10 phút";
  }
  if (payload.kind === "untilIso") {
    const refEight = new Date(nextLocalEightAmIsoString()).getTime();
    const picked = new Date(payload.notificationsMutedUntil).getTime();
    const nearEightAm = Number.isFinite(picked) && Math.abs(picked - refEight) < 120_000;
    return nearEightAm ? "Đã tắt thông báo đến 8:00 sáng" : "Đã cập nhật nhắc tắt thông báo";
  }
  if (payload.kind === "clearScheduledMute") return "Đã hủy lịch tắt thông báo";
  return "Đã tắt thông báo đến khi bạn bật lại";
}
