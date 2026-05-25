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

type RoleLookupMember = { userId?: string; role?: string };

export type GroupPermissionConversation = Pick<
  IConversation,
  "type" | "groupSettings" | "groupId"
> & {
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

type NormalizableMemberRow = { userId?: string; role?: string };

type GroupMembersNormalizeMeta = {
  leaderId?: string | null;
  creatorId?: string | null;
};

/** Chuẩn hóa danh sách thành viên + vai trò (đồng bộ web `normalizeGroupMembersList`). */
export function normalizeGroupMembersList<T extends NormalizableMemberRow>(
  members: T[] | undefined | null,
  meta?: GroupMembersNormalizeMeta,
): (T & { userId: string; role: MemberRole })[] {
  const byUserId = new Map<string, T>();
  for (const row of members ?? []) {
    const userId = String(row.userId ?? "").trim();
    if (!userId) continue;
    byUserId.set(userId, row);
  }

  const deduped = Array.from(byUserId.values());
  const lookup: RoleLookupMember[] = deduped.map((m) => ({
    userId: String(m.userId ?? "").trim(),
    role: m.role ?? undefined,
  }));

  return deduped.map((row) => {
    const userId = String(row.userId ?? "").trim();
    const fromRow = String(row.role ?? "")
      .trim()
      .toLowerCase();
    const fromRowRole: MemberRole | undefined =
      fromRow === "owner" || fromRow === "admin" || fromRow === "member" ? fromRow : undefined;
    const role =
      resolveGroupMemberRole({
        userId,
        members: lookup,
        conversationLeaderId: meta?.leaderId,
        conversationCreatorId: meta?.creatorId,
      }) ??
      fromRowRole ??
      "member";
    const safeRole: MemberRole =
      role === "owner" || role === "admin" || role === "member" ? role : "member";
    return { ...row, userId, role: safeRole };
  });
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
  if (conversation.groupId) return false;
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
