import { useCallback, useMemo, useState, type ReactElement } from "react";

import { AddMembersModal } from "@/components/chat/AddMembersModal";
import { useGroupJoinLinkModalOptional } from "@/contexts/GroupJoinLinkModalContext";
import type { IConversation } from "@/types/chat.types";
import {
  useAddMembersMutation,
  useGetGroupMembersQuery,
  useGetGroupSettingsQuery,
} from "@/store/api/chatApi";
import { useGetFriendsQuery } from "@/store/api/userApi";
import { filterGroupMembersExcludingRemoved } from "@/utils/groupMembersRealtime";
import { getJoinGroupUrl } from "@/utils/joinGroupUrl";
import { toast } from "@/utils/appToast";

type GroupAddMembersModalProps = {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  conversation: Pick<IConversation, "name" | "avatar" | "groupSettings">;
  /** Gọi sau khi thêm thành công (refetch danh sách thành viên ngoài). */
  onAdded?: () => void;
};

/** Luồng thêm thành viên nhóm — đồng bộ web `AddMembersModal` + `handleAddMembers`. */
export function GroupAddMembersModal({
  visible,
  onClose,
  groupId,
  conversation,
  onAdded,
}: GroupAddMembersModalProps): ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: membersRaw = [], refetch: refetchMembers } = useGetGroupMembersQuery(groupId, {
    skip: !visible || !groupId,
    refetchOnMountOrArgChange: true,
  });

  const members = useMemo(
    () => filterGroupMembersExcludingRemoved(groupId, membersRaw),
    [groupId, membersRaw],
  );

  const { data: settings } = useGetGroupSettingsQuery(groupId, {
    skip: !visible || !groupId,
  });

  const { data: friends = [], isFetching: loadingFriends } = useGetFriendsQuery(undefined, {
    skip: !visible,
  });

  const [addMembers, { isLoading: adding }] = useAddMembersMutation();
  const joinLinkModal = useGroupJoinLinkModalOptional();

  const existingMemberIds = useMemo(() => members.map((m) => m.userId), [members]);
  const joinSuffix = settings?.joinLinkSuffix;
  const joinUrl = getJoinGroupUrl(joinSuffix);
  const allowJoinLink = settings?.adminSettings?.allowJoinLink;

  const openJoinLinkScreen = useCallback(() => {
    if (!joinSuffix || !joinUrl) return;
    joinLinkModal?.openGroupJoinLinkModal({
      suffix: joinSuffix,
      url: joinUrl,
      groupName: conversation.name ?? "Nhóm",
      groupAvatar: conversation.avatar,
      conversationId: groupId,
    });
  }, [conversation.avatar, conversation.name, groupId, joinLinkModal, joinSuffix, joinUrl]);

  const openShareJoinLinkPicker = useCallback(() => {
    if (!joinSuffix || !joinUrl) return;
    joinLinkModal?.openShareGroupJoinLinkPicker({
      suffix: joinSuffix,
      url: joinUrl,
      groupName: conversation.name ?? "Nhóm",
      groupAvatar: conversation.avatar,
      conversationId: groupId,
    });
  }, [conversation.avatar, conversation.name, groupId, joinLinkModal, joinSuffix, joinUrl]);

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId);
      else n.add(userId);
      return n;
    });
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      toast.error("Chọn ít nhất một bạn bè");
      return;
    }
    try {
      await addMembers({ groupId, memberIds: ids }).unwrap();
      setSelectedIds(new Set());
      void refetchMembers();
      onAdded?.();
      handleClose();
      const approvalRequired = settings?.adminSettings?.approvalRequired;
      toast.success(approvalRequired ? "Đã gửi lời mời vào nhóm" : "Đã thêm thành viên vào nhóm");
    } catch {
      toast.error("Không thể mời thành viên");
    }
  }, [
    addMembers,
    groupId,
    handleClose,
    onAdded,
    refetchMembers,
    selectedIds,
    settings?.adminSettings?.approvalRequired,
  ]);

  return (
    <AddMembersModal
      visible={visible}
      onClose={handleClose}
      friends={friends}
      isLoadingFriends={loadingFriends}
      existingMemberIds={existingMemberIds}
      selectedIds={selectedIds}
      onToggleSelect={toggleSelect}
      onConfirm={() => void handleConfirm()}
      isSubmitting={adding}
      showJoinLinkActions={Boolean(allowJoinLink && joinSuffix)}
      onOpenJoinLink={joinSuffix ? openJoinLinkScreen : undefined}
      onShareJoinLink={joinSuffix ? openShareJoinLinkPicker : undefined}
    />
  );
}
