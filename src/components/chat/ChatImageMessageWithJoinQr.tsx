import { useCallback, useState } from "react";
import { router } from "expo-router";

import {
  ChatImageMessageCard,
  type ChatImageMessageCardProps,
} from "@/components/chat/ChatImageMessageCard";
import { ImageJoinQrJoinBar, ImageJoinQrJoinBarWrap } from "@/components/chat/ImageJoinQrJoinBar";
import { UserQrProfileModal } from "@/components/social/UserQrProfileModal";
import { useGroupJoinLinkModalOptional } from "@/contexts/GroupJoinLinkModalContext";
import { useChatQrInImage } from "@/hooks/useChatQrInImage";
import { getJoinGroupUrl } from "@/utils/joinGroupUrl";

type Props = ChatImageMessageCardProps & {
  messageId: string;
  scanEnabled: boolean;
};

export function ChatImageMessageWithJoinQr({ messageId, scanEnabled, ...imageProps }: Props) {
  const joinLinkModal = useGroupJoinLinkModalOptional();
  const { qrResult } = useChatQrInImage(imageProps.uri, messageId, scanEnabled);
  const [userQrOpen, setUserQrOpen] = useState(false);
  const joinSuffix = qrResult?.kind === "group_join" ? qrResult.suffix : null;
  const userQr = qrResult?.kind === "user" ? qrResult.user : null;

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

  const openUserFromQr = useCallback(() => {
    if (!userQr) return;
    setUserQrOpen(true);
  }, [userQr]);

  return (
    <>
      <ChatImageMessageCard {...imageProps} />
      {joinSuffix || userQr ? (
        <ImageJoinQrJoinBarWrap>
          <ImageJoinQrJoinBar
            onPress={joinSuffix ? openJoinFromQr : openUserFromQr}
            label={joinSuffix ? "Quét mã QR tham gia nhóm" : "Xem thông tin người dùng"}
            accessibilityLabel={joinSuffix ? "Quét mã QR tham gia nhóm" : "Xem QR người dùng"}
          />
        </ImageJoinQrJoinBarWrap>
      ) : null}
      <UserQrProfileModal visible={userQrOpen} user={userQr} onClose={() => setUserQrOpen(false)} />
    </>
  );
}
