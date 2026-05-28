import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { GroupJoinLinkModal } from "@/components/chat/GroupJoinLinkModal";
import { ShareGroupJoinLinkPickerModal } from "@/components/chat/ShareGroupJoinLinkPickerModal";
import type { GroupJoinLinkMessagePayload } from "@/utils/groupJoinLinkMessage";

export type GroupJoinLinkModalData = {
  groupName: string;
  groupAvatar?: string | null;
  suffix: string;
  url: string;
  conversationId?: string;
};

type Ctx = {
  openGroupJoinLinkModal: (data: GroupJoinLinkModalData) => void;
  openFromPayload: (payload: GroupJoinLinkMessagePayload) => void;
  openShareGroupJoinLinkPicker: (data: GroupJoinLinkModalData) => void;
  closeGroupJoinLinkModal: () => void;
  closeShareGroupJoinLinkPicker: () => void;
};

const GroupJoinLinkModalContext = createContext<Ctx | null>(null);

export function GroupJoinLinkModalProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GroupJoinLinkModalData | null>(null);
  const [shareData, setShareData] = useState<GroupJoinLinkModalData | null>(null);

  const openGroupJoinLinkModal = useCallback((next: GroupJoinLinkModalData) => setData(next), []);
  const openFromPayload = useCallback((payload: GroupJoinLinkMessagePayload) => {
    setData({
      groupName: payload.groupName,
      groupAvatar: payload.groupAvatar,
      suffix: payload.suffix,
      url: payload.url,
      conversationId: payload.conversationId,
    });
  }, []);
  const openShareGroupJoinLinkPicker = useCallback((next: GroupJoinLinkModalData) => {
    setShareData(next);
  }, []);
  const closeGroupJoinLinkModal = useCallback(() => setData(null), []);
  const closeShareGroupJoinLinkPicker = useCallback(() => setShareData(null), []);

  const value = useMemo(
    () => ({
      openGroupJoinLinkModal,
      openFromPayload,
      openShareGroupJoinLinkPicker,
      closeGroupJoinLinkModal,
      closeShareGroupJoinLinkPicker,
    }),
    [
      openFromPayload,
      openGroupJoinLinkModal,
      openShareGroupJoinLinkPicker,
      closeGroupJoinLinkModal,
      closeShareGroupJoinLinkPicker,
    ],
  );

  return (
    <GroupJoinLinkModalContext.Provider value={value}>
      {children}
      <GroupJoinLinkModal open={Boolean(data)} data={data} onClose={closeGroupJoinLinkModal} />
      <ShareGroupJoinLinkPickerModal
        open={Boolean(shareData)}
        link={shareData}
        excludeConversationId={shareData?.conversationId}
        onClose={closeShareGroupJoinLinkPicker}
      />
    </GroupJoinLinkModalContext.Provider>
  );
}

export function useGroupJoinLinkModal(): Ctx {
  const ctx = useContext(GroupJoinLinkModalContext);
  if (!ctx) throw new Error("useGroupJoinLinkModal must be used within GroupJoinLinkModalProvider");
  return ctx;
}

export function useGroupJoinLinkModalOptional(): Ctx | null {
  return useContext(GroupJoinLinkModalContext);
}
