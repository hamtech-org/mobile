import { useCallback } from "react";

import {
  useCreateConversationMutation,
  useGetConversationsQuery,
  useSendMessageMutation,
} from "@/store/api/chatApi";
import { buildGroupJoinLinkMessageContent } from "@/utils/groupJoinLinkMessage";
import type { GroupJoinLinkModalData } from "@/contexts/GroupJoinLinkModalContext";
import { toast } from "@/utils/appToast";

function buildContent(link: GroupJoinLinkModalData): string {
  return buildGroupJoinLinkMessageContent({
    suffix: link.suffix,
    groupName: link.groupName,
    groupAvatar: link.groupAvatar,
    conversationId: link.conversationId,
    url: link.url,
  });
}

export function useShareGroupJoinLink() {
  const { data: conversations } = useGetConversationsQuery();
  const [createConversation] = useCreateConversationMutation();
  const [sendMessage, { isLoading }] = useSendMessageMutation();

  const shareToConversation = useCallback(
    async (conversationId: string, link: GroupJoinLinkModalData) => {
      await sendMessage({
        conversationId,
        type: "text",
        content: buildContent(link),
      }).unwrap();
    },
    [sendMessage],
  );

  const shareToFriend = useCallback(
    async (friendId: string, link: GroupJoinLinkModalData) => {
      const list = conversations ?? [];
      let conv = list.find((c) => c.type === "direct" && c.otherUserId === friendId);
      if (!conv) {
        const created = await createConversation({
          type: "direct",
          memberIds: [friendId],
        }).unwrap();
        conv = created.data;
      }
      await shareToConversation(conv.conversationId, link);
    },
    [conversations, createConversation, shareToConversation],
  );

  const shareToMany = useCallback(
    async (
      targets: { conversationIds: string[]; friendIds: string[] },
      link: GroupJoinLinkModalData,
    ) => {
      const { conversationIds, friendIds } = targets;
      if (conversationIds.length === 0 && friendIds.length === 0) return;

      await Promise.all([
        ...conversationIds.map((id) => shareToConversation(id, link)),
        ...friendIds.map((id) => shareToFriend(id, link)),
      ]);

      const n = conversationIds.length + friendIds.length;
      toast.success(n === 1 ? "Đã gửi link mời" : `Đã gửi link tới ${n} hội thoại`);
    },
    [shareToConversation, shareToFriend],
  );

  return { shareToMany, isSharing: isLoading };
}
