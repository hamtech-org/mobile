import { createContext, useContext } from "react";

import type { CallType } from "@/types/call.types";

interface AgoraTokenResponse {
  token: string;
  uid: number;
  channel: string;
}

export interface CallContextValue {
  initiateCall: (calleeId: string, type: CallType, conversationIdArg?: string) => void;
  initiateGroupCall: (type: CallType, conversationIdArg?: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: (meta?: {
    durationSec?: number;
    result?: "completed" | "missed" | "rejected" | "cancelled";
  }) => void;
  leaveGroupCall: () => void;
  endGroupCallForAll: (meta?: { durationSec?: number }) => void;
  joinActiveGroupCall: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  requestUpgradeToVideo: () => void;
  respondUpgradeToVideo: (accepted: boolean) => void;
  fetchAgoraToken: (channelName: string) => Promise<AgoraTokenResponse>;
  appId: string;
}

export const CallContext = createContext<CallContextValue | null>(null);

export const useCallContext = (): CallContextValue => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCallContext phải dùng trong CallProvider");
  return ctx;
};
