export type CallType = "audio" | "video";

export type CallScope = "direct" | "group";

export type CallStatus =
  | "idle"
  | "outgoing-ringing"
  | "incoming-ringing"
  | "connecting"
  | "connected"
  | "ended";

export type UpgradeStatus = "none" | "pending-outgoing" | "pending-incoming" | "accepted";

export type ActiveGroupCallSession = {
  conversationId: string;
  channelName: string;
  type: CallType;
  hostId: string;
  sessionId: string;
};

export interface CallState {
  status: CallStatus;
  callType: CallType | null;
  callScope: CallScope;
  hostId: string | null;
  channelName: string | null;
  conversationId: string | null;
  callerId: string | null;
  callerName: string | null;
  calleeId: string | null;
  isMicOn: boolean;
  isCameraOn: boolean;
  upgradeStatus: UpgradeStatus;
  isScreenSharing: boolean;
  returnTo: string | null;
  endReason: "missed" | "rejected" | "busy" | null;
  activeGroupCall: ActiveGroupCallSession | null;
}

export interface IncomingCallData {
  callerId: string;
  callerName: string;
  type: CallType;
  channelName: string;
  conversationId: string;
  scope?: CallScope;
  hostId?: string;
  sessionId?: string;
}

/** Server → callee: một thiết bị khác của cùng user đã accept/reject — tắt chuông đồng bộ. */
export interface IncomingCallDismissedPayload {
  channelName: string;
  conversationId: string;
  reason: "accepted" | "rejected";
}
