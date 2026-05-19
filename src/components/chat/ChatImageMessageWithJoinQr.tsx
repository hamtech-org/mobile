import { useCallback } from "react";
import { router } from "expo-router";

import {
  ChatImageMessageCard,
  type ChatImageMessageCardProps,
} from "@/components/chat/ChatImageMessageCard";
import { ImageJoinQrJoinBar, ImageJoinQrJoinBarWrap } from "@/components/chat/ImageJoinQrJoinBar";
import { useGroupJoinLinkModalOptional } from "@/contexts/GroupJoinLinkModalContext";
import { useJoinQrInImage } from "@/hooks/useJoinQrInImage";
import { getJoinGroupUrl } from "@/utils/joinGroupUrl";

type Props = ChatImageMessageCardProps & {
  messageId: string;
  scanEnabled: boolean;
};

export function ChatImageMessageWithJoinQr({ messageId, scanEnabled, ...imageProps }: Props) {
  const joinLinkModal = useGroupJoinLinkModalOptional();
  const { joinSuffix } = useJoinQrInImage(imageProps.uri, messageId, scanEnabled);

  const openJoinFromQr = useCallback(() => {
    if (!joinSuffix) return;
    if (joinLinkModal) {
      joinLinkModal.openGroupJoinLinkModal({
        suffix: joinSuffix,
        url: getJoinGroupUrl(joinSuffix),
        groupName: "Nhóm chat",
      });
      return;
    }
    router.push(`/join/${joinSuffix}`);
  }, [joinLinkModal, joinSuffix]);

  return (
    <>
      <ChatImageMessageCard {...imageProps} />
      {joinSuffix ? (
        <ImageJoinQrJoinBarWrap>
          <ImageJoinQrJoinBar onPress={openJoinFromQr} />
        </ImageJoinQrJoinBarWrap>
      ) : null}
    </>
  );
}
