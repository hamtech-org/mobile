import { useCallback, useEffect, type PropsWithChildren } from "react";
import { useDispatch, useSelector } from "react-redux";
import { router, usePathname } from "expo-router";

import { IncomingCallModal } from "@/components/call/IncomingCallModal";
import { env } from "@/config/env";
import { apiClient } from "@/services/api";
import { store, type AppDispatch, type RootState } from "@/store/store";
import {
  resetCall,
  resetUpgrade,
  setCallAccepted,
  setCallEnded,
  setEndReason,
  setIncomingCall,
  setJoiningGroupCall,
  setOutgoingCall,
  setReturnTo,
  setUpgradeAccepted,
  setUpgradePendingIncoming,
  setUpgradePendingOutgoing,
  setActiveGroupCall,
  toggleCamera,
  toggleMic,
} from "@/store/slices/callSlice";
import type { CallScope, CallType, IncomingCallData } from "@/types/call.types";

import { useSocketContext } from "./SocketContext";
import { CallContext, type CallContextValue } from "./callContext.shared";

export { useCallContext, type CallContextValue } from "./callContext.shared";

interface AgoraTokenResponse {
  token: string;
  uid: number;
  channel: string;
}

type ChannelReadyPayload = {
  channelName: string;
  conversationId?: string;
  scope?: CallScope;
  hostId?: string;
  sessionId?: string;
};

function buildCallParams(
  channelName: string,
  type: CallType,
  conversationId: string,
  returnTo: string,
  scope: CallScope,
  hostId?: string | null,
): Record<string, string> {
  const p: Record<string, string> = {
    channel: channelName,
    type,
    conversationId,
    returnTo: encodeURIComponent(returnTo),
    scope,
  };
  if (hostId) p.hostId = hostId;
  return p;
}

function conversationIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  const i = parts.indexOf("(chat)");
  if (i === -1) return null;
  return parts[i + 1] ?? null;
}

function canStartNewCall(status: string): boolean {
  return status === "idle" || status === "ended";
}

export const CallProvider = ({ children }: PropsWithChildren) => {
  const dispatch = useDispatch<AppDispatch>();
  const pathname = usePathname();
  const socket = useSocketContext();
  const callState = useSelector((state: RootState) => state.call);
  const currentUserId = useSelector((state: RootState) => state.auth.user?.userId ?? "");

  useEffect(() => {
    if (!socket) return;

    const onIncoming = (data: unknown) => {
      const payload = data as IncomingCallData;
      dispatch(setReturnTo(pathname));
      dispatch(setIncomingCall(payload));
    };

    const onAccepted = () => {
      dispatch(setCallAccepted());
    };

    const onRejected = () => {
      dispatch(setEndReason("rejected"));
      dispatch(setCallEnded());
    };

    const onEnded = () => {
      const st = store.getState().call.status;
      if (st === "incoming-ringing") {
        dispatch(setEndReason("missed"));
      }
      dispatch(setCallEnded());
    };

    const onUpgradeRequest = () => {
      dispatch(setUpgradePendingIncoming());
    };

    const onUpgradeResponse = (data: unknown) => {
      const payload = data as { accepted: boolean };
      if (payload.accepted) {
        dispatch(setUpgradeAccepted());
      } else {
        dispatch(resetUpgrade());
      }
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:upgrade-request", onUpgradeRequest);
    socket.on("call:upgrade-response", onUpgradeResponse);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:upgrade-request", onUpgradeRequest);
      socket.off("call:upgrade-response", onUpgradeResponse);
    };
  }, [dispatch, pathname, socket]);

  const fetchAgoraToken = useCallback(async (channelName: string): Promise<AgoraTokenResponse> => {
    const res = await apiClient.get("/agora/rtc-token", {
      params: { channelName },
    });
    return res.data.data as AgoraTokenResponse;
  }, []);

  const navigateToCall = useCallback(
    (
      channelName: string,
      type: CallType,
      conversationId: string,
      returnTo: string,
      scope: CallScope,
      hostId?: string | null,
    ) => {
      router.push({
        pathname: "/call",
        params: buildCallParams(channelName, type, conversationId, returnTo, scope, hostId),
      });
    },
    [],
  );

  const initiateCall = useCallback(
    (calleeId: string, type: CallType, conversationIdArg?: string) => {
      if (!socket || !canStartNewCall(callState.status)) return;

      const conversationId = conversationIdArg ?? conversationIdFromPathname(pathname);
      if (!conversationId) return;

      dispatch(setReturnTo(pathname));
      socket.emit("call:initiate", { calleeId, type, conversationId, scope: "direct" });

      socket.once("call:channel-ready", (data: unknown) => {
        const payload = data as ChannelReadyPayload;
        dispatch(
          setOutgoingCall({
            calleeId,
            callType: type,
            channelName: payload.channelName,
            conversationId: payload.conversationId ?? conversationId,
            returnTo: pathname,
            callScope: payload.scope ?? "direct",
            hostId: payload.hostId ?? null,
          }),
        );
        navigateToCall(
          payload.channelName,
          type,
          payload.conversationId ?? conversationId,
          pathname,
          payload.scope ?? "direct",
          payload.hostId,
        );
      });
    },
    [callState.status, dispatch, navigateToCall, pathname, socket],
  );

  const initiateGroupCall = useCallback(
    (type: CallType, conversationIdArg?: string) => {
      if (!socket || !canStartNewCall(callState.status)) return;

      const conversationId = conversationIdArg ?? conversationIdFromPathname(pathname);
      if (!conversationId) return;

      dispatch(setReturnTo(pathname));
      socket.emit("call:initiate", { type, conversationId, scope: "group" });

      socket.once("call:channel-ready", (data: unknown) => {
        const payload = data as ChannelReadyPayload;
        const conv = payload.conversationId ?? conversationId;
        if (payload.scope === "group" && payload.sessionId && conv) {
          dispatch(
            setActiveGroupCall({
              conversationId: conv,
              channelName: payload.channelName,
              type,
              hostId: payload.hostId ?? currentUserId,
              sessionId: payload.sessionId,
            }),
          );
        }
        dispatch(
          setOutgoingCall({
            callType: type,
            channelName: payload.channelName,
            conversationId: conv,
            returnTo: pathname,
            callScope: "group",
            hostId: payload.hostId ?? null,
            calleeId: null,
          }),
        );
        navigateToCall(payload.channelName, type, conv, pathname, "group", payload.hostId);
      });
    },
    [callState.status, currentUserId, dispatch, navigateToCall, pathname, socket],
  );

  const acceptCall = useCallback(() => {
    if (
      !socket ||
      callState.status !== "incoming-ringing" ||
      !callState.channelName ||
      !callState.callerId
    )
      return;

    socket.emit("call:accept", {
      channelName: callState.channelName,
      callerId: callState.callerId,
      conversationId: callState.conversationId,
      type: callState.callType || "audio",
    });
    dispatch(setCallAccepted());
    const rt = callState.returnTo ?? pathname;
    const convId = callState.conversationId || "";
    const scope = callState.callScope;
    const hostId = callState.hostId ?? callState.callerId;
    navigateToCall(
      callState.channelName,
      callState.callType || "audio",
      convId,
      rt,
      scope,
      scope === "group" ? hostId : null,
    );
  }, [callState, dispatch, navigateToCall, pathname, socket]);

  const rejectCall = useCallback(() => {
    if (!socket || !callState.channelName || !callState.callerId) return;

    socket.emit("call:reject", {
      channelName: callState.channelName,
      callerId: callState.callerId,
      conversationId: callState.conversationId,
      type: callState.callType || "audio",
    });
    dispatch(resetCall());
  }, [callState, dispatch, socket]);

  const endCall = useCallback(
    (meta?: { durationSec?: number; result?: "completed" | "missed" | "rejected" }) => {
      if (!socket || callState.callScope === "group") return;
      const peerId = callState.callerId || callState.calleeId;
      if (!callState.channelName || !peerId || !callState.conversationId) return;

      socket.emit("call:end", {
        channelName: callState.channelName,
        peerId,
        conversationId: callState.conversationId,
        type: callState.callType || "audio",
        durationSec: meta?.durationSec,
        result: meta?.result,
      });
      dispatch(setCallEnded());
    },
    [callState, dispatch, socket],
  );

  const leaveGroupCall = useCallback(() => {
    if (
      !socket ||
      callState.callScope !== "group" ||
      !callState.channelName ||
      !callState.conversationId
    )
      return;
    socket.emit("call:group-leave", {
      channelName: callState.channelName,
      conversationId: callState.conversationId,
    });
    dispatch(setCallEnded());
  }, [callState, dispatch, socket]);

  const endGroupCallForAll = useCallback(
    (meta?: { durationSec?: number }) => {
      if (
        !socket ||
        callState.callScope !== "group" ||
        !callState.channelName ||
        !callState.conversationId
      )
        return;
      if (!callState.hostId || callState.hostId !== currentUserId) return;

      socket.emit("call:group-end-all", {
        channelName: callState.channelName,
        conversationId: callState.conversationId,
        type: callState.callType || "audio",
        durationSec: meta?.durationSec,
      });
      dispatch(setCallEnded());
    },
    [callState, dispatch, currentUserId, socket],
  );

  const joinActiveGroupCall = useCallback(() => {
    const session = store.getState().call.activeGroupCall;
    const st = store.getState().call.status;
    if (!session) return;
    if (st !== "idle" && st !== "ended") return;
    const returnTo = pathname;
    dispatch(setReturnTo(returnTo));
    dispatch(
      setJoiningGroupCall({
        callType: session.type,
        channelName: session.channelName,
        conversationId: session.conversationId,
        hostId: session.hostId,
        returnTo,
      }),
    );
    navigateToCall(
      session.channelName,
      session.type,
      session.conversationId,
      returnTo,
      "group",
      session.hostId,
    );
  }, [dispatch, navigateToCall, pathname]);

  const requestUpgradeToVideo = useCallback(() => {
    if (!socket || callState.callScope === "group") return;
    const peerId = callState.callerId || callState.calleeId;
    if (!callState.channelName || !peerId) return;

    socket.emit("call:upgrade-request", {
      peerId,
      channelName: callState.channelName,
    });
    dispatch(setUpgradePendingOutgoing());
  }, [callState, dispatch, socket]);

  const respondUpgradeToVideo = useCallback(
    (accepted: boolean) => {
      if (!socket || callState.callScope === "group") return;
      const peerId = callState.callerId || callState.calleeId;
      if (!callState.channelName || !peerId) return;

      socket.emit("call:upgrade-response", {
        peerId,
        channelName: callState.channelName,
        accepted,
      });
      if (accepted) {
        dispatch(setUpgradeAccepted());
      } else {
        dispatch(resetUpgrade());
      }
    },
    [callState, dispatch, socket],
  );

  const onToggleMic = useCallback(() => dispatch(toggleMic()), [dispatch]);
  const onToggleCamera = useCallback(() => dispatch(toggleCamera()), [dispatch]);

  const value: CallContextValue = {
    initiateCall,
    initiateGroupCall,
    acceptCall,
    rejectCall,
    endCall,
    leaveGroupCall,
    endGroupCallForAll,
    joinActiveGroupCall,
    onToggleMic,
    onToggleCamera,
    requestUpgradeToVideo,
    respondUpgradeToVideo,
    fetchAgoraToken,
    appId: env.agoraAppId,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
      <IncomingCallModal />
    </CallContext.Provider>
  );
};
