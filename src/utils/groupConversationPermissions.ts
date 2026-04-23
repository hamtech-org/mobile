import type { IConversation, IGroupSettings, MemberRole } from "@/types/chat.types";

function mergedMemberPermissions(gs?: IGroupSettings) {
  const mp = gs?.memberPermissions;
  return {
    changeNameAvatar: mp?.changeNameAvatar ?? true,
    pinMessages: mp?.pinMessages ?? true,
    createNotesReminders: mp?.createNotesReminders ?? true,
    createPolls: mp?.createPolls ?? true,
    sendMessages: mp?.sendMessages ?? true,
  };
}

function isElevated(role: MemberRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Ghim/bỏ ghim tin trong nhóm — khớp web `ChatPage` + backend `assertUserMayPinMessage`. */
export function canUserPinMessageInGroup(args: {
  conversation?: Pick<IConversation, "type" | "groupSettings"> | null;
  userRole: MemberRole | undefined;
}): boolean {
  const { conversation, userRole } = args;
  if (conversation?.type !== "group") return true;
  if (userRole == null) return true;
  if (isElevated(userRole)) return true;
  return mergedMemberPermissions(conversation.groupSettings).pinMessages;
}

export function canUserCreatePollInGroup(args: {
  conversation?: Pick<IConversation, "type" | "groupSettings"> | null;
  userRole: MemberRole | undefined;
}): boolean {
  const { conversation, userRole } = args;
  if (conversation?.type !== "group") return false;
  if (userRole == null) return true;
  if (isElevated(userRole)) return true;
  return mergedMemberPermissions(conversation.groupSettings).createPolls;
}

export function canUserCreateTaskInGroup(args: {
  conversation?: Pick<IConversation, "type" | "groupSettings"> | null;
  userRole: MemberRole | undefined;
}): boolean {
  const { conversation, userRole } = args;
  if (conversation?.type !== "group") return false;
  if (userRole == null) return true;
  if (isElevated(userRole)) return true;
  return mergedMemberPermissions(conversation.groupSettings).createNotesReminders;
}
