import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type {
  CallState,
  CallType,
  CallScope,
  IncomingCallData,
  ActiveGroupCallSession,
  CallDeviceAvailability,
} from "@/types/call.types";

function applyDefaultDeviceState(
  state: CallState,
  callType: CallType | null,
  keepCameraPreference = false,
): void {
  state.isMicOn = true;
  state.isCameraOn = keepCameraPreference ? state.isCameraOn : callType === "video";
  state.micAvailability = "available";
  state.cameraAvailability = callType === "video" ? "available" : "unavailable";
  state.micErrorMessage = null;
  state.cameraErrorMessage = null;
  state.receiveOnly = false;
}

const initialState: CallState = {
  status: "idle",
  callType: null,
  callScope: "direct",
  hostId: null,
  channelName: null,
  conversationId: null,
  sessionId: null,
  callerId: null,
  callerName: null,
  calleeId: null,
  isMicOn: true,
  isCameraOn: true,
  micAvailability: "available",
  cameraAvailability: "unavailable",
  micErrorMessage: null,
  cameraErrorMessage: null,
  receiveOnly: false,
  upgradeStatus: "none",
  isScreenSharing: false,
  returnTo: null,
  endReason: null,
  activeGroupCall: null,
};

function applyIncomingCallState(state: CallState, payload: IncomingCallData): void {
  state.status = "incoming-ringing";
  state.callType = payload.type;
  state.callerId = payload.callerId;
  state.callerName = payload.callerName;
  state.channelName = payload.channelName;
  state.conversationId = payload.conversationId;
  state.sessionId = payload.sessionId ?? null;
  state.callScope = payload.scope ?? "direct";
  state.hostId = payload.hostId ?? payload.callerId;
  state.calleeId = null;
  applyDefaultDeviceState(state, payload.type);
  state.upgradeStatus = "none";
  state.isScreenSharing = false;
  state.endReason = null;
}

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
        sessionId?: string | null;
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
      state.sessionId = action.payload.sessionId ?? state.sessionId ?? null;
      applyDefaultDeviceState(state, action.payload.callType);
      state.returnTo = action.payload.returnTo ?? state.returnTo ?? null;
      state.endReason = null;
    },
    setIncomingCall: (state, action: PayloadAction<IncomingCallData>) => {
      if (state.status !== "idle" && state.status !== "ended") return;
      applyIncomingCallState(state, action.payload);
    },
    hydrateIncomingCallFromNotification: (state, action: PayloadAction<IncomingCallData>) => {
      const sameChannel =
        Boolean(state.channelName) && state.channelName === action.payload.channelName;
      if (state.status !== "idle" && state.status !== "ended" && !sameChannel) return;
      applyIncomingCallState(state, action.payload);
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
    setEndReason: (state, action: PayloadAction<"missed" | "rejected" | "busy" | null>) => {
      state.endReason = action.payload;
    },
    setReturnTo: (state, action: PayloadAction<string | null>) => {
      state.returnTo = action.payload;
    },
    setMicEnabled: (state, action: PayloadAction<boolean>) => {
      state.isMicOn = action.payload;
    },
    setCameraEnabled: (state, action: PayloadAction<boolean>) => {
      state.isCameraOn = action.payload;
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
      if (state.cameraAvailability === "unavailable") {
        state.cameraAvailability = "available";
      }
      state.cameraErrorMessage = null;
    },
    resetUpgrade: (state) => {
      state.upgradeStatus = "none";
    },
    setScreenSharing: (state, action: PayloadAction<boolean>) => {
      state.isScreenSharing = action.payload;
    },
    setMicAvailability: (
      state,
      action: PayloadAction<{
        availability: CallDeviceAvailability;
        errorMessage?: string | null;
        forceEnabled?: boolean;
      }>,
    ) => {
      state.micAvailability = action.payload.availability;
      state.micErrorMessage = action.payload.errorMessage ?? null;
      if (typeof action.payload.forceEnabled === "boolean") {
        state.isMicOn = action.payload.forceEnabled;
      }
    },
    setCameraAvailability: (
      state,
      action: PayloadAction<{
        availability: CallDeviceAvailability;
        errorMessage?: string | null;
        forceEnabled?: boolean;
      }>,
    ) => {
      state.cameraAvailability = action.payload.availability;
      state.cameraErrorMessage = action.payload.errorMessage ?? null;
      if (typeof action.payload.forceEnabled === "boolean") {
        state.isCameraOn = action.payload.forceEnabled;
      }
    },
    setReceiveOnly: (state, action: PayloadAction<boolean>) => {
      state.receiveOnly = action.payload;
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
        sessionId?: string | null;
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
      state.sessionId = action.payload.sessionId ?? null;
      state.returnTo = action.payload.returnTo;
      state.callerId = null;
      state.calleeId = null;
      state.callerName = null;
      applyDefaultDeviceState(state, action.payload.callType);
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
  hydrateIncomingCallFromNotification,
  setCallAccepted,
  setCallConnected,
  setCallEnded,
  setReturnTo,
  setEndReason,
  setMicEnabled,
  setCameraEnabled,
  toggleMic,
  toggleCamera,
  setUpgradePendingOutgoing,
  setUpgradePendingIncoming,
  setUpgradeAccepted,
  resetUpgrade,
  setScreenSharing,
  setMicAvailability,
  setCameraAvailability,
  setReceiveOnly,
  setActiveGroupCall,
  clearActiveGroupCallMatching,
  setJoiningGroupCall,
  resetCall,
} = callSlice.actions;

export const callReducer = callSlice.reducer;
