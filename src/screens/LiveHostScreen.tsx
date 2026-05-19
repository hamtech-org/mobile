import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  VideoContentHint,
  VideoDimensions,
  VideoSourceType,
} from "react-native-agora";
import { MessageSquare, Mic, MicOff, Monitor, Video, VideoOff } from "lucide-react-native";

import { LiveChatPanel, type LiveChatLine } from "@/components/live/LiveChatPanel";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";

import { env } from "@/config/env";
import { useSocketContext } from "@/contexts/SocketContext";
import { useAppSelector } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import { useEndLiveSessionMutation, useGetLiveSessionQuery } from "@/store/api/liveApi";
import { fetchLiveRtcToken } from "@/utils/liveAgora";
import { formatLiveDuration } from "@/utils/liveSessionUtils";
import { toast } from "@/utils/appToast";

function paramOne(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

async function ensureAndroidLivePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const res = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    PermissionsAndroid.PERMISSIONS.CAMERA,
  ] as never);
  const audioOk = res["android.permission.RECORD_AUDIO"] === PermissionsAndroid.RESULTS.GRANTED;
  const camOk = res["android.permission.CAMERA"] === PermissionsAndroid.RESULTS.GRANTED;
  return audioOk && camOk;
}

function buildScreenCaptureParams(captureAudio: boolean): ScreenCaptureParameters2 {
  const cap = new ScreenCaptureParameters2();
  cap.captureVideo = true;
  cap.captureAudio = captureAudio;
  const vp = new ScreenVideoParameters();
  const dim = new VideoDimensions();
  dim.width = 720;
  dim.height = 1280;
  vp.dimensions = dim;
  vp.frameRate = 15;
  vp.contentHint = VideoContentHint.ContentHintDetails;
  cap.videoParams = vp;
  return cap;
}

export function LiveHostScreen() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = paramOne(params.sessionId);
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const socket = useSocketContext();
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const { primary } = useIconColors();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const {
    data: session,
    isLoading,
    error,
  } = useGetLiveSessionQuery(sessionId, {
    skip: !sessionId,
    pollingInterval: 12_000,
  });
  const [endSession, { isLoading: ending }] = useEndLiveSessionMutation();

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  const [screenAudioOn, setScreenAudioOn] = useState(false);
  const [joined, setJoined] = useState(false);
  const [localUid, setLocalUid] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [durationTick, setDurationTick] = useState(Date.now());
  const [messages, setMessages] = useState<LiveChatLine[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  const engineRef = useRef<IRtcEngine | null>(null);
  const registeredHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const channelRef = useRef("");

  const shutdownRtc = useCallback(() => {
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
    setScreenOn(false);
  }, []);

  useEffect(() => {
    void ScreenOrientation.unlockAsync();
    return () => {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    if (!session?.startedAt) return;
    const t = setInterval(() => setDurationTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.startedAt]);

  useEffect(() => {
    if (!sessionId || !session) return;
    if (session.hostUserId !== currentUserId) {
      router.replace(`/(main)/(live)/${sessionId}/watch`);
      return;
    }
    if (session.status === "ended") {
      router.replace("/(main)/(live)");
    }
  }, [currentUserId, session, sessionId]);

  const onChatMessage = useCallback((raw: unknown) => {
    const p = raw as LiveChatLine;
    if (p?.sessionId !== sessionIdRef.current) return;
    setMessages((m) => [...m.slice(-200), p]);
  }, []);

  const onSessionEnded = useCallback(() => {
    toast.info("Phiên live đã kết thúc");
    shutdownRtc();
    router.replace("/(main)/(live)");
  }, [shutdownRtc]);

  useEffect(() => {
    if (!sessionId || !socket) return;
    socket.emit("live:join", { sessionId });
    return () => {
      socket.emit("live:leave", { sessionId });
    };
  }, [sessionId, socket]);

  useEffect(() => {
    if (!socket) return;
    const onViewers = (raw: unknown) => {
      const p = raw as { sessionId?: string; viewerCount?: number };
      if (p?.sessionId !== sessionIdRef.current) return;
      setViewerCount(typeof p.viewerCount === "number" ? p.viewerCount : 0);
    };
    socket.on("live:chat-message", onChatMessage);
    socket.on("live:session-ended", onSessionEnded);
    socket.on("live:viewers-updated", onViewers);
    return () => {
      socket.off("live:chat-message", onChatMessage);
      socket.off("live:session-ended", onSessionEnded);
      socket.off("live:viewers-updated", onViewers);
    };
  }, [onChatMessage, onSessionEnded, socket]);

  useEffect(() => {
    const channelName = session?.channelName;
    if (!channelName || !env.agoraAppId) return;
    if (session.hostUserId !== currentUserId) return;

    channelRef.current = channelName;
    let cancelled = false;

    const run = async () => {
      const ok = await ensureAndroidLivePermissions();
      if (!ok || cancelled) {
        Alert.alert("Quyền", "Cần quyền micro và camera để phát live.");
        router.replace("/(main)/(live)");
        return;
      }

      const engine = createAgoraRtcEngine();
      engineRef.current = engine;
      engine.initialize({
        appId: env.agoraAppId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      engine.enableAudio();
      engine.enableVideo();
      engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
      try {
        engine.setEnableSpeakerphone(true);
      } catch {
        /* ignore */
      }
      engine.startPreview(VideoSourceType.VideoSourceCameraPrimary);

      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => {
          if (cancelled) return;
          setJoined(true);
          socketRef.current?.emit("live:host-publish-start", { sessionId });
        },
        onError: (err, msg) => {
          if (__DEV__) console.warn("[LiveHost Agora]", err, msg);
        },
      };
      registeredHandlerRef.current = handler;
      engine.registerEventHandler(handler);

      try {
        const { token, uid } = await fetchLiveRtcToken(channelName, "publisher");
        if (cancelled) return;
        setLocalUid(uid);

        const options = {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          publishMicrophoneTrack: true,
          publishCameraTrack: true,
          autoSubscribeAudio: false,
          autoSubscribeVideo: false,
        } as ChannelMediaOptions;

        engine.joinChannel(token, channelName, uid, options);
      } catch (e) {
        if (__DEV__) console.warn("[LiveHost] join failed", e);
        if (!cancelled) {
          Alert.alert("Lỗi", "Không thể tham gia kênh live.");
          shutdownRtc();
          router.replace("/(main)/(live)");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (sessionId) {
        socketRef.current?.emit("live:host-publish-stop", { sessionId });
      }
      shutdownRtc();
    };
  }, [currentUserId, session?.channelName, session?.hostUserId, sessionId, shutdownRtc]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !joined) return;
    engine.muteLocalAudioStream(!micOn);
    try {
      engine.updateChannelMediaOptions({
        publishMicrophoneTrack: micOn,
      } as ChannelMediaOptions);
    } catch {
      /* ignore */
    }
  }, [joined, micOn]);

  const applyCameraPublish = useCallback(
    (nextCamOn: boolean) => {
      const engine = engineRef.current;
      if (!engine || !joined || screenOn) return;
      engine.enableLocalVideo(nextCamOn);
      engine.muteLocalVideoStream(!nextCamOn);
      if (nextCamOn) {
        engine.startPreview(VideoSourceType.VideoSourceCameraPrimary);
      }
      try {
        engine.updateChannelMediaOptions({
          publishCameraTrack: nextCamOn,
          publishScreenCaptureVideo: false,
        } as ChannelMediaOptions);
      } catch {
        /* ignore */
      }
    },
    [joined, screenOn],
  );

  useEffect(() => {
    applyCameraPublish(camOn);
  }, [applyCameraPublish, camOn]);

  const startScreenShare = useCallback(
    async (withAudio: boolean) => {
      if (Platform.OS !== "android") {
        Alert.alert("Chia sẻ màn hình", "Chỉ hỗ trợ Android dev build.");
        return;
      }
      const engine = engineRef.current;
      if (!engine || !joined) return;

      const cap = buildScreenCaptureParams(withAudio);
      const ret = engine.startScreenCapture(cap);
      if (ret !== 0) {
        Alert.alert("Chia sẻ màn hình", `Không thể bắt đầu (mã ${String(ret)}).`);
        return;
      }
      try {
        engine.updateChannelMediaOptions({
          publishScreenCaptureVideo: true,
          publishCameraTrack: false,
        } as ChannelMediaOptions);
      } catch {
        /* ignore */
      }
      setScreenOn(true);
      setCamOn(false);
    },
    [joined],
  );

  const stopScreenShare = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      engine.stopScreenCapture();
      engine.updateChannelMediaOptions({
        publishScreenCaptureVideo: false,
        publishCameraTrack: camOn,
      } as ChannelMediaOptions);
      if (camOn) {
        engine.startPreview(VideoSourceType.VideoSourceCameraPrimary);
      }
    } catch {
      /* ignore */
    }
    setScreenOn(false);
  }, [camOn]);

  const toggleScreenShare = useCallback(async () => {
    if (screenOn) {
      stopScreenShare();
      return;
    }
    await startScreenShare(screenAudioOn);
  }, [screenAudioOn, screenOn, startScreenShare, stopScreenShare]);

  const confirmEndSession = useCallback(() => {
    Alert.alert("Kết thúc phiên", "Bạn có chắc muốn kết thúc phiên live?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Kết thúc",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await endSession({ sessionId }).unwrap();
            } catch {
              toast.error("Không thể kết thúc phiên");
              return;
            }
            shutdownRtc();
            router.replace("/(main)/(live)");
          })();
        },
      },
    ]);
  }, [endSession, sessionId, shutdownRtc]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      confirmEndSession();
      return true;
    });
    return () => sub.remove();
  }, [confirmEndSession]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />
    ),
    [],
  );

  if (!sessionId || isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-6">
        <Text className="text-center text-white">Không tải được phiên live.</Text>
        <Pressable onPress={() => router.replace("/(main)/(live)")} className="mt-4">
          <Text className="text-primary">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const duration = formatLiveDuration(session.startedAt, durationTick);
  const previewSource = screenOn
    ? VideoSourceType.VideoSourceScreen
    : VideoSourceType.VideoSourceCameraPrimary;

  return (
    <View className="flex-1 bg-black">
      <View className={`flex-1 ${isLandscape && chatOpen ? "flex-row" : ""}`}>
        <View className="flex-1">
          {joined && localUid !== 0 ? (
            <RtcSurfaceView
              style={{ flex: 1 }}
              canvas={{
                uid: screenOn ? 0 : localUid,
                sourceType: previewSource,
                renderMode: RenderModeType.RenderModeFit,
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#fff" />
              <Text className="mt-2 text-sm text-white/70">Đang kết nối...</Text>
            </View>
          )}

          <SafeAreaView className="absolute left-0 right-0 top-0" edges={["top"]}>
            <View className="flex-row items-start justify-between px-3 pt-2">
              <View className="max-w-[70%]">
                <Text className="text-base font-semibold text-white" numberOfLines={1}>
                  {session.title}
                </Text>
                <View className="mt-1 flex-row flex-wrap items-center gap-2">
                  <View className="rounded-full bg-red-600 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-white">LIVE</Text>
                  </View>
                  <Text className="text-xs text-white/80">{viewerCount} người xem</Text>
                  <Text className="font-mono text-xs text-white/80">{duration}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setChatOpen((v) => !v)}
                className="size-10 items-center justify-center rounded-full bg-black/50"
              >
                <MessageSquare size={20} color="#fff" />
              </Pressable>
            </View>
          </SafeAreaView>

          <SafeAreaView className="absolute bottom-0 left-0 right-0" edges={["bottom"]}>
            <View className="px-3 pb-2">
              <View className="mb-3 flex-row items-center justify-center gap-4">
                <Pressable
                  onPress={() => setMicOn((v) => !v)}
                  className="size-12 items-center justify-center rounded-full bg-white/15"
                >
                  {micOn ? <Mic size={22} color="#fff" /> : <MicOff size={22} color="#f87171" />}
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (screenOn) return;
                    setCamOn((v) => !v);
                  }}
                  disabled={screenOn}
                  className="size-12 items-center justify-center rounded-full bg-white/15"
                >
                  {camOn && !screenOn ? (
                    <Video size={22} color="#fff" />
                  ) : (
                    <VideoOff size={22} color={screenOn ? "#94a3b8" : "#f87171"} />
                  )}
                </Pressable>
                <Pressable
                  onPress={() => void toggleScreenShare()}
                  className="size-12 items-center justify-center rounded-full bg-white/15"
                >
                  <Monitor size={22} color={screenOn ? primary : "#fff"} />
                </Pressable>
              </View>

              {screenOn ? (
                <View className="mb-3 flex-row items-center justify-center gap-2 rounded-xl bg-black/50 px-3 py-2">
                  <Text className="text-sm text-white">Âm thanh hệ thống</Text>
                  <Switch
                    value={screenAudioOn}
                    onValueChange={(v) => {
                      setScreenAudioOn(v);
                      if (!screenOn) return;
                      const engine = engineRef.current;
                      if (!engine) return;
                      void (async () => {
                        try {
                          engine.stopScreenCapture();
                        } catch {
                          /* ignore */
                        }
                        const cap = buildScreenCaptureParams(v);
                        const ret = engine.startScreenCapture(cap);
                        if (ret !== 0) {
                          Alert.alert(
                            "Âm thanh hệ thống",
                            `Không thể bật lại (mã ${String(ret)}).`,
                          );
                          return;
                        }
                        try {
                          engine.updateChannelMediaOptions({
                            publishScreenCaptureVideo: true,
                            publishCameraTrack: false,
                          } as ChannelMediaOptions);
                        } catch {
                          /* ignore */
                        }
                      })();
                    }}
                  />
                </View>
              ) : null}

              <Pressable
                onPress={confirmEndSession}
                disabled={ending}
                className="items-center rounded-xl bg-red-600 py-3 active:opacity-90 disabled:opacity-60"
              >
                <Text className="font-semibold text-white">
                  {ending ? "Đang kết thúc..." : "Kết thúc phiên"}
                </Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {chatOpen && isLandscape ? (
          <View className="w-[300px] border-l border-white/15 bg-black/80 p-3">
            <LiveChatPanel sessionId={sessionId} messages={messages} variant="dark" />
          </View>
        ) : null}
      </View>

      {chatOpen && !isLandscape ? (
        <BottomSheet
          index={0}
          snapPoints={["40%"]}
          enablePanDownToClose
          onClose={() => setChatOpen(false)}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetView className="flex-1 bg-neutral-900 px-3 pb-4">
            <LiveChatPanel sessionId={sessionId} messages={messages} variant="dark" />
          </BottomSheetView>
        </BottomSheet>
      ) : null}
    </View>
  );
}
