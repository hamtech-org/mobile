import { useCallback, useEffect, useMemo, useState } from "react";

import { useSocketContext } from "@/contexts/SocketContext";
import { useAppSelector } from "@/hooks/useAppStore";
import type { LiveSessionListItem } from "@/store/api/liveApi";

export const LIVE_AS_VIEWER_PARAM = "asViewer";

function queryHostPublishingElsewhere(
  socket: ReturnType<typeof useSocketContext>,
  sessionId: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve(false);
      return;
    }
    socket.emit(
      "live:host-publish-query",
      { sessionId },
      (res: { publishingElsewhere?: boolean }) => {
        resolve(Boolean(res?.publishingElsewhere));
      },
    );
  });
}

export function useMyLiveDirectory(sessions: LiveSessionListItem[] | undefined) {
  const socket = useSocketContext();
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const [hostPublishingElsewhere, setHostPublishingElsewhere] = useState(false);

  const mySession = useMemo(
    () => sessions?.find((s) => s.hostUserId === currentUserId && s.status === "live") ?? null,
    [sessions, currentUserId],
  );

  const publicSessions = useMemo(
    () => sessions?.filter((s) => s.hostUserId !== currentUserId) ?? [],
    [sessions, currentUserId],
  );

  const refreshPublishStatus = useCallback(async () => {
    if (!mySession || !socket) {
      setHostPublishingElsewhere(false);
      return;
    }
    const elsewhere = await queryHostPublishingElsewhere(socket, mySession.sessionId);
    setHostPublishingElsewhere(elsewhere);
  }, [mySession, socket]);

  useEffect(() => {
    void refreshPublishStatus();
  }, [refreshPublishStatus]);

  useEffect(() => {
    if (!mySession || !socket) return;

    const onMyHostPublishing = (raw: unknown) => {
      const p = raw as { sessionId?: string };
      if (p?.sessionId !== mySession.sessionId) return;
      void refreshPublishStatus();
    };

    socket.on("live:my-host-publishing", onMyHostPublishing);
    return () => {
      socket.off("live:my-host-publishing", onMyHostPublishing);
    };
  }, [mySession, refreshPublishStatus, socket]);

  const showMyLiveViewerButton = Boolean(mySession && hostPublishingElsewhere);
  const showResumeHostButton = Boolean(mySession && !hostPublishingElsewhere);

  return {
    mySession,
    publicSessions,
    showMyLiveViewerButton,
    showResumeHostButton,
    hasMyActiveSession: Boolean(mySession),
  };
}
