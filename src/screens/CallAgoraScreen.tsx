import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import { Audio } from "expo-av";
import { Camera } from "expo-camera";
import {
  ChannelMediaOptions,
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
  RenderModeType,
  RtcSurfaceView,
  ScreenCaptureParameters2,
  ScreenVideoParameters,
  VideoDimensions,
  VideoContentHint,
  RemoteVideoState,
  RemoteVideoStateReason,
  VideoSourceType,
} from "react-native-agora";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  LogOut,
  Mic,
  MicOff,
  Monitor,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react-native";

import { useCallContext } from "@/contexts/CallContext";
import { useSocketContext } from "@/contexts/SocketContext";
import { useIconColors } from "@/hooks/useIconColors";
import { apiClient } from "@/services/api";
import {
  resetCall,
  setCameraAvailability,
  setCameraEnabled,
  setCallConnected,
  setCallEnded,
  setEndReason,
  setMicAvailability,
  setMicEnabled,
  setReceiveOnly,
  setScreenSharing,
} from "@/store/slices/callSlice";
import type { AppDispatch, RootState } from "@/store/store";
import { userIdToAgoraUid } from "@/utils/agoraUid";
import { GROUP_TILE_GAP_PX, gridColsRows, maxTilesPerPage } from "@/utils/groupCallVideoGrid";
import type { CallDeviceAvailability } from "@/types/call.types";

function paramOne(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

type DeviceProbeResult = {
  availability: CallDeviceAvailability;
  errorMessage: string | null;
  enabled: boolean;
};

type CallDevicePermissions = {
  micGranted: boolean;
  cameraGranted: boolean;
};

function buildScreenCaptureParams(captureAudio: boolean): ScreenCaptureParameters2 {
  const cap = new ScreenCaptureParameters2();
  cap.captureVideo = true;
  cap.captureAudio = captureAudio;
  const vp = new ScreenVideoParameters();
  const dim = new VideoDimensions();
  // Ưu tiên aspect portrait để web/mobile render không bị crop.
  dim.width = 720;
  dim.height = 1280;
  vp.dimensions = dim;
  vp.frameRate = 15;
  vp.contentHint = VideoContentHint.ContentHintDetails;
  cap.videoParams = vp;
  return cap;
}

async function requestCallDevicePermissions(input: {
  needMic: boolean;
  needCamera: boolean;
}): Promise<CallDevicePermissions> {
  if (Platform.OS === "android") {
    const need: string[] = [];
    if (input.needMic) need.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (input.needCamera) need.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    if (need.length === 0) {
      return { micGranted: true, cameraGranted: true };
    }
    const res = await PermissionsAndroid.requestMultiple(need as never);
    return {
      micGranted:
        !input.needMic ||
        res["android.permission.RECORD_AUDIO"] === PermissionsAndroid.RESULTS.GRANTED,
      cameraGranted:
        !input.needCamera ||
        res["android.permission.CAMERA"] === PermissionsAndroid.RESULTS.GRANTED,
    };
  }

  let micGranted = true;
  let cameraGranted = true;

  if (input.needMic) {
    const micExisting = await Audio.getPermissionsAsync();
    micGranted = micExisting.granted ? true : (await Audio.requestPermissionsAsync()).granted;
  }

  if (input.needCamera) {
    const camExisting = await Camera.getCameraPermissionsAsync();
    cameraGranted = camExisting.granted
      ? true
      : (await Camera.requestCameraPermissionsAsync()).granted;
  }

  return { micGranted, cameraGranted };
}

function describeDeviceFailure(kind: "mic" | "camera", error: unknown): DeviceProbeResult {
  const raw =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Thiết bị lỗi.";
  const msg = raw.trim() || "Thiết bị lỗi.";
  const lowered = msg.toLowerCase();

  if (
    lowered.includes("permission") ||
    lowered.includes("denied") ||
    lowered.includes("not authorized") ||
    lowered.includes("microphone") ||
    lowered.includes("camera")
  ) {
    return {
      availability: "blocked",
      errorMessage:
        kind === "mic"
          ? "Không có quyền micro. Bạn chỉ có thể nghe cho đến khi bật lại quyền."
          : "Không có quyền camera. Bạn sẽ tham gia mà không bật camera.",
      enabled: false,
    };
  }

  if (
    lowered.includes("not found") ||
    lowered.includes("unavailable") ||
    lowered.includes("no device") ||
    lowered.includes("not readable")
  ) {
    return {
      availability: "unavailable",
      errorMessage:
        kind === "mic"
          ? "Micro không khả dụng trên thiết bị này."
          : "Camera không khả dụng trên thiết bị này.",
      enabled: false,
    };
  }

  return {
    availability: "failed",
    errorMessage: kind === "mic" ? "Không thể bật micro." : "Không thể bật camera.",
    enabled: false,
  };
}

export default function CallAgoraScreen() {
  const params = useLocalSearchParams<{
    channel?: string;
    type?: string;
    conversationId?: string;
    returnTo?: string;
    scope?: string;
    hostId?: string;
  }>();
  const dispatch = useDispatch<AppDispatch>();
  const socket = useSocketContext();
  const { primary } = useIconColors();
  const socketRef = useRef(socket);
  socketRef.current = socket;

  const channelName = paramOne(params.channel);
  const urlCallType = paramOne(params.type) as "audio" | "video" | "";
  const conversationIdParam = paramOne(params.conversationId);
  const returnToParam = paramOne(params.returnTo);
  const scopeParam = paramOne(params.scope);
  const hostIdParam = paramOne(params.hostId);

  const {
    endCall,
    leaveGroupCall,
    endGroupCallForAll,
    fetchAgoraToken,
    appId,
    onToggleMic,
    onToggleCamera,
    requestUpgradeToVideo,
    respondUpgradeToVideo,
  } = useCallContext();

  const {
    status,
    callType,
    callScope,
    hostId,
    callerId,
    isMicOn,
    isCameraOn,
    micAvailability,
    cameraAvailability,
    micErrorMessage,
    cameraErrorMessage,
    receiveOnly,
    upgradeStatus,
    returnTo,
    conversationId,
    calleeId,
    endReason,
  } = useSelector((state: RootState) => state.call);
  const currentUserId = useSelector((state: RootState) => state.auth.user?.userId ?? "");
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [uiHidden, setUiHidden] = useState(false);

  const resolvedReturnTo = useMemo(() => {
    const raw = returnToParam || returnTo || "/(main)/(chat)";
    try {
      return decodeURIComponent(raw);
    } catch {
      return "/(main)/(chat)";
    }
  }, [returnToParam, returnTo]);

  const resolvedConversationId = conversationIdParam || conversationId || "";

  const isGroup =
    callScope === "group" || scopeParam === "group" || Boolean(channelName?.startsWith("grp_"));
  const hostIdResolved = (hostId || hostIdParam || "").trim();
  const isHost = Boolean(hostIdResolved && currentUserId && hostIdResolved === currentUserId);

  // `joinWithVideo` chỉ phản ánh loại cuộc gọi ban đầu (từ params / callType) để tránh re-init RTC khi upgrade.
  const joinWithVideo = (urlCallType || callType) === "video";
  const isVideoCall = joinWithVideo || (!isGroup && upgradeStatus === "accepted");
  const showUpgradeButton =
    !isGroup && !isVideoCall && status === "connected" && upgradeStatus === "none";
  const showUpgradeIncomingModal = !isGroup && upgradeStatus === "pending-incoming";

  const [agoraUidToName, setAgoraUidToName] = useState<Map<number, string>>(new Map());
  const [pinnedUid, setPinnedUid] = useState<number | null>(null);
  const [localScreenSharing, setLocalScreenSharing] = useState(false);
  const [screenAudioOn, setScreenAudioOn] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  const [timer, setTimer] = useState(0);
  const [joined, setJoined] = useState(false);
  const [localUid, setLocalUid] = useState<number>(0);
  const [remoteUids, setRemoteUids] = useState<number[]>([]);
  const [peerUid, setPeerUid] = useState<number | null>(null);
  const [remoteVideoOn, setRemoteVideoOn] = useState<Map<number, boolean>>(() => new Map());
  const [groupGridInnerH, setGroupGridInnerH] = useState(0);
  const [groupVideoPage, setGroupVideoPage] = useState(0);

  const engineRef = useRef<IRtcEngine | null>(null);
  const remoteUidsRef = useRef<number[]>([]);
  remoteUidsRef.current = remoteUids;
  const conversationIdRef = useRef(resolvedConversationId);
  conversationIdRef.current = resolvedConversationId;
  const isGroupRef = useRef(isGroup);
  isGroupRef.current = isGroup;
  const channelRef = useRef(channelName);
  channelRef.current = channelName;
  const goBack = useCallback(() => {
    router.replace(resolvedReturnTo as never);
  }, [resolvedReturnTo]);

  const registeredHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const ringbackRef = useRef<Audio.Sound | null>(null);
  const rtcJoinedRef = useRef(false);
  const isMicOnRef = useRef(isMicOn);
  isMicOnRef.current = isMicOn;
  const isCameraOnRef = useRef(isCameraOn);
  isCameraOnRef.current = isCameraOn;
  const lastDeviceAlertMessageRef = useRef<string | null>(null);
  const deviceAlertShownRef = useRef(false);

  const applyMicFailure = useCallback(
    (error: unknown) => {
      const probe = describeDeviceFailure("mic", error);
      dispatch(
        setMicAvailability({
          availability: probe.availability,
          errorMessage: probe.errorMessage,
          forceEnabled: false,
        }),
      );
      return probe;
    },
    [dispatch],
  );

  const applyCameraFailure = useCallback(
    (error: unknown) => {
      const probe = describeDeviceFailure("camera", error);
      dispatch(
        setCameraAvailability({
          availability: probe.availability,
          errorMessage: probe.errorMessage,
          forceEnabled: false,
        }),
      );
      return probe;
    },
    [dispatch],
  );

  useEffect(() => {
    // Cho phép xoay ngang trong màn call (phục vụ xem screen-share/video rõ hơn).
    void ScreenOrientation.unlockAsync();
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const labelForUid = useCallback(
    (uid: number) => {
      if (uid === localUid && localUid !== 0) return "Bạn";
      return agoraUidToName.get(uid) ?? "Ẩn danh";
    },
    [agoraUidToName, localUid],
  );

  useEffect(() => {
    // Lấy danh sách member để map Agora UID -> displayName cho cả 1-1 và group.
    if (!resolvedConversationId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await apiClient.get(`/chat/conversations/${resolvedConversationId}/members`);
        const envelope = res.data as { data?: unknown };
        const list = (Array.isArray(envelope.data) ? envelope.data : []) as {
          userId?: string;
          displayName?: string;
          email?: string;
        }[];
        const map = new Map<number, string>();
        for (const m of list) {
          if (!m.userId) continue;
          const uid = userIdToAgoraUid(m.userId);
          const name = (m.displayName || m.email || "").trim();
          if (name) map.set(uid, name);
        }
        if (currentUserId) {
          const selfName = (list as { userId?: string; displayName?: string }[]).find(
            (x) => x.userId === currentUserId,
          );
          const n = (selfName?.displayName || "").trim();
          if (n) map.set(userIdToAgoraUid(currentUserId), n);
        }
        if (!cancelled) setAgoraUidToName(map);
      } catch {
        if (!cancelled) setAgoraUidToName(new Map());
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [resolvedConversationId, currentUserId]);

  const shutdownRtc = useCallback(() => {
    const ch = channelRef.current;
    const conv = conversationIdRef.current;
    if (rtcJoinedRef.current && isGroupRef.current && ch.startsWith("grp_") && conv) {
      socketRef.current?.emit("call:group-rtc-left", { channelName: ch, conversationId: conv });
    }
    rtcJoinedRef.current = false;
    const engine = engineRef.current;
    if (!engine) return;
    try {
      if (Platform.OS === "android") {
        try {
          engine.stopScreenCapture();
        } catch {
          /* ignore */
        }
      }
      engine.leaveChannel();
    } catch {
      /* ignore */
    }
    const h = registeredHandlerRef.current;
    if (h) {
      try {
        engine.unregisterEventHandler(h);
      } catch {
        /* ignore */
      }
      registeredHandlerRef.current = null;
    }
    try {
      engine.release();
    } catch {
      /* ignore */
    }
    engineRef.current = null;
    setJoined(false);
    setLocalScreenSharing(false);
    dispatch(setScreenSharing(false));
  }, [dispatch]);

  const cleanupFailedJoin = useCallback(
    (message?: string) => {
      const type = (urlCallType || callType || "audio") as "audio" | "video";
      if (channelName && resolvedConversationId) {
        if (!isGroup) {
          const directPeerId = callerId || calleeId;
          if (directPeerId) {
            socketRef.current?.emit("call:end", {
              channelName,
              peerId: directPeerId,
              conversationId: resolvedConversationId,
              type,
              durationSec: 0,
              result: "cancelled",
            });
          }
        } else if (isHost && status === "outgoing-ringing") {
          socketRef.current?.emit("call:group-missed", {
            channelName,
            conversationId: resolvedConversationId,
            type,
          });
        }
      }
      shutdownRtc();
      if (message) {
        Alert.alert("Lỗi tham gia cuộc gọi", message);
      }
      dispatch(setCallEnded());
    },
    [
      calleeId,
      callType,
      callerId,
      channelName,
      dispatch,
      isGroup,
      isHost,
      resolvedConversationId,
      shutdownRtc,
      status,
      urlCallType,
    ],
  );

  const updatePublishOptions = useCallback(
    (options: ChannelMediaOptions) => {
      const engine = engineRef.current;
      if (!engine || !joined) return;
      try {
        engine.updateChannelMediaOptions(options);
      } catch {
        /* ignore */
      }
    },
    [joined],
  );

  const enableMicrophoneForCall = useCallback(async (): Promise<boolean> => {
    const engine = engineRef.current;
    if (!engine) return false;

    const permission = await requestCallDevicePermissions({
      needMic: true,
      needCamera: false,
    });
    if (!permission.micGranted) {
      dispatch(
        setMicAvailability({
          availability: "blocked",
          errorMessage: "Không có quyền micro. Bạn chỉ có thể nghe cho đến khi bật lại quyền.",
          forceEnabled: false,
        }),
      );
      return false;
    }

    try {
      engine.enableAudio();
      engine.muteLocalAudioStream(false);
      dispatch(setMicAvailability({ availability: "available", errorMessage: null }));
      return true;
    } catch (error) {
      applyMicFailure(error);
      return false;
    }
  }, [applyMicFailure, dispatch]);

  const enableCameraForCall = useCallback(async (): Promise<boolean> => {
    const engine = engineRef.current;
    if (!engine) return false;

    const permission = await requestCallDevicePermissions({
      needMic: false,
      needCamera: true,
    });
    if (!permission.cameraGranted) {
      dispatch(
        setCameraAvailability({
          availability: "blocked",
          errorMessage: "Không có quyền camera. Bạn sẽ tham gia mà không bật camera.",
          forceEnabled: false,
        }),
      );
      return false;
    }

    try {
      engine.enableVideo();
      engine.enableLocalVideo(true);
      engine.startPreview(VideoSourceType.VideoSourceCameraPrimary);
      engine.muteLocalVideoStream(false);
      dispatch(setCameraAvailability({ availability: "available", errorMessage: null }));
      return true;
    } catch (error) {
      applyCameraFailure(error);
      return false;
    }
  }, [applyCameraFailure, dispatch]);

  const cleanupFailedJoinRef = useRef(cleanupFailedJoin);
  cleanupFailedJoinRef.current = cleanupFailedJoin;
  const enableMicrophoneForCallRef = useRef(enableMicrophoneForCall);
  enableMicrophoneForCallRef.current = enableMicrophoneForCall;
  const enableCameraForCallRef = useRef(enableCameraForCall);
  enableCameraForCallRef.current = enableCameraForCall;
  const shutdownRtcRef = useRef(shutdownRtc);
  shutdownRtcRef.current = shutdownRtc;
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;

  useEffect(() => {
    if (!channelName) {
      goBackRef.current();
      return;
    }
    if (!appId) {
      Alert.alert(
        "Thiếu cấu hình",
        "Chưa có Agora App ID (expo.extra.agoraAppId hoặc EXPO_PUBLIC_AGORA_APP_ID).",
      );
      goBackRef.current();
      return;
    }

    let cancelled = false;

    const run = async () => {
      rtcJoinedRef.current = false;
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      try {
        engine.initialize({
          appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });
      } catch (error) {
        if (__DEV__) console.warn("[Agora] initialize failed", error);
        if (!cancelled) {
          cleanupFailedJoinRef.current("Không thể khởi tạo Agora trên thiết bị này.");
        }
        return;
      }

      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => {
          if (cancelled) return;
          rtcJoinedRef.current = true;
          setJoined(true);
          dispatch(setCallConnected());
          const ch = channelRef.current;
          const conv = conversationIdRef.current;
          if (isGroupRef.current && ch.startsWith("grp_") && conv) {
            socketRef.current?.emit("call:group-rtc-joined", {
              channelName: ch,
              conversationId: conv,
            });
          }
        },
        onUserJoined: (_connection, remoteUid) => {
          if (cancelled) return;
          dispatch(setCallConnected());
          setRemoteVideoOn((prev) => {
            const next = new Map(prev);
            next.set(remoteUid, true);
            return next;
          });
          if (isGroupRef.current) {
            setRemoteUids((prev) => (prev.includes(remoteUid) ? prev : [...prev, remoteUid]));
          } else {
            setPeerUid(remoteUid);
          }
        },
        onUserOffline: (_connection, remoteUid) => {
          if (isGroupRef.current) {
            const next = remoteUidsRef.current.filter((u) => u !== remoteUid);
            setRemoteUids(next);
            setPinnedUid((p) => (p === remoteUid ? null : p));
            setRemoteVideoOn((prev) => {
              const m = new Map(prev);
              m.delete(remoteUid);
              return m;
            });
            if (next.length === 0) {
              const convId = conversationIdRef.current;
              if (convId) {
                socketRef.current?.emit("call:group-vacant", {
                  channelName: channelRef.current,
                  conversationId: convId,
                });
              }
              dispatch(setCallEnded());
            }
          } else {
            setPeerUid(null);
            setRemoteVideoOn((prev) => {
              const m = new Map(prev);
              m.delete(remoteUid);
              return m;
            });
            dispatch(setCallEnded());
          }
        },
        onRemoteVideoStateChanged: (_connection, remoteUid, state, reason) => {
          if (cancelled) return;
          const isOn =
            state === RemoteVideoState.RemoteVideoStateDecoding ||
            state === RemoteVideoState.RemoteVideoStateStarting ||
            reason === RemoteVideoStateReason.RemoteVideoStateReasonRemoteUnmuted;
          const isOff =
            state === RemoteVideoState.RemoteVideoStateStopped ||
            reason === RemoteVideoStateReason.RemoteVideoStateReasonRemoteMuted ||
            reason === RemoteVideoStateReason.RemoteVideoStateReasonAudioFallback;
          if (!isOn && !isOff) return;
          setRemoteVideoOn((prev) => {
            const next = new Map(prev);
            next.set(remoteUid, isOn && !isOff);
            return next;
          });
        },
        onError: (err, msg) => {
          if (__DEV__) console.warn("[Agora] onError", err, msg);
        },
      };
      registeredHandlerRef.current = handler;
      engine.registerEventHandler(handler);

      try {
        const permissions = await requestCallDevicePermissions({
          needMic: true,
          needCamera: joinWithVideo,
        });
        if (cancelled) return;

        let canPublishMic = permissions.micGranted;
        let canPublishCamera = joinWithVideo && permissions.cameraGranted;

        if (!permissions.micGranted) {
          dispatch(
            setMicAvailability({
              availability: "blocked",
              errorMessage: "Không có quyền micro. Bạn sẽ tham gia ở chế độ nghe.",
              forceEnabled: false,
            }),
          );
          dispatch(setMicEnabled(false));
          canPublishMic = false;
        } else if (!(await enableMicrophoneForCallRef.current())) {
          dispatch(setMicEnabled(false));
          canPublishMic = false;
        }

        if (joinWithVideo) {
          if (!permissions.cameraGranted) {
            dispatch(
              setCameraAvailability({
                availability: "blocked",
                errorMessage: "Không có quyền camera. Bạn sẽ tham gia mà không bật camera.",
                forceEnabled: false,
              }),
            );
            dispatch(setCameraEnabled(false));
            canPublishCamera = false;
          } else if (!(await enableCameraForCallRef.current())) {
            dispatch(setCameraEnabled(false));
            canPublishCamera = false;
          }
        } else {
          dispatch(setCameraAvailability({ availability: "unavailable", errorMessage: null }));
        }

        const { token, uid } = await fetchAgoraToken(channelName);
        if (cancelled) return;
        setLocalUid(uid);

        const options = {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
          publishMicrophoneTrack: canPublishMic,
          publishCameraTrack: canPublishCamera,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        } as ChannelMediaOptions;

        engine.joinChannel(token, channelName, uid, options);
        dispatch(setReceiveOnly(!canPublishMic && !canPublishCamera));
      } catch (e) {
        if (__DEV__) console.warn("[Agora] join failed", e);
        if (!cancelled) {
          cleanupFailedJoinRef.current("Không thể tham gia kênh Agora.");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      shutdownRtcRef.current();
    };
  }, [appId, channelName, dispatch, fetchAgoraToken, joinWithVideo]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !joined) return;
    if (!isMicOn) {
      engine.muteLocalAudioStream(true);
      updatePublishOptions({
        publishMicrophoneTrack: false,
      } as ChannelMediaOptions);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const micReady = await enableMicrophoneForCall();
      if (cancelled || !micReady) {
        dispatch(setMicEnabled(false));
        return;
      }
      updatePublishOptions({
        publishMicrophoneTrack: true,
      } as ChannelMediaOptions);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [dispatch, enableMicrophoneForCall, isMicOn, joined, updatePublishOptions]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !joined || !isVideoCall) return;
    if (localScreenSharing) return;
    if (!isCameraOn) {
      engine.enableLocalVideo(false);
      engine.muteLocalVideoStream(true);
      updatePublishOptions({
        publishCameraTrack: false,
        publishMicrophoneTrack: isMicOn && micAvailability === "available",
      } as ChannelMediaOptions);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const cameraReady = await enableCameraForCall();
      if (cancelled || !cameraReady) {
        dispatch(setCameraEnabled(false));
        return;
      }
      updatePublishOptions({
        publishCameraTrack: true,
        publishMicrophoneTrack: isMicOn && micAvailability === "available",
      } as ChannelMediaOptions);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    enableCameraForCall,
    isCameraOn,
    isMicOn,
    isVideoCall,
    joined,
    localScreenSharing,
    micAvailability,
    updatePublishOptions,
  ]);

  useEffect(() => {
    // Khi voice → video được accept: bật video engine + publish camera.
    if (isGroup) return;
    if (upgradeStatus !== "accepted") return;
    const engine = engineRef.current;
    if (!engine || !joined) return;
    const run = async () => {
      const cameraReady = await enableCameraForCall();
      if (!cameraReady) {
        dispatch(setCameraEnabled(false));
        return;
      }
      updatePublishOptions({
        publishCameraTrack: true,
        publishMicrophoneTrack: isMicOn && micAvailability === "available",
      } as ChannelMediaOptions);
    };
    void run();
  }, [
    dispatch,
    enableCameraForCall,
    isGroup,
    isMicOn,
    joined,
    micAvailability,
    updatePublishOptions,
    upgradeStatus,
  ]);

  useEffect(() => {
    if (!joined) return;
    const noMic = !isMicOn || micAvailability !== "available";
    const noCamera =
      !isVideoCall || (!localScreenSharing && (!isCameraOn || cameraAvailability !== "available"));
    dispatch(setReceiveOnly(noMic && noCamera));
  }, [
    cameraAvailability,
    dispatch,
    isCameraOn,
    isMicOn,
    isVideoCall,
    joined,
    localScreenSharing,
    micAvailability,
  ]);

  const hasRemoteParticipant = isGroup ? remoteUids.length > 0 : peerUid != null;

  const deviceAlertMessage = useMemo(() => {
    const micIssue =
      micAvailability !== "available" ? (micErrorMessage ?? "Không thể bật micro.") : null;
    const cameraIssue =
      isVideoCall && cameraAvailability !== "available"
        ? (cameraErrorMessage ?? "Không thể bật camera.")
        : null;

    if (micIssue && cameraIssue) {
      return "Thiết bị không dùng được micro/camera. Bạn đã vào cuộc gọi ở chế độ chỉ nghe/xem.";
    }

    return micIssue ?? cameraIssue;
  }, [cameraAvailability, cameraErrorMessage, isVideoCall, micAvailability, micErrorMessage]);

  useEffect(() => {
    deviceAlertShownRef.current = false;
    lastDeviceAlertMessageRef.current = null;
  }, [channelName]);

  useEffect(() => {
    if (status === "ended") {
      deviceAlertShownRef.current = false;
      lastDeviceAlertMessageRef.current = null;
    }
  }, [status]);

  useEffect(() => {
    if (!joined || status !== "connected" || !hasRemoteParticipant || !deviceAlertMessage) {
      return;
    }
    if (deviceAlertShownRef.current && lastDeviceAlertMessageRef.current === deviceAlertMessage) {
      return;
    }
    deviceAlertShownRef.current = true;
    lastDeviceAlertMessageRef.current = deviceAlertMessage;
    Alert.alert("Thiết bị cuộc gọi", deviceAlertMessage);
  }, [deviceAlertMessage, hasRemoteParticipant, joined, status]);

  useEffect(() => {
    if (status !== "ended") return;
    shutdownRtc();
    if (endReason) {
      const t = setTimeout(() => {
        dispatch(resetCall());
        goBack();
      }, 2200);
      return () => clearTimeout(t);
    }
    dispatch(resetCall());
    goBack();
  }, [dispatch, endReason, goBack, shutdownRtc, status]);

  useEffect(() => {
    if (status !== "outgoing-ringing") return;
    const timeoutMs = 25_000;
    const t = setTimeout(() => {
      dispatch(setEndReason("missed"));
      const type = (urlCallType || callType || "audio") as "audio" | "video";
      if (channelName && resolvedConversationId) {
        if (channelName.startsWith("grp_")) {
          socketRef.current?.emit("call:group-missed", {
            channelName,
            conversationId: resolvedConversationId,
            type,
          });
        } else if (calleeId) {
          socketRef.current?.emit("call:missed", {
            channelName,
            peerId: calleeId,
            conversationId: resolvedConversationId,
            type,
          });
        }
      }
      dispatch(setCallEnded());
    }, timeoutMs);
    return () => clearTimeout(t);
  }, [calleeId, callType, channelName, dispatch, resolvedConversationId, status, urlCallType]);

  useEffect(() => {
    const shouldPlay = status === "outgoing-ringing";
    if (!shouldPlay) {
      if (ringbackRef.current) {
        void ringbackRef.current.stopAsync().catch(() => undefined);
        void ringbackRef.current.unloadAsync().catch(() => undefined);
        ringbackRef.current = null;
      }
      return;
    }

    const start = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const src = require("../../assets/ringtones/amThanhGoi.mp3");
        const { sound } = await Audio.Sound.createAsync(src, {
          shouldPlay: true,
          isLooping: true,
          volume: 1.0,
        });
        ringbackRef.current = sound;
      } catch {
        // ignore: nếu thiếu asset hoặc không phát được
      }
    };

    void start();
    return () => {
      if (ringbackRef.current) {
        void ringbackRef.current.stopAsync().catch(() => undefined);
        void ringbackRef.current.unloadAsync().catch(() => undefined);
        ringbackRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => setTimer((x) => x + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDirectEnd = useCallback(() => {
    endCall({
      durationSec: status === "connected" ? timer : 0,
      result: status === "outgoing-ringing" ? "cancelled" : "completed",
    });
    shutdownRtc();
    setTimeout(() => {
      dispatch(resetCall());
      goBack();
    }, 400);
  }, [dispatch, endCall, goBack, shutdownRtc, status, timer]);

  const handleGroupLeave = useCallback(() => {
    leaveGroupCall();
    shutdownRtc();
    setTimeout(() => {
      dispatch(resetCall());
      goBack();
    }, 400);
  }, [dispatch, goBack, leaveGroupCall, shutdownRtc]);

  const handleGroupEndAll = useCallback(() => {
    endGroupCallForAll({ durationSec: timer });
    shutdownRtc();
    setTimeout(() => {
      dispatch(resetCall());
      goBack();
    }, 400);
  }, [dispatch, endGroupCallForAll, goBack, shutdownRtc, timer]);

  const onOpenPinMenu = useCallback(
    (uid: number) => {
      if (!isGroup) return;
      const isPinned = pinnedUid === uid;
      Alert.alert(labelForUid(uid), undefined, [
        isPinned
          ? { text: "Bỏ ghim", onPress: () => setPinnedUid(null) }
          : { text: "Ghim", onPress: () => setPinnedUid(uid) },
        { text: "Đóng", style: "cancel" },
      ]);
    },
    [isGroup, labelForUid, pinnedUid],
  );

  const toggleScreenShare = useCallback(async () => {
    if (!isVideoCall || !joined || Platform.OS !== "android") {
      if (Platform.OS !== "android") {
        Alert.alert(
          "Chia sẻ màn hình",
          "Trên iOS cần cấu hình thêm (Broadcast / ReplayKit). Hiện tài liệu tập trung Android.",
        );
      }
      return;
    }
    const engine = engineRef.current;
    if (!engine) return;

    if (localScreenSharing) {
      try {
        engine.stopScreenCapture();
        engine.updateChannelMediaOptions({
          publishScreenCaptureVideo: false,
          publishScreenCaptureAudio: false,
          publishCameraTrack: isCameraOnRef.current,
          publishMicrophoneTrack: isMicOnRef.current && micAvailability === "available",
        } as ChannelMediaOptions);
        if (isCameraOnRef.current) {
          engine.startPreview(VideoSourceType.VideoSourceCameraPrimary);
        }
      } catch (e) {
        if (__DEV__) console.warn("stopScreenCapture", e);
      }
      setLocalScreenSharing(false);
      dispatch(setScreenSharing(false));
      return;
    }

    const cap = buildScreenCaptureParams(screenAudioOn);

    const ret = engine.startScreenCapture(cap);
    if (ret !== 0) {
      Alert.alert(
        "Chia sẻ màn hình",
        "Không thể bắt đầu (mã lỗi " + String(ret) + "). Kiểm tra quyền ghi màn hình trên Android.",
      );
      return;
    }
    try {
      engine.updateChannelMediaOptions({
        publishScreenCaptureVideo: true,
        publishScreenCaptureAudio: screenAudioOn,
        publishCameraTrack: false,
        publishMicrophoneTrack: isMicOnRef.current && micAvailability === "available",
      } as ChannelMediaOptions);
    } catch (e) {
      if (__DEV__) console.warn("updateChannelMediaOptions screen", e);
    }
    if (screenAudioOn) {
      Alert.alert(
        "Âm thanh hệ thống",
        "Lưu ý: YouTube/Spotify (DRM) có thể chặn capture âm thanh hệ thống trên Android. Hãy thử phát audio từ file local hoặc app không DRM để kiểm tra.",
      );
    }
    setLocalScreenSharing(true);
    dispatch(setScreenSharing(true));
  }, [dispatch, isVideoCall, joined, localScreenSharing, micAvailability, screenAudioOn]);

  const applyScreenAudioWhileSharing = useCallback(
    async (next: boolean) => {
      if (Platform.OS !== "android") return;
      if (!localScreenSharing) return;
      const engine = engineRef.current;
      if (!engine) return;
      try {
        engine.stopScreenCapture();
      } catch {
        /* ignore */
      }
      const cap = buildScreenCaptureParams(next);
      const ret = engine.startScreenCapture(cap);
      if (ret !== 0) {
        Alert.alert("Âm thanh hệ thống", `Không thể bật lại (mã ${String(ret)}).`);
        return;
      }
      try {
        engine.updateChannelMediaOptions({
          publishScreenCaptureVideo: true,
          publishScreenCaptureAudio: next,
          publishCameraTrack: false,
          publishMicrophoneTrack: isMicOnRef.current && micAvailability === "available",
        } as ChannelMediaOptions);
      } catch {
        /* ignore */
      }
      if (next) {
        Alert.alert(
          "Âm thanh hệ thống",
          "Lưu ý: YouTube/Spotify (DRM) có thể chặn capture âm thanh hệ thống trên Android. Hãy thử file local hoặc app không DRM để kiểm tra.",
        );
      }
    },
    [localScreenSharing, micAvailability],
  );

  const statusLabel =
    status === "outgoing-ringing"
      ? "Đang gọi..."
      : status === "incoming-ringing"
        ? "Đang đổ chuông..."
        : status === "connecting"
          ? "Đang kết nối..."
          : status === "connected"
            ? formatTime(timer)
            : status === "ended"
              ? endReason === "missed"
                ? "Nhỡ máy"
                : endReason === "rejected"
                  ? "Từ chối"
                  : endReason === "busy"
                    ? "Đang bận"
                    : "Kết thúc"
              : "";

  const deviceStatusHint = useMemo(() => {
    const parts: string[] = [];
    if (receiveOnly) parts.push("Đang ở chế độ chỉ nghe/xem.");
    if (micAvailability !== "available" && micErrorMessage) parts.push(micErrorMessage);
    if (isVideoCall && cameraAvailability !== "available" && cameraErrorMessage) {
      parts.push(cameraErrorMessage);
    }
    return parts[0] ?? null;
  }, [
    cameraAvailability,
    cameraErrorMessage,
    isVideoCall,
    micAvailability,
    micErrorMessage,
    receiveOnly,
  ]);

  const calleeLabel = useMemo(() => {
    const raw = (calleeId || "").trim();
    if (!raw) return "Cuộc gọi 1-1";
    const uid = userIdToAgoraUid(raw);
    return agoraUidToName.get(uid) ?? "Ẩn danh";
  }, [agoraUidToName, calleeId]);

  const groupGridViewport = useMemo(() => {
    const vw = Math.max(200, width - 24);
    const vh = Math.max(150, groupGridInnerH > 0 ? groupGridInnerH - 48 : height * 0.48);
    return { width: vw, height: vh };
  }, [width, height, groupGridInnerH]);

  const groupTilesLayout = useMemo(() => {
    const n = remoteUids.length;
    if (n === 0) return { tilesPerPage: 1, pageCount: 1 };
    const t =
      groupGridViewport.width > 0 && groupGridViewport.height > 0
        ? maxTilesPerPage(groupGridViewport.width, groupGridViewport.height, n)
        : Math.min(n, 4);
    return { tilesPerPage: t, pageCount: Math.max(1, Math.ceil(n / t)) };
  }, [remoteUids.length, groupGridViewport]);

  useEffect(() => {
    setGroupVideoPage((p) => Math.min(p, Math.max(0, groupTilesLayout.pageCount - 1)));
  }, [groupTilesLayout.pageCount]);

  const groupPages = useMemo(() => {
    const { tilesPerPage, pageCount } = groupTilesLayout;
    return Array.from({ length: pageCount }, (_, i) => {
      const start = i * tilesPerPage;
      return remoteUids.slice(start, start + tilesPerPage);
    });
  }, [remoteUids, groupTilesLayout]);

  const groupPagesListRef = useRef<FlatList<number[]>>(null);

  const allGroupUids = useMemo(() => {
    const s = new Set<number>();
    if (localUid) s.add(localUid);
    for (const u of remoteUids) s.add(u);
    return Array.from(s);
  }, [localUid, remoteUids]);

  const localCameraSourceType = VideoSourceType.VideoSourceCameraPrimary;

  const renderGroupVideoCell = (
    uid: number,
    compact: boolean,
    cellPx?: { w: number; h: number },
  ) => {
    const h = cellPx ? "" : compact ? "h-32" : "h-48";
    const w = cellPx ? "" : compact ? "w-28" : "w-36";
    const isLocal = uid === localUid;
    const sourceType = isLocal
      ? localScreenSharing
        ? VideoSourceType.VideoSourceScreen
        : localCameraSourceType
      : VideoSourceType.VideoSourceRemote;
    const shouldRenderVideo =
      isLocal ||
      (remoteVideoOn.get(uid) ?? true) ||
      sourceType !== VideoSourceType.VideoSourceRemote;
    return (
      <Pressable
        key={uid}
        onPress={() => onOpenPinMenu(uid)}
        className={
          cellPx
            ? "overflow-hidden rounded-xl border border-white/10 bg-neutral-900"
            : `${h} ${w} overflow-hidden rounded-xl border border-white/10 bg-neutral-900`
        }
        style={cellPx ? { width: cellPx.w, height: cellPx.h } : undefined}
      >
        {shouldRenderVideo ? (
          <RtcSurfaceView
            style={{ flex: 1 }}
            canvas={{
              uid: isLocal ? localUid : uid,
              sourceType,
              renderMode: RenderModeType.RenderModeFit,
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-black">
            <Text className="px-2 text-center text-xs text-white/70">Đã tắt camera</Text>
          </View>
        )}
        <View className="absolute left-2 top-2 rounded bg-black/60 px-2 py-1">
          <Text className="text-[10px] font-semibold text-white" numberOfLines={1}>
            {labelForUid(uid)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={["top", "bottom"]}>
      <View className="flex-1 px-3 pt-2">
        {!uiHidden ? (
          <View className="mb-2 gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-white/80">{statusLabel}</Text>
              {isGroup && isVideoCall ? (
                <View className="flex-row items-center gap-2">
                  <Pressable
                    onPress={() => setParticipantsOpen(true)}
                    className="flex-row items-center gap-1 rounded-lg bg-white/10 px-2 py-1"
                  >
                    <LayoutGrid size={16} color={primary} />
                    <Text className="text-xs text-white">Danh sách</Text>
                  </Pressable>
                  {isLandscape ? (
                    <Pressable
                      onPress={() => setUiHidden(true)}
                      className="rounded-lg bg-white/10 px-2 py-1"
                    >
                      <Text className="text-xs text-white">Ẩn chức năng</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : isLandscape ? (
                <Pressable
                  onPress={() => setUiHidden(true)}
                  className="rounded-lg bg-white/10 px-2 py-1"
                >
                  <Text className="text-xs text-white">Ẩn chức năng</Text>
                </Pressable>
              ) : null}
            </View>
            {deviceStatusHint ? (
              <View className="self-start rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
                <Text className="text-xs text-amber-100">{deviceStatusHint}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setUiHidden(false)}
            className="absolute right-3 top-3 z-50 rounded-lg border border-white/10 bg-black/60 px-3 py-2"
          >
            <Text className="text-xs font-semibold text-white">Hiện chức năng</Text>
          </Pressable>
        )}

        {isVideoCall ? (
          <View className="mb-2 min-h-[200px] flex-1 overflow-hidden rounded-2xl bg-black/40">
            {isGroup ? (
              <View
                className="flex-1"
                onLayout={(e) => setGroupGridInnerH(e.nativeEvent.layout.height)}
              >
                {remoteUids.length === 0 ? (
                  <View className="min-h-[220px] flex-1 items-center justify-center rounded-xl border border-white/10">
                    <Text className="text-sm text-white/50">Đang chờ thành viên vào kênh...</Text>
                  </View>
                ) : (
                  <>
                    <FlatList
                      ref={groupPagesListRef}
                      data={groupPages}
                      extraData={`${width}-${groupGridInnerH}-${remoteUids.join(",")}`}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => `gcall-page-${i}`}
                      getItemLayout={(_, index) => ({
                        length: width - 24,
                        offset: (width - 24) * index,
                        index,
                      })}
                      onMomentumScrollEnd={(ev) => {
                        const pageW = width - 24;
                        const idx = Math.round(ev.nativeEvent.contentOffset.x / pageW);
                        setGroupVideoPage(
                          Math.max(0, Math.min(groupTilesLayout.pageCount - 1, idx)),
                        );
                      }}
                      renderItem={({ item: pageUids }) => {
                        const dims = gridColsRows(Math.max(1, pageUids.length));
                        const pageW = width - 24;
                        const innerH = Math.max(
                          120,
                          (groupGridInnerH > 0 ? groupGridInnerH : height * 0.5) - 52,
                        );
                        const cellW = Math.floor(
                          (pageW - GROUP_TILE_GAP_PX * Math.max(0, dims.cols - 1)) / dims.cols,
                        );
                        const cellH = Math.floor(
                          (innerH - GROUP_TILE_GAP_PX * Math.max(0, dims.rows - 1)) / dims.rows,
                        );
                        return (
                          <View
                            style={{
                              width: pageW,
                              minHeight: innerH,
                              flexDirection: "row",
                              flexWrap: "wrap",
                              justifyContent: "center",
                              alignContent: "center",
                              gap: GROUP_TILE_GAP_PX,
                              paddingVertical: 4,
                            }}
                          >
                            {pageUids.map((uid) => (
                              <View key={uid}>
                                {renderGroupVideoCell(uid, false, { w: cellW, h: cellH })}
                              </View>
                            ))}
                          </View>
                        );
                      }}
                    />
                    {groupTilesLayout.pageCount > 1 ? (
                      <View className="flex-row items-center justify-center gap-6 py-2">
                        <Pressable
                          disabled={groupVideoPage <= 0}
                          onPress={() => {
                            const next = Math.max(0, groupVideoPage - 1);
                            setGroupVideoPage(next);
                            groupPagesListRef.current?.scrollToOffset({
                              offset: (width - 24) * next,
                              animated: true,
                            });
                          }}
                          className="rounded-full bg-white/10 p-2 active:opacity-80 disabled:opacity-30"
                        >
                          <ChevronLeft size={22} color="#fff" />
                        </Pressable>
                        <Text className="text-xs text-white/70">
                          {groupVideoPage + 1} / {groupTilesLayout.pageCount}
                        </Text>
                        <Pressable
                          disabled={groupVideoPage >= groupTilesLayout.pageCount - 1}
                          onPress={() => {
                            const next = Math.min(
                              groupTilesLayout.pageCount - 1,
                              groupVideoPage + 1,
                            );
                            setGroupVideoPage(next);
                            groupPagesListRef.current?.scrollToOffset({
                              offset: (width - 24) * next,
                              animated: true,
                            });
                          }}
                          className="rounded-full bg-white/10 p-2 active:opacity-80 disabled:opacity-30"
                        >
                          <ChevronRight size={22} color="#fff" />
                        </Pressable>
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            ) : (
              <View className="flex-1">
                {peerUid != null ? (
                  remoteVideoOn.get(peerUid) === false ? (
                    <View className="flex-1 items-center justify-center bg-black">
                      <Text className="text-white/70">Đối phương đã tắt camera</Text>
                    </View>
                  ) : (
                    <RtcSurfaceView
                      style={{ flex: 1 }}
                      canvas={{
                        uid: peerUid,
                        sourceType: VideoSourceType.VideoSourceRemote,
                        renderMode: RenderModeType.RenderModeFit,
                      }}
                    />
                  )
                ) : (
                  <View className="flex-1 items-center justify-center">
                    <Text className="text-white/60">Đang chờ đối phương...</Text>
                  </View>
                )}
                <View className="absolute bottom-4 right-4 h-36 w-28 overflow-hidden rounded-lg border border-white/20">
                  <View className="flex-1 bg-neutral-900">
                    <RtcSurfaceView
                      style={{ flex: 1 }}
                      zOrderMediaOverlay
                      zOrderOnTop
                      canvas={{
                        uid: localUid,
                        sourceType: localScreenSharing
                          ? VideoSourceType.VideoSourceScreen
                          : localCameraSourceType,
                        renderMode: RenderModeType.RenderModeFit,
                      }}
                    />
                    <View className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5">
                      <Text className="text-[10px] font-semibold text-white" numberOfLines={1}>
                        Bạn
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        ) : (
          <View className="mb-4 min-h-[160px] flex-1 justify-start pt-10">
            {isGroup ? (
              <View className="items-center justify-center">
                <View className="mb-4 h-28 w-28 items-center justify-center rounded-full bg-blue-600/30">
                  <Mic size={48} color="#93c5fd" />
                </View>
                <Text className="text-lg font-semibold text-white">{`Thành viên: ${remoteUids.length + 1}`}</Text>
              </View>
            ) : (
              <View className="px-4">
                <View className="flex-row items-center gap-4">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-white/10">
                    <Phone size={28} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-white" numberOfLines={1}>
                      {peerUid != null ? labelForUid(peerUid) : calleeLabel}
                    </Text>
                    <Text className="mt-1 text-sm text-white/60" numberOfLines={1}>
                      {status === "ended"
                        ? statusLabel
                        : peerUid != null
                          ? "Đã kết nối"
                          : "Đang chờ đối phương..."}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {!uiHidden ? (
          <View className="flex-row flex-wrap items-center justify-center gap-4 pb-4">
            <Pressable
              onPress={onToggleMic}
              className={`h-14 w-14 items-center justify-center rounded-full border ${
                micAvailability !== "available"
                  ? "border-amber-500 bg-amber-600"
                  : isMicOn
                    ? "border-white/80 bg-white/10"
                    : "border-red-600 bg-red-600"
              } active:opacity-70`}
            >
              {isMicOn ? <Mic size={26} color="#fff" /> : <MicOff size={26} color="#fff" />}
            </Pressable>
            {isVideoCall ? (
              <>
                <Pressable
                  onPress={onToggleCamera}
                  disabled={localScreenSharing}
                  className={`h-14 w-14 items-center justify-center rounded-full border ${
                    cameraAvailability !== "available"
                      ? "border-amber-500 bg-amber-600"
                      : isCameraOn && !localScreenSharing
                        ? "border-white/80 bg-white/10"
                        : "border-red-600 bg-red-600"
                  } ${localScreenSharing ? "opacity-50" : ""} active:opacity-70`}
                >
                  {isCameraOn && !localScreenSharing ? (
                    <Video size={26} color="#fff" />
                  ) : (
                    <VideoOff size={26} color="#fff" />
                  )}
                </Pressable>
                {Platform.OS === "android" ? (
                  <Pressable
                    onPress={() => void toggleScreenShare()}
                    className={`h-14 w-14 items-center justify-center rounded-full border ${
                      localScreenSharing
                        ? "border-green-500 bg-green-600"
                        : "border-white/80 bg-white/10"
                    } active:opacity-70`}
                  >
                    <Monitor size={26} color="#fff" />
                  </Pressable>
                ) : null}
              </>
            ) : null}
            {showUpgradeButton ? (
              <Pressable
                onPress={requestUpgradeToVideo}
                className="h-14 w-14 items-center justify-center rounded-full border border-white/80 bg-white/10 active:opacity-70"
              >
                <Video size={26} color="#fff" />
              </Pressable>
            ) : null}

            {isGroup ? (
              <>
                <Pressable
                  onPress={handleGroupLeave}
                  className="h-14 w-14 items-center justify-center rounded-full bg-amber-600 active:opacity-80"
                >
                  <LogOut size={24} color="#fff" />
                </Pressable>
                {isHost ? (
                  <Pressable
                    onPress={handleGroupEndAll}
                    className="h-14 w-14 items-center justify-center rounded-full bg-red-600 active:opacity-80"
                  >
                    <PhoneOff size={26} color="#fff" />
                  </Pressable>
                ) : null}
              </>
            ) : (
              <Pressable
                onPress={handleDirectEnd}
                className="h-14 w-14 items-center justify-center rounded-full bg-red-600 active:opacity-80"
              >
                <PhoneOff size={28} color="#fff" />
              </Pressable>
            )}
          </View>
        ) : null}

        {Platform.OS === "android" && isVideoCall && joined && localScreenSharing && !uiHidden ? (
          <View className="mb-3 flex-row items-center justify-center gap-2 rounded-xl bg-black/50 px-3 py-2">
            <Text className="text-sm text-white">Âm thanh hệ thống</Text>
            <Switch
              value={screenAudioOn}
              onValueChange={(v) => {
                setScreenAudioOn(v);
                void applyScreenAudioWhileSharing(v);
              }}
            />
          </View>
        ) : null}
      </View>

      <Modal visible={showUpgradeIncomingModal} animationType="fade" transparent>
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View className="w-full max-w-[360px] rounded-2xl border border-white/10 bg-neutral-900 p-6">
            <Text className="mb-2 text-center text-lg font-bold text-white">Yêu cầu bật video</Text>
            <Text className="mb-6 text-center text-sm text-white/70">
              Đối phương muốn chuyển sang cuộc gọi video.
            </Text>
            <View className="flex-row items-center justify-center gap-4">
              <Pressable
                onPress={() => respondUpgradeToVideo(false)}
                className="rounded-xl bg-red-600 px-5 py-3 active:opacity-80"
              >
                <Text className="font-semibold text-white">Từ chối</Text>
              </Pressable>
              <Pressable
                onPress={() => respondUpgradeToVideo(true)}
                className="rounded-xl bg-green-600 px-5 py-3 active:opacity-80"
              >
                <Text className="font-semibold text-white">Đồng ý</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={participantsOpen} animationType="slide" transparent>
        <View className="flex-1 bg-black/60">
          <View className="mt-auto max-h-[70%] rounded-t-3xl border border-white/10 bg-neutral-950 p-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-bold text-white">Danh sách thành viên</Text>
              <Pressable onPress={() => setParticipantsOpen(false)} className="px-3 py-2">
                <Text className="font-semibold text-white/80">Đóng</Text>
              </Pressable>
            </View>
            <FlatList
              data={allGroupUids}
              keyExtractor={(u) => String(u)}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
              renderItem={({ item }) => renderGroupVideoCell(item, true)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
