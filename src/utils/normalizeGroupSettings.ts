import type { IGroupSettings } from "@/types/chat.types";

export const DEFAULT_GROUP_SETTINGS: IGroupSettings = {
  memberPermissions: {
    changeNameAvatar: true,
    pinMessages: true,
    createNotesReminders: true,
    createPolls: true,
    sendMessages: true,
  },
  adminSettings: {
    approvalRequired: false,
    highlightLeaderMessages: true,
    newMembersReadRecent: true,
    allowJoinLink: true,
  },
};

/** Chuẩn hóa payload settings từ API (tránh undefined làm UI lệch) — đồng bộ web. */
export function normalizeGroupSettings(raw: unknown): IGroupSettings {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_GROUP_SETTINGS,
      memberPermissions: { ...DEFAULT_GROUP_SETTINGS.memberPermissions },
      adminSettings: { ...DEFAULT_GROUP_SETTINGS.adminSettings },
    };
  }
  const o = raw as Record<string, unknown>;
  const mp = o.memberPermissions as Record<string, unknown> | undefined;
  const ad = o.adminSettings as Record<string, unknown> | undefined;
  return {
    memberPermissions: {
      changeNameAvatar: Boolean(
        mp?.changeNameAvatar ?? DEFAULT_GROUP_SETTINGS.memberPermissions.changeNameAvatar,
      ),
      pinMessages: Boolean(mp?.pinMessages ?? DEFAULT_GROUP_SETTINGS.memberPermissions.pinMessages),
      createNotesReminders: Boolean(
        mp?.createNotesReminders ?? DEFAULT_GROUP_SETTINGS.memberPermissions.createNotesReminders,
      ),
      createPolls: Boolean(mp?.createPolls ?? DEFAULT_GROUP_SETTINGS.memberPermissions.createPolls),
      sendMessages: Boolean(
        mp?.sendMessages ?? DEFAULT_GROUP_SETTINGS.memberPermissions.sendMessages,
      ),
    },
    adminSettings: {
      approvalRequired: Boolean(
        ad?.approvalRequired ?? DEFAULT_GROUP_SETTINGS.adminSettings.approvalRequired,
      ),
      highlightLeaderMessages: Boolean(
        ad?.highlightLeaderMessages ?? DEFAULT_GROUP_SETTINGS.adminSettings.highlightLeaderMessages,
      ),
      newMembersReadRecent: Boolean(
        ad?.newMembersReadRecent ?? DEFAULT_GROUP_SETTINGS.adminSettings.newMembersReadRecent,
      ),
      allowJoinLink: Boolean(
        ad?.allowJoinLink ?? DEFAULT_GROUP_SETTINGS.adminSettings.allowJoinLink,
      ),
    },
    joinLinkSuffix: o.joinLinkSuffix != null ? String(o.joinLinkSuffix) : undefined,
  };
}
