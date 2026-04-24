import type { Socket } from "socket.io-client";

import { store } from "@/store/store";
import { clearActiveGroupCallMatching, setActiveGroupCall } from "@/store/slices/callSlice";
import type { CallType } from "@/types/call.types";

let boundSocket: Socket | null = null;

const onGroupActive = (data: unknown) => {
  const p = data as {
    conversationId?: string;
    channelName?: string;
    type?: CallType;
    hostId?: string;
    sessionId?: string;
  };
  if (!p.conversationId || !p.channelName || !p.sessionId) return;
  store.dispatch(
    setActiveGroupCall({
      conversationId: p.conversationId,
      channelName: p.channelName,
      type: p.type === "audio" || p.type === "video" ? p.type : "video",
      hostId: p.hostId ?? "",
      sessionId: p.sessionId,
    }),
  );
};

const onGroupInactive = (data: unknown) => {
  const p = data as { conversationId?: string; sessionId?: string };
  if (!p.conversationId) return;
  store.dispatch(
    clearActiveGroupCallMatching({
      conversationId: p.conversationId,
      sessionId: p.sessionId,
    }),
  );
};

const onCallEndedGroup = (data: unknown) => {
  const p = data as { scope?: string; conversationId?: string; sessionId?: string };
  if (p?.scope !== "group" || !p.conversationId) return;
  store.dispatch(
    clearActiveGroupCallMatching({
      conversationId: p.conversationId,
      sessionId: p.sessionId,
    }),
  );
};

export function attachCallGroupSocketToRedux(socket: Socket): void {
  detachCallGroupSocketFromRedux();
  socket.on("call:group-active", onGroupActive);
  socket.on("call:group-inactive", onGroupInactive);
  socket.on("call:ended", onCallEndedGroup);
  boundSocket = socket;
}

export function detachCallGroupSocketFromRedux(): void {
  if (!boundSocket) return;
  boundSocket.off("call:group-active", onGroupActive);
  boundSocket.off("call:group-inactive", onGroupInactive);
  boundSocket.off("call:ended", onCallEndedGroup);
  boundSocket = null;
}
