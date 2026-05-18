import type { IConversation, IGroupMember, IGroupSettings, MemberRole } from "@/types/chat.types";
import { chatApi, type ApiEnvelope } from "../baseChatApi";

function mapApiGroupMember(raw: unknown): IGroupMember | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const userId = String(o.userId ?? "").trim();
  if (!userId) return null;
  const displayName = String(o.name ?? o.displayName ?? o.nickname ?? userId).trim();
  const roleRaw = String(o.role ?? "member");
  const role: MemberRole =
    roleRaw === "owner" || roleRaw === "admin" || roleRaw === "member" ? roleRaw : "member";
  return {
    userId,
    displayName: displayName || userId,
    avatar: o.avatar != null ? String(o.avatar) : null,
    role,
    joinedAt: o.joinedAt != null ? String(o.joinedAt) : undefined,
  };
}

export interface UpdateGroupRequest {
  groupId: string;
  name?: string;
  avatar?: string;
}

export interface AddMembersRequest {
  groupId: string;
  memberIds: string[];
}

export interface ChangeMemberRoleRequest {
  groupId: string;
  userId: string;
  role: Extract<MemberRole, "admin" | "member">;
}

export interface TransferGroupOwnerRequest {
  groupId: string;
  newOwnerUserId: string;
  currentOwnerNewRole: Extract<MemberRole, "admin" | "member">;
}

export interface UpdateGroupSettingsRequest {
  groupId: string;
  memberPermissions?: Partial<IGroupSettings["memberPermissions"]>;
  adminSettings?: Partial<IGroupSettings["adminSettings"]>;
  regenerateJoinLink?: boolean;
}

export interface GroupJoinRequestRow {
  userId: string;
  name: string;
  avatar: string | null;
  status?: string;
  isFriend?: boolean;
}

type MemberCountPayload = { memberCount?: number } | null;

function updateInjectedQueryData(...args: unknown[]): unknown {
  return (
    chatApi.util as unknown as { updateQueryData: (...innerArgs: unknown[]) => unknown }
  ).updateQueryData(...args);
}

const DEFAULT_GROUP_SETTINGS: IGroupSettings = {
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

function normalizeGroupSettings(raw: unknown): IGroupSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const mp = o.memberPermissions as Record<string, unknown> | undefined;
  const ad = o.adminSettings as Record<string, unknown> | undefined;
  if (!mp || !ad) return null;
  return {
    memberPermissions: {
      changeNameAvatar: Boolean(mp.changeNameAvatar),
      pinMessages: Boolean(mp.pinMessages),
      createNotesReminders: Boolean(mp.createNotesReminders),
      createPolls: Boolean(mp.createPolls),
      sendMessages: Boolean(mp.sendMessages),
    },
    adminSettings: {
      approvalRequired: Boolean(ad.approvalRequired),
      highlightLeaderMessages: Boolean(ad.highlightLeaderMessages),
      newMembersReadRecent: Boolean(ad.newMembersReadRecent),
      allowJoinLink: Boolean(ad.allowJoinLink),
    },
    joinLinkSuffix: o.joinLinkSuffix != null ? String(o.joinLinkSuffix) : undefined,
  };
}

export const groupApi = chatApi.injectEndpoints({
  endpoints: (builder) => ({
    getGroupMembers: builder.query<IGroupMember[], string>({
      query: (groupId) => `/chat/groups/${groupId}/members`,
      transformResponse: (response: ApiEnvelope<unknown[]>) => {
        const raw = response.data;
        if (!Array.isArray(raw)) return [];
        return raw.map(mapApiGroupMember).filter((m): m is IGroupMember => m != null);
      },
      providesTags: (_result, _error, groupId) => [
        { type: "Conversations", id: `MEMBERS-${groupId}` },
      ],
    }),

    updateGroup: builder.mutation<ApiEnvelope<unknown>, UpdateGroupRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Conversations"],
      async onQueryStarted({ groupId, name, avatar }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          (
            chatApi.util as unknown as { updateQueryData: (...args: unknown[]) => unknown }
          ).updateQueryData("getConversations", undefined, (draft: IConversation[]) => {
            const c = draft.find((x) => x.conversationId === groupId);
            if (!c) return;
            if (name !== undefined) c.name = name;
            if (avatar !== undefined) c.avatar = avatar;
          }) as never,
        ) as { undo: () => void };
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    deleteGroup: builder.mutation<ApiEnvelope<null>, string>({
      query: (groupId) => ({
        url: `/chat/groups/${groupId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Conversations"],
    }),

    leaveGroup: builder.mutation<
      ApiEnvelope<MemberCountPayload>,
      { groupId: string; newOwnerUserId?: string }
    >({
      query: ({ groupId, newOwnerUserId }) => ({
        url: `/chat/groups/${groupId}/leave`,
        method: "POST",
        body: newOwnerUserId?.trim() ? { newOwnerUserId: newOwnerUserId.trim() } : {},
      }),
      invalidatesTags: ["Conversations"],
    }),

    addMembers: builder.mutation<ApiEnvelope<unknown>, AddMembersRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/members`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    removeMember: builder.mutation<
      ApiEnvelope<MemberCountPayload>,
      { groupId: string; userId: string }
    >({
      query: ({ groupId, userId }) => ({
        url: `/chat/groups/${groupId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Conversations", id: `MEMBERS-${arg.groupId}` },
        "Conversations",
      ],
      async onQueryStarted({ groupId, userId }, { dispatch, queryFulfilled }) {
        const membersPatch = dispatch(
          updateInjectedQueryData("getGroupMembers", groupId, (draft: IGroupMember[]) => {
            const idx = draft.findIndex((m) => m.userId === userId);
            if (idx >= 0) draft.splice(idx, 1);
          }) as never,
        ) as { undo: () => void };
        const conversationsPatch = dispatch(
          updateInjectedQueryData("getConversations", undefined, (draft: IConversation[]) => {
            const conv = draft.find((x) => x.conversationId === groupId);
            if (!conv || typeof conv.memberCount !== "number") return;
            conv.memberCount = Math.max(0, conv.memberCount - 1);
          }) as never,
        ) as { undo: () => void };
        try {
          const { data } = await queryFulfilled;
          const memberCount = data?.data?.memberCount;
          if (typeof memberCount === "number" && Number.isFinite(memberCount)) {
            dispatch(
              updateInjectedQueryData("getConversations", undefined, (draft: IConversation[]) => {
                const conv = draft.find((x) => x.conversationId === groupId);
                if (conv) conv.memberCount = Math.max(0, memberCount);
              }) as never,
            );
          }
        } catch {
          membersPatch.undo();
          conversationsPatch.undo();
        }
      },
    }),

    changeMemberRole: builder.mutation<ApiEnvelope<null>, ChangeMemberRoleRequest>({
      query: ({ groupId, userId, ...body }) => ({
        url: `/chat/groups/${groupId}/members/${userId}/role`,
        method: "PUT",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    transferGroupOwner: builder.mutation<ApiEnvelope<unknown>, TransferGroupOwnerRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/transfer-owner`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Conversations"],
    }),

    getGroupRequests: builder.query<GroupJoinRequestRow[], string>({
      query: (groupId) => `/chat/groups/${groupId}/requests`,
      transformResponse: (response: ApiEnvelope<unknown[]>): GroupJoinRequestRow[] => {
        const raw = response.data;
        if (!Array.isArray(raw)) return [];
        const out: GroupJoinRequestRow[] = [];
        for (const x of raw) {
          if (!x || typeof x !== "object") continue;
          const o = x as Record<string, unknown>;
          const userId = String(o.userId ?? "").trim();
          if (!userId) continue;
          const row: GroupJoinRequestRow = {
            userId,
            name: String(o.name ?? userId),
            avatar: o.avatar != null ? String(o.avatar) : null,
          };
          if (o.status != null) row.status = String(o.status);
          if (typeof o.isFriend === "boolean") row.isFriend = o.isFriend;
          out.push(row);
        }
        return out;
      },
      providesTags: (_result, _error, groupId) => [{ type: "GroupRequests", id: groupId }],
    }),

    approveGroupRequest: builder.mutation<ApiEnvelope<null>, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({
        url: `/chat/groups/${groupId}/requests/${userId}/approve`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "GroupRequests", id: arg.groupId },
        "Conversations",
      ],
    }),

    rejectGroupRequest: builder.mutation<ApiEnvelope<null>, { groupId: string; userId: string }>({
      query: ({ groupId, userId }) => ({
        url: `/chat/groups/${groupId}/requests/${userId}/reject`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "GroupRequests", id: arg.groupId },
        "Conversations",
      ],
    }),

    getGroupSettings: builder.query<IGroupSettings, string>({
      query: (groupId) => `/chat/groups/${groupId}/settings`,
      transformResponse: (response: ApiEnvelope<unknown>) => {
        return normalizeGroupSettings(response.data) ?? DEFAULT_GROUP_SETTINGS;
      },
      providesTags: (_result, _error, groupId) => [{ type: "GroupSettings", id: groupId }],
    }),

    updateGroupSettings: builder.mutation<ApiEnvelope<IGroupSettings>, UpdateGroupSettingsRequest>({
      query: ({ groupId, ...body }) => ({
        url: `/chat/groups/${groupId}/settings`,
        method: "PATCH",
        body,
      }),
      transformResponse: (response: ApiEnvelope<unknown>): ApiEnvelope<IGroupSettings> => {
        const norm = normalizeGroupSettings(response.data) ?? DEFAULT_GROUP_SETTINGS;
        return { ...response, data: norm };
      },
      invalidatesTags: (_r, _e, arg) => [
        { type: "GroupSettings", id: arg.groupId },
        "Conversations",
      ],
    }),
  }),
  /** Dev / Fast Refresh có thể gọi lại inject — tránh lỗi trùng tên endpoint. */
  overrideExisting: true,
});

export const {
  useGetGroupMembersQuery,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
  useLeaveGroupMutation,
  useAddMembersMutation,
  useRemoveMemberMutation,
  useChangeMemberRoleMutation,
  useTransferGroupOwnerMutation,
  useGetGroupRequestsQuery,
  useApproveGroupRequestMutation,
  useRejectGroupRequestMutation,
  useGetGroupSettingsQuery,
  useUpdateGroupSettingsMutation,
} = groupApi;
