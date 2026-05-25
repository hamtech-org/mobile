import { userApi } from "@/store/api/userApi";
import { groupApi } from "@/store/api/endpoints/groupApi";
import { store } from "@/store/store";
import type { IConversation } from "@/types/chat.types";
import { normalizeMediaUrl } from "@/utils/url";

/** URL tuyệt đối http(s) — native Android tải làm largeIcon / MessagingStyle person. */
export function toNotificationAvatarUrl(raw?: string | null): string | undefined {
  const normalized = normalizeMediaUrl(raw);
  if (!normalized) return undefined;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return undefined;
}

function avatarFromFriendsCache(senderId: string): string | null {
  const friends = userApi.endpoints.getFriends.select()(store.getState())?.data;
  const friend = friends?.find((f) => f.userId === senderId);
  const av = friend?.avatar?.trim();
  return av || null;
}

export async function fetchSenderAvatarUrl(senderId: string): Promise<string | null> {
  const id = senderId.trim();
  if (!id) return null;

  const fromFriends = avatarFromFriendsCache(id);
  if (fromFriends) return fromFriends;

  try {
    const users = await store
      .dispatch(userApi.endpoints.postMultipleUsers.initiate({ userIds: [id] }))
      .unwrap();
    const av = users?.[0]?.avatar?.trim();
    return av || null;
  } catch {
    return null;
  }
}

/** Avatar người gửi: socket → member cache → bạn bè → avatar hội thoại. */
export function resolveChatSenderAvatarUrl(
  conversation: IConversation | undefined,
  senderId: string,
  senderAvatarFromMessage?: string | null,
): string | null {
  const fromMsg = senderAvatarFromMessage?.trim();
  if (fromMsg) return fromMsg;

  if (conversation?.type === "group") {
    const members = groupApi.endpoints.getGroupMembers.select(conversation.conversationId)(
      store.getState(),
    )?.data;
    const member = members?.find((m) => m.userId === senderId);
    const fromMember = member?.avatar?.trim();
    if (fromMember) return fromMember;
  }

  const fromFriend = avatarFromFriendsCache(senderId);
  if (fromFriend) return fromFriend;

  const convAvatar = conversation?.avatar?.trim();
  return convAvatar || null;
}

export function pickActorAvatarFromData(data?: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const extra =
    data.extra && typeof data.extra === "object" ? (data.extra as Record<string, unknown>) : {};
  const raw =
    data.actorAvatar ??
    data.senderAvatar ??
    data.conversationAvatar ??
    data.groupAvatar ??
    data.imageUrl ??
    extra.actorAvatar ??
    extra.senderAvatar ??
    extra.authorAvatar ??
    extra.conversationAvatar ??
    extra.groupAvatar ??
    extra.imageUrl ??
    null;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}
