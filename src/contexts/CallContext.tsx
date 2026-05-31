import { useCallback, useEffect, type PropsWithChildren } from "react";
import { useDispatch, useSelector } from "react-redux";
import { router, usePathname } from "expo-router";
import { Alert } from "react-native";
import { Audio } from "expo-av";

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
import type {
  CallScope,
  CallType,
  IncomingCallData,
  IncomingCallDismissedPayload,
} from "@/types/call.types";

import {
  dismissCallSystemNotification,
  showIncomingCallSystemNotification,
} from "@/utils/notificationPresenters";
import {
  clearPendingIncomingCall,
  isCallLifecycleClosed,
  markCallLifecycleClosed,
} from "@/utils/callNotificationActions";
import { isSocketLocalNotificationEnabled } from "@/utils/localSystemNotification";

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
  sessionId?: string | null,
): Record<string, string> {
  const p: Record<string, string> = {
    channel: channelName,
    type,
    conversationId,
    returnTo: encodeURIComponent(returnTo),
    scope,
  };
  if (hostId) p.hostId = hostId;
  if (sessionId) p.sessionId = sessionId;
  return p;
}

function openCallRoute(
  params: Record<string, string>,
  options?: {
    replace?: boolean;
  },
): void {
  const route = {
    pathname: "/call",
    params,
  } as const;
  // Luôn dùng replace cho màn hình cuộc gọi để tránh đè màn hình trong stack navigation
  router.replace(route as never);
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

async function playCuocGoiNhoTone(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require("../../assets/ringtones/CuocGoiNho.mp3");
    const { sound } = await Audio.Sound.createAsync(src, { shouldPlay: true, volume: 1 });
    sound.setOnPlaybackStatusUpdate((st) => {
      if (st.isLoaded && st.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    /* ignore */
  }
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
      void (async () => {
        const payload = data as IncomingCallData;
        if (await isCallLifecycleClosed(payload as unknown as Record<string, unknown>)) return;
        dispatch(setReturnTo(pathname));
        dispatch(setIncomingCall(payload));
        if (isSocketLocalNotificationEnabled()) {
          showIncomingCallSystemNotification(payload);
        }
      })();
    };

    const onAccepted = () => {
      const ch = store.getState().call.channelName;
      if (ch) void dismissCallSystemNotification(ch);
      void clearPendingIncomingCall();
      dispatch(setCallAccepted());
    };

    const onRejected = (data: unknown) => {
      const payload = data as {
        channelName?: string;
        conversationId?: string;
        sessionId?: string;
      };
      const ch = store.getState().call.channelName;
      if (ch) void dismissCallSystemNotification(ch);
      void markCallLifecycleClosed(
        {
          channelName: payload.channelName ?? ch ?? undefined,
          conversationId:
            payload.conversationId ?? store.getState().call.conversationId ?? undefined,
          sessionId: payload.sessionId ?? store.getState().call.sessionId ?? undefined,
        },
        "rejected",
      );
      void clearPendingIncomingCall();
      void playCuocGoiNhoTone();
      dispatch(setEndReason("rejected"));
      dispatch(setCallEnded());
    };

    const onEnded = (data: unknown) => {
      const payload = data as {
        channelName?: string;
        conversationId?: string;
      };
      const st = store.getState().call;
      if (st.status === "idle") return;
      if (payload.channelName && st.channelName && st.channelName !== payload.channelName) return;
      if (
        payload.conversationId &&
        st.conversationId &&
        st.conversationId !== payload.conversationId
      ) {
        return;
      }
      if (st.channelName) void dismissCallSystemNotification(st.channelName);
      void markCallLifecycleClosed(
        {
          channelName: payload.channelName ?? st.channelName ?? undefined,
          conversationId: payload.conversationId ?? st.conversationId ?? undefined,
          sessionId: (payload as { sessionId?: string }).sessionId ?? st.sessionId ?? undefined,
        },
        "ended",
      );
      void clearPendingIncomingCall();
      if (st.status === "incoming-ringing") {
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

    const onIncomingDismissed = (data: unknown) => {
      const p = data as IncomingCallDismissedPayload;
      if (!p?.channelName || !p?.conversationId) return;
      void dismissCallSystemNotification(p.channelName);
      void markCallLifecycleClosed(
        {
          channelName: p.channelName,
          conversationId: p.conversationId,
          sessionId: (p as { sessionId?: string }).sessionId,
        },
        p.reason ?? "incoming-dismissed",
      );
      void clearPendingIncomingCall();
      const st = store.getState().call;
      if (st.status !== "incoming-ringing") return;
      if (st.channelName !== p.channelName) return;
      if (st.conversationId !== p.conversationId) return;
      dispatch(resetCall());
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:accepted", onAccepted);
    socket.on("call:rejected", onRejected);
    socket.on("call:ended", onEnded);
    socket.on("call:incoming-dismissed", onIncomingDismissed);
    socket.on("call:upgrade-request", onUpgradeRequest);
    socket.on("call:upgrade-response", onUpgradeResponse);

    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:accepted", onAccepted);
      socket.off("call:rejected", onRejected);
      socket.off("call:ended", onEnded);
      socket.off("call:incoming-dismissed", onIncomingDismissed);
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
      sessionId?: string | null,
    ) => {
      openCallRoute(
        buildCallParams(channelName, type, conversationId, returnTo, scope, hostId, sessionId),
      );
    },
    [],
  );

  const initiateCall = useCallback(
    (calleeId: string, type: CallType, conversationIdArg?: string) => {
      if (!socket || !canStartNewCall(callState.status)) return;

      const conversationId = conversationIdArg ?? conversationIdFromPathname(pathname);
      if (!conversationId) return;

      dispatch(setReturnTo(pathname));

      const detachInitiateListeners = () => {
        socket.off("call:channel-ready", onChannelReady);
        socket.off("call:busy", onBusy);
        socket.off("call:blocked", onBlocked);
      };

      const onBusy = (raw: unknown) => {
        const p = raw as { conversationId?: string };
        if (p?.conversationId !== conversationId) return;
        detachInitiateListeners();
        void playCuocGoiNhoTone();
        Alert.alert("Đang bận", "Người nhận đang trong cuộc gọi khác.");
      };

      const onBlocked = (raw: unknown) => {
        const p = raw as { conversationId?: string };
        if (p?.conversationId !== conversationId) return;
        detachInitiateListeners();
        Alert.alert(
          "Khong the goi",
          "Cuoc goi 1-1 bi chan vi mot trong hai ben da chan nguoi con lai.",
        );
      };

      const onChannelReady = (data: unknown) => {
        detachInitiateListeners();
        const payload = data as ChannelReadyPayload;
        dispatch(
          setOutgoingCall({
            calleeId,
            callType: type,
            channelName: payload.channelName,
            conversationId: payload.conversationId ?? conversationId,
            sessionId: payload.sessionId ?? null,
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
          payload.sessionId,
        );
      };

      socket.on("call:busy", onBusy);
      socket.on("call:blocked", onBlocked);
      socket.on("call:channel-ready", onChannelReady);
      socket.emit("call:initiate", { calleeId, type, conversationId, scope: "direct" });
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
            sessionId: payload.sessionId ?? null,
            returnTo: pathname,
            callScope: "group",
            hostId: payload.hostId ?? null,
            calleeId: null,
          }),
        );
        navigateToCall(
          payload.channelName,
          type,
          conv,
          pathname,
          "group",
          payload.hostId,
          payload.sessionId,
        );
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
      sessionId: callState.sessionId,
    });
    void dismissCallSystemNotification(callState.channelName);
    void markCallLifecycleClosed(
      {
        channelName: callState.channelName,
        conversationId: callState.conversationId ?? undefined,
        sessionId: callState.sessionId ?? undefined,
      },
      "accepted",
    );
    void clearPendingIncomingCall();
    dispatch(setCallAccepted());
    const rt = callState.returnTo ?? pathname;
    const convId = callState.conversationId || "";
    const scope = callState.callScope;
    const hostId = callState.hostId ?? callState.callerId;
    openCallRoute(
      buildCallParams(
        callState.channelName,
        callState.callType || "audio",
        convId,
        rt,
        scope,
        scope === "group" ? hostId : null,
        callState.sessionId,
      ),
      { replace: true },
    );
  }, [callState, dispatch, pathname, socket]);

  const rejectCall = useCallback(() => {
    if (!socket || !callState.channelName || !callState.callerId) return;

    socket.emit("call:reject", {
      channelName: callState.channelName,
      callerId: callState.callerId,
      conversationId: callState.conversationId,
      type: callState.callType || "audio",
      sessionId: callState.sessionId,
    });
    void dismissCallSystemNotification(callState.channelName);
    void markCallLifecycleClosed(
      {
        channelName: callState.channelName,
        conversationId: callState.conversationId ?? undefined,
        sessionId: callState.sessionId ?? undefined,
      },
      "rejected",
    );
    void clearPendingIncomingCall();
    dispatch(resetCall());
  }, [callState, dispatch, socket]);

  const endCall = useCallback(
    (meta?: {
      durationSec?: number;
      result?: "completed" | "missed" | "rejected" | "cancelled";
    }) => {
      if (!socket || callState.callScope === "group") return;
      const peerId = callState.callerId || callState.calleeId;
      if (!callState.channelName || !peerId || !callState.conversationId) return;

      socket.emit("call:end", {
        channelName: callState.channelName,
        peerId,
        conversationId: callState.conversationId,
        type: callState.callType || "audio",
        sessionId: callState.sessionId,
        durationSec: meta?.durationSec,
        result: meta?.result,
      });
      void markCallLifecycleClosed(
        {
          channelName: callState.channelName,
          conversationId: callState.conversationId,
          sessionId: callState.sessionId ?? undefined,
        },
        meta?.result ?? "ended",
      );
      void clearPendingIncomingCall();
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
        sessionId: session.sessionId,
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
      session.sessionId,
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
      <IncomingCallModal acceptCall={acceptCall} rejectCall={rejectCall} />
    </CallContext.Provider>
  );
};
