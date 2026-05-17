import type { IConversation, IGroupSettings, MemberRole } from "@/types/chat.types";

/** Số phó nhóm tối đa trong một nhóm (khớp backend `MAX_GROUP_ADMINS`). */
export const MAX_GROUP_ADMINS = 3;

type AdminCountableMember = { role?: string | null };

export function countGroupAdmins(members: AdminCountableMember[] | undefined): number {
  return (members ?? []).filter(
    (m) =>
      String(m.role ?? "")
        .trim()
        .toLowerCase() === "admin",
  ).length;
}

export function isGroupAdminSlotsFull(members: AdminCountableMember[] | undefined): boolean {
  return countGroupAdmins(members) >= MAX_GROUP_ADMINS;
}

function mergedMemberPermissions(gs?: IGroupSettings) {
  const mp = gs?.memberPermissions;
  if (!mp) {
    return {
      changeNameAvatar: false,
      pinMessages: false,
      createNotesReminders: false,
      createPolls: false,
      sendMessages: false,
    };
  }
  return {
    changeNameAvatar: Boolean(mp.changeNameAvatar),
    pinMessages: Boolean(mp.pinMessages),
    createNotesReminders: Boolean(mp.createNotesReminders),
    createPolls: Boolean(mp.createPolls),
    sendMessages: Boolean(mp.sendMessages),
  };
}

function isElevated(role: MemberRole | undefined): boolean {
  return role === "owner" || role === "admin";
}

type RoleLookupMember = { userId?: string; role?: string };

export type GroupPermissionConversation = Pick<IConversation, "type" | "groupSettings"> & {
  creatorId?: string | null;
  leaderId?: string | null;
};

export function resolveGroupMemberRole(args: {
  userId?: string;
  members?: RoleLookupMember[];
  conversationLeaderId?: string | null;
  conversationCreatorId?: string | null;
}): MemberRole | undefined {
  const uid = String(args.userId ?? "").trim();
  if (!uid) return undefined;
  const hit = args.members?.find((m) => String(m.userId ?? "").trim() === uid);
  const fromList = String(hit?.role ?? "")
    .trim()
    .toLowerCase();
  if (fromList === "owner" || fromList === "admin" || fromList === "member") return fromList;
  const leaderId = String(args.conversationLeaderId ?? "").trim();
  if (leaderId && leaderId === uid) return "owner";
  const ownerFromMembers = String(
    args.members?.find(
      (m) =>
        String(m.role ?? "")
          .trim()
          .toLowerCase() === "owner",
    )?.userId ?? "",
  ).trim();
  if (ownerFromMembers && ownerFromMembers === uid) return "owner";
  const creator = String(args.conversationCreatorId ?? "").trim();
  if (!leaderId && !ownerFromMembers && creator && creator === uid) return "owner";
  return undefined;
}

function resolveRoleForCheck(args: {
  conversation?: GroupPermissionConversation | null;
  userRole?: MemberRole;
  userId?: string;
  members?: RoleLookupMember[];
}): MemberRole | undefined {
  return (
    args.userRole ??
    resolveGroupMemberRole({
      userId: args.userId,
      members: args.members,
      conversationLeaderId: args.conversation?.leaderId,
      conversationCreatorId: args.conversation?.creatorId,
    })
  );
}

export function canUserPinMessageInGroup(args: {
  conversation?: GroupPermissionConversation | null;
  userRole?: MemberRole;
  userId?: string;
  members?: RoleLookupMember[];
}): boolean {
  const { conversation } = args;
  if (conversation?.type !== "group") return true;
  const role = resolveRoleForCheck(args);
  if (role == null) return false;
  if (isElevated(role)) return true;
  return mergedMemberPermissions(conversation.groupSettings).pinMessages;
}

export function canUserCreatePollInGroup(args: {
  conversation?: GroupPermissionConversation | null;
  userRole?: MemberRole;
  userId?: string;
  members?: RoleLookupMember[];
}): boolean {
  const { conversation } = args;
  if (conversation?.type !== "group") return false;
  const role = resolveRoleForCheck(args);
  if (role == null) return false;
  if (isElevated(role)) return true;
  return mergedMemberPermissions(conversation.groupSettings).createPolls;
}

export function canUserCreateTaskInGroup(args: {
  conversation?: GroupPermissionConversation | null;
  userRole?: MemberRole;
  userId?: string;
  members?: RoleLookupMember[];
}): boolean {
  const { conversation } = args;
  if (conversation?.type !== "group") return false;
  const role = resolveRoleForCheck(args);
  if (role == null) return false;
  if (isElevated(role)) return true;
  return mergedMemberPermissions(conversation.groupSettings).createNotesReminders;
}

export function canUserChangeGroupProfileInGroup(args: {
  conversation?: GroupPermissionConversation | null;
  userRole?: MemberRole;
  userId?: string;
  members?: RoleLookupMember[];
}): boolean {
  const { conversation } = args;
  if (conversation?.type !== "group") return false;
  const role = resolveRoleForCheck(args);
  if (role == null) return false;
  if (role === "owner") return true;
  return mergedMemberPermissions(conversation.groupSettings).changeNameAvatar;
}

export function canUserSendMessageInGroup(args: {
  conversation?: GroupPermissionConversation | null;
  userRole?: MemberRole;
  userId?: string;
  members?: RoleLookupMember[];
}): boolean {
  const { conversation } = args;
  if (conversation?.type !== "group") return true;
  const role = resolveRoleForCheck(args);
  if (role == null) return false;
  if (isElevated(role)) return true;
  return mergedMemberPermissions(conversation.groupSettings).sendMessages;
}
