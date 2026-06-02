import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChannelMediaOptions,
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  type IRtcEngine,
  type IRtcEngineEventHandler,
  RenderModeType,
  RemoteVideoState,
  RemoteVideoStateReason,
  RtcSurfaceView,
  VideoSourceType,
} from "react-native-agora";
import { ChevronLeft, PanelBottom, PanelBottomClose } from "lucide-react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

import { LiveChatInputBar } from "@/components/live/LiveChatInputBar";
import { LiveChatOverlay } from "@/components/live/LiveChatOverlay";
import { LiveFloatingReactions } from "@/components/live/LiveFloatingReactions";
import type { LiveChatLine } from "@/components/live/LiveChatPanel";
import { env } from "@/config/env";
import { useSocketContext } from "@/contexts/SocketContext";
import { useAppSelector } from "@/hooks/useAppStore";
import { useHideMainTabBar } from "@/hooks/useHideMainTabBar";
import { useGetLiveSessionQuery } from "@/store/api/liveApi";
import { fetchLiveRtcToken } from "@/utils/liveAgora";
import { formatLiveDuration } from "@/utils/liveSessionUtils";

function paramOne(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function paramAsViewer(v: string | string[] | undefined): boolean {
  const raw = paramOne(v);
  return raw === "1" || raw === "true";
}

async function ensureAndroidWatchPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export function LiveWatchScreen() {
  const params = useLocalSearchParams<{ sessionId?: string; asViewer?: string }>();
  const sessionId = paramOne(params.sessionId);
  const asViewer = paramAsViewer(params.asViewer);
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const socket = useSocketContext();
  const insets = useSafeAreaInsets();
  const {
    data: session,
    isLoading,
    error,
  } = useGetLiveSessionQuery(sessionId, {
    skip: !sessionId,
    pollingInterval: 12_000,
  });

  const [joined, setJoined] = useState(false);
  const [hostUid, setHostUid] = useState<number | null>(null);
  const [hostVideoOn, setHostVideoOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [durationTick, setDurationTick] = useState(Date.now());
  const [messages, setMessages] = useState<LiveChatLine[]>([]);
  const [chatVisible, setChatVisible] = useState(true);
  const [tabBarHidden, setTabBarHidden] = useState(false);

  useHideMainTabBar(tabBarHidden);

  const inputBottomInset = tabBarHidden ? Math.max(insets.bottom, 6) : 0;
  const commentBottom = 52 + inputBottomInset;

  const engineRef = useRef<IRtcEngine | null>(null);
  const registeredHandlerRef = useRef<IRtcEngineEventHandler | null>(null);
  const hostUidRef = useRef<number | null>(null);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const shutdownRtc = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
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
    setHostUid(null);
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
    if (!asViewer && session.hostUserId === currentUserId) {
      router.replace(`/(main)/(live)/${sessionId}/host`);
      return;
    }
    if (session.status === "ended") {
      Alert.alert("Phiên đã kết thúc", "Phiên live này không còn hoạt động.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [asViewer, currentUserId, session, sessionId]);

  const onChatMessage = useCallback((raw: unknown) => {
    const p = raw as LiveChatLine;
    if (p?.sessionId !== sessionIdRef.current) return;
    setMessages((m) => [...m.slice(-200), p]);
  }, []);

  const onSessionEnded = useCallback(() => {
    shutdownRtc();
    Alert.alert("Phiên đã kết thúc", "Host đã kết thúc phiên live.", [
      { text: "OK", onPress: () => router.back() },
    ]);
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
    if (session.hostUserId === currentUserId) return;

    let cancelled = false;

    const run = async () => {
      const ok = await ensureAndroidWatchPermissions();
      if (!ok || cancelled) {
        Alert.alert("Quyền", "Cần quyền âm thanh để xem live.");
        router.back();
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
      engine.setClientRole(ClientRoleType.ClientRoleAudience);
      try {
        engine.setEnableSpeakerphone(true);
      } catch {
        /* ignore */
      }

      const handler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => {
          if (cancelled) return;
          setJoined(true);
        },
        onUserJoined: (_connection, remoteUid) => {
          if (cancelled) return;
          hostUidRef.current = remoteUid;
          setHostUid(remoteUid);
          setHostVideoOn(true);
        },
        onUserOffline: (_connection, remoteUid) => {
          if (hostUidRef.current === remoteUid) {
            hostUidRef.current = null;
            setHostUid(null);
          }
        },
        onRemoteVideoStateChanged: (_connection, remoteUid, state, reason) => {
          if (cancelled) return;
          if (hostUidRef.current != null && remoteUid !== hostUidRef.current) return;
          const isOn =
            state === RemoteVideoState.RemoteVideoStateDecoding ||
            state === RemoteVideoState.RemoteVideoStateStarting ||
            reason === RemoteVideoStateReason.RemoteVideoStateReasonRemoteUnmuted;
          const isOff =
            state === RemoteVideoState.RemoteVideoStateStopped ||
            reason === RemoteVideoStateReason.RemoteVideoStateReasonRemoteMuted;
          if (!isOn && !isOff) return;
          setHostVideoOn(isOn && !isOff);
        },
        onError: (err, msg) => {
          if (__DEV__) console.warn("[LiveWatch Agora]", err, msg);
        },
      };
      registeredHandlerRef.current = handler;
      engine.registerEventHandler(handler);

      try {
        const { token, uid } = await fetchLiveRtcToken(channelName, "subscriber");
        if (cancelled) return;

        const options = {
          clientRoleType: ClientRoleType.ClientRoleAudience,
          channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
          publishMicrophoneTrack: false,
          publishCameraTrack: false,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        } as ChannelMediaOptions;

        engine.joinChannel(token, channelName, uid, options);
      } catch (e) {
        if (__DEV__) console.warn("[LiveWatch] join failed", e);
        if (!cancelled) {
          Alert.alert("Lỗi", "Không thể tham gia xem live.");
          shutdownRtc();
          router.back();
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      shutdownRtc();
    };
  }, [currentUserId, session?.channelName, session?.hostUserId, shutdownRtc]);

  const setImmersive = useCallback((immersive: boolean) => {
    setChatVisible(!immersive);
  }, []);

  const swipeToggle = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          if (Math.abs(e.translationX) < 48) return;
          // Vuốt phải → ẩn chat (full video); vuốt trái → hiện lại chat
          if (e.translationX > 48) {
            runOnJS(setImmersive)(true);
          } else if (e.translationX < -48) {
            runOnJS(setImmersive)(false);
          }
        }),
    [setImmersive],
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
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-primary">Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const duration = formatLiveDuration(session.startedAt, durationTick);

  return (
    <View className="flex-1 bg-black">
      <GestureDetector gesture={swipeToggle}>
        <View className="flex-1">
          <View className="flex-1">
            {joined && hostUid != null && hostVideoOn ? (
              <RtcSurfaceView
                style={{ flex: 1 }}
                canvas={{
                  uid: hostUid,
                  sourceType: VideoSourceType.VideoSourceRemote,
                  renderMode: RenderModeType.RenderModeFit,
                }}
              />
            ) : (
              <View className="flex-1 items-center justify-center bg-neutral-950">
                {!joined ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm text-white/70">
                    {hostUid == null ? "Đang chờ host phát..." : "Host đã tắt video"}
                  </Text>
                )}
              </View>
            )}

            <LiveFloatingReactions sessionId={sessionId} />

            <LiveChatOverlay
              messages={messages}
              visible={chatVisible}
              bottomOffset={commentBottom}
            />

            <LiveChatInputBar
              sessionId={sessionId}
              visible={chatVisible}
              overlayOnVideo
              paddingBottomInset={inputBottomInset}
            />

            <SafeAreaView className="absolute left-0 right-0 top-0" edges={["top"]}>
              <View className="flex-row items-center justify-between px-3 pt-2">
                <Pressable
                  onPress={() => {
                    shutdownRtc();
                    router.back();
                  }}
                  className="size-10 items-center justify-center rounded-full bg-black/50"
                >
                  <ChevronLeft size={22} color="#fff" />
                </Pressable>
                <View className="flex-1 px-2">
                  <Text className="text-center text-sm font-semibold text-white" numberOfLines={1}>
                    {session.title}
                  </Text>
                  <Text className="text-center text-xs text-white/75">
                    {viewerCount} người xem · {duration}
                    {!chatVisible ? " · Vuốt trái để mở chat" : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setTabBarHidden((v) => !v)}
                  accessibilityLabel={tabBarHidden ? "Hiện menu dưới" : "Ẩn menu dưới"}
                  className="size-10 items-center justify-center rounded-full bg-black/50"
                >
                  {tabBarHidden ? (
                    <PanelBottom size={20} color="#fff" />
                  ) : (
                    <PanelBottomClose size={20} color="#fff" />
                  )}
                </Pressable>
              </View>
            </SafeAreaView>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}
