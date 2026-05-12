import { useEffect, useRef } from "react";
import { Modal, Pressable, Text, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone, PhoneOff, Video } from "lucide-react-native";
import { useSelector } from "react-redux";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import type { RootState } from "@/store/store";

interface Props {
  acceptCall: () => void;
  rejectCall: () => void;
}

export function IncomingCallModal({ acceptCall, rejectCall }: Props) {
  const { status, callType, callerName, callerId, callScope } = useSelector(
    (state: RootState) => state.call,
  );
  const insets = useSafeAreaInsets();
  const patternRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  const isVisible = status === "incoming-ringing";

  useEffect(() => {
    if (!isVisible) {
      if (patternRef.current) {
        clearInterval(patternRef.current);
        patternRef.current = null;
      }
      Vibration.cancel();
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.remove();
        playerRef.current = null;
      }
      return;
    }
    const buzz = () => {
      Vibration.vibrate([0, 400, 200, 400], false);
    };
    buzz();
    patternRef.current = setInterval(buzz, 2800);

    // Chuông: nếu project có asset `mobile/assets/ringtones/amThanhNhan.mp3` thì phát loop.
    // Nếu không có file (chưa add vào repo), app vẫn rung như cũ.
    const startRingtone = async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: "duckOthers",
          shouldPlayInBackground: false,
        });
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const src = require("../../../assets/ringtones/amThanhNhan.mp3");
        const player = createAudioPlayer(src);
        player.loop = true;
        player.volume = 1.0;
        player.play();
        playerRef.current = player;
      } catch {
        // ignore: chưa có asset hoặc không phát được trên thiết bị hiện tại
      }
    };
    void startRingtone();

    return () => {
      if (patternRef.current) clearInterval(patternRef.current);
      patternRef.current = null;
      Vibration.cancel();
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.remove();
        playerRef.current = null;
      }
    };
  }, [isVisible]);

  const label = callerName || callerId || "?";
  const initial = label.charAt(0).toUpperCase();

  return (
    <Modal visible={isVisible} animationType="fade" transparent>
      <View
        className="flex-1 items-center justify-center bg-black/65 px-6"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="w-full max-w-[360px] items-center rounded-3xl border border-white/10 bg-neutral-900 p-8">
          <View className="mb-6 items-center justify-center">
            <View className="absolute h-24 w-24 rounded-full bg-blue-500/25" />
            <View className="h-20 w-20 items-center justify-center rounded-full bg-blue-600">
              <Text className="text-2xl font-bold text-white">{initial}</Text>
            </View>
          </View>

          <Text className="mb-1 text-center text-xl font-bold text-white">{label}</Text>
          <View className="mb-8 flex-row items-center justify-center gap-2">
            {callType === "video" ? (
              <Video size={18} color="rgba(255,255,255,0.5)" />
            ) : (
              <Phone size={18} color="rgba(255,255,255,0.5)" />
            )}
            <Text className="flex-1 text-center text-sm text-white/50">
              {callScope === "group"
                ? `Cuộc gọi nhóm ${callType === "video" ? "video" : "thoại"} — ${label} đang mời bạn`
                : `Cuộc gọi ${callType === "video" ? "video" : "thoại"} đến...`}
            </Text>
          </View>

          <View className="flex-row items-center justify-center gap-10">
            <Pressable
              onPress={rejectCall}
              className="h-16 w-16 items-center justify-center rounded-full bg-red-600 active:opacity-80"
              accessibilityLabel="Từ chối"
            >
              <PhoneOff size={28} color="#fff" />
            </Pressable>
            <Pressable
              onPress={acceptCall}
              className="h-16 w-16 items-center justify-center rounded-full bg-green-500 active:opacity-80"
              accessibilityLabel="Trả lời"
            >
              <Phone size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
