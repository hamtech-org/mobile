import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  CallState,
  CallType,
  CallScope,
  IncomingCallData,
  ActiveGroupCallSession,
} from "@/types/call.types";

const initialState: CallState = {
  status: "idle",
  callType: null,
  callScope: "direct",
  hostId: null,
  channelName: null,
  conversationId: null,
  callerId: null,
  callerName: null,
  calleeId: null,
  isMicOn: true,
  isCameraOn: true,
  upgradeStatus: "none",
  isScreenSharing: false,
  returnTo: null,
  endReason: null,
  activeGroupCall: null,
};

const callSlice = createSlice({
  name: "call",
  initialState,
  reducers: {
    setOutgoingCall: (
      state,
      action: PayloadAction<{
        calleeId?: string | null;
        callType: CallType;
        channelName: string;
        conversationId?: string | null;
        returnTo?: string | null;
        callScope?: CallScope;
        hostId?: string | null;
      }>,
    ) => {
      state.status = "outgoing-ringing";
      state.callType = action.payload.callType;
      state.callScope = action.payload.callScope ?? "direct";
      state.hostId = action.payload.hostId ?? null;
      state.calleeId = action.payload.calleeId ?? null;
      state.channelName = action.payload.channelName;
      state.conversationId = action.payload.conversationId ?? state.conversationId ?? null;
      state.isMicOn = true;
      state.isCameraOn = action.payload.callType === "video";
      state.returnTo = action.payload.returnTo ?? state.returnTo ?? null;
      state.endReason = null;
    },
    setIncomingCall: (state, action: PayloadAction<IncomingCallData>) => {
      if (state.status !== "idle" && state.status !== "ended") return;
      state.status = "incoming-ringing";
      state.callType = action.payload.type;
      state.callerId = action.payload.callerId;
      state.callerName = action.payload.callerName;
      state.channelName = action.payload.channelName;
      state.conversationId = action.payload.conversationId;
      state.callScope = action.payload.scope ?? "direct";
      state.hostId = action.payload.hostId ?? action.payload.callerId;
      state.calleeId = null;
      state.isMicOn = true;
      state.isCameraOn = action.payload.type === "video";
      state.upgradeStatus = "none";
      state.isScreenSharing = false;
      state.endReason = null;
    },
    setCallAccepted: (state) => {
      state.status = "connecting";
    },
    setCallConnected: (state) => {
      state.status = "connected";
    },
    setCallEnded: (state) => {
      state.status = "ended";
    },
    setEndReason: (state, action: PayloadAction<"missed" | "rejected" | null>) => {
      state.endReason = action.payload;
    },
    setReturnTo: (state, action: PayloadAction<string | null>) => {
      state.returnTo = action.payload;
    },
    toggleMic: (state) => {
      state.isMicOn = !state.isMicOn;
    },
    toggleCamera: (state) => {
      state.isCameraOn = !state.isCameraOn;
    },
    setUpgradePendingOutgoing: (state) => {
      state.upgradeStatus = "pending-outgoing";
    },
    setUpgradePendingIncoming: (state) => {
      state.upgradeStatus = "pending-incoming";
    },
    setUpgradeAccepted: (state) => {
      state.upgradeStatus = "accepted";
      state.callType = "video";
      state.isCameraOn = true;
    },
    resetUpgrade: (state) => {
      state.upgradeStatus = "none";
    },
    setScreenSharing: (state, action: PayloadAction<boolean>) => {
      state.isScreenSharing = action.payload;
    },
    setActiveGroupCall: (state, action: PayloadAction<ActiveGroupCallSession | null>) => {
      state.activeGroupCall = action.payload;
    },
    clearActiveGroupCallMatching: (
      state,
      action: PayloadAction<{ conversationId: string; sessionId?: string }>,
    ) => {
      const cur = state.activeGroupCall;
      if (!cur || cur.conversationId !== action.payload.conversationId) return;
      if (action.payload.sessionId && cur.sessionId !== action.payload.sessionId) return;
      state.activeGroupCall = null;
    },
    setJoiningGroupCall: (
      state,
      action: PayloadAction<{
        callType: CallType;
        channelName: string;
        conversationId: string;
        hostId: string;
        returnTo: string;
      }>,
    ) => {
      state.status = "connecting";
      state.callType = action.payload.callType;
      state.callScope = "group";
      state.hostId = action.payload.hostId;
      state.channelName = action.payload.channelName;
      state.conversationId = action.payload.conversationId;
      state.returnTo = action.payload.returnTo;
      state.callerId = null;
      state.calleeId = null;
      state.callerName = null;
      state.isMicOn = true;
      state.isCameraOn = action.payload.callType === "video";
      state.upgradeStatus = "none";
      state.isScreenSharing = false;
      state.endReason = null;
    },
    resetCall: (state) => {
      const active = state.activeGroupCall;
      Object.assign(state, { ...initialState, activeGroupCall: active });
    },
  },
});

export const {
  setOutgoingCall,
  setIncomingCall,
  setCallAccepted,
  setCallConnected,
  setCallEnded,
  setReturnTo,
  setEndReason,
  toggleMic,
  toggleCamera,
  setUpgradePendingOutgoing,
  setUpgradePendingIncoming,
  setUpgradeAccepted,
  resetUpgrade,
  setScreenSharing,
  setActiveGroupCall,
  clearActiveGroupCallMatching,
  setJoiningGroupCall,
  resetCall,
} = callSlice.actions;

export const callReducer = callSlice.reducer;
