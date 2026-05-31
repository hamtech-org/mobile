import { useState, useRef, useEffect } from "react";
import {
  DeviceEventEmitter,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import { Audio } from "expo-av";
import { Play, Pause } from "lucide-react-native";
import type { IMessage } from "@/types/chat.types";

interface VoiceMessagePlayerProps {
  message: IMessage;
  isOwn: boolean;
  onShowActions?: () => void;
}

export function VoiceMessagePlayer({ message, isOwn, onShowActions }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [progressBarWidth, setProgressBarWidth] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const duration = message.duration || 0;
  const audioUrl = message.mediaUrl || "";

  // Định dạng thời gian (ví dụ: 75 -> "1:15")
  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Callback nhận trạng thái phát của Sound
  const onPlaybackStatusUpdate = (status: any) => {
    if (!status.isLoaded) return;

    setCurrentTime(status.positionMillis / 1000);
    setIsPlaying(status.isPlaying);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setCurrentTime(0);
      if (soundRef.current) {
        void soundRef.current.setPositionAsync(0);
      }
    }
  };

  // Tải âm thanh khi mount hoặc đổi audioUrl
  useEffect(() => {
    let isMounted = true;

    async function loadAudio() {
      if (!audioUrl) return;

      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false, rate: 1.0, shouldCorrectPitch: true },
          onPlaybackStatusUpdate,
        );

        if (isMounted) {
          soundRef.current = sound;
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        console.error("Lỗi khi tải tin nhắn thoại trên Mobile:", error);
      }
    }

    void loadAudio();

    return () => {
      isMounted = false;
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, [audioUrl]);

  // Đăng ký sự kiện dừng phát toàn cục
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(
      "hamtech-voice-play",
      (data: { messageId: string }) => {
        if (data?.messageId !== message.messageId) {
          if (soundRef.current && isPlaying) {
            void soundRef.current.pauseAsync();
          }
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [message.messageId, isPlaying]);

  // Điều khiển Phát/Tạm dừng
  const togglePlay = async () => {
    if (!soundRef.current) return;

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        // Gửi sự kiện dừng phát các audio khác
        DeviceEventEmitter.emit("hamtech-voice-play", {
          messageId: message.messageId,
        });

        // Cấu hình âm thanh sạch sẽ cho playback
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.error("Lỗi điều khiển phát âm thanh:", err);
    }
  };

  // Tua nhanh/chậm qua cơ chế Tap-to-seek trên thanh tiến trình
  const handleProgressBarPress = async (event: GestureResponderEvent) => {
    if (!soundRef.current || progressBarWidth === 0 || duration === 0) return;

    const { locationX } = event.nativeEvent;
    const ratio = Math.max(0, Math.min(1, locationX / progressBarWidth));
    const seekTimeSeconds = ratio * duration;

    try {
      await soundRef.current.setPositionAsync(seekTimeSeconds * 1000);
      setCurrentTime(seekTimeSeconds);
    } catch (err) {
      console.warn("Lỗi tua âm thanh:", err);
    }
  };

  // Tính phần trăm tiến trình phát hiện tại
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Pressable
      onLongPress={onShowActions}
      delayLongPress={300}
      className={`w-[185px] max-w-full select-none flex-row items-center gap-2.5 rounded-[16px] px-3 py-2 shadow-sm ${
        isOwn
          ? "self-end rounded-br-[4px] bg-primary"
          : "self-start rounded-bl-[4px] border border-black/[0.06] bg-card dark:border-white/10 dark:bg-zinc-800"
      }`}
    >
      {/* Nút Play/Pause */}
      <Pressable
        onPress={togglePlay}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full active:scale-95 ${
          isOwn ? "bg-white/20 text-white" : "bg-primary text-white"
        }`}
      >
        {isPlaying ? (
          <Pause size={14} color="white" fill="white" />
        ) : (
          <Play size={14} color="white" fill="white" style={{ marginLeft: 1.5 }} />
        )}
      </Pressable>

      {/* Tiến trình & Thời gian */}
      <View className="min-w-0 flex-1 gap-0.5">
        {/* Thanh trượt tiến trình phát custom (Tap to seek) */}
        <Pressable
          onPress={handleProgressBarPress}
          onLayout={(e: LayoutChangeEvent) => setProgressBarWidth(e.nativeEvent.layout.width)}
          className="h-2 w-full justify-center py-0.5"
        >
          {/* Nền track */}
          <View
            className={`h-1 w-full rounded-full ${
              isOwn ? "bg-white/30" : "bg-black/10 dark:bg-white/10"
            }`}
          >
            {/* Thanh tiến trình active */}
            <View
              className={`relative h-1 rounded-full ${isOwn ? "bg-white" : "bg-primary"}`}
              style={{ width: `${progressPercent}%` }}
            >
              {/* Thumb chấm tròn nhỏ ở đầu */}
              <View
                className={`absolute right-[-3px] top-[-2px] h-2 w-2 rounded-full ${
                  isOwn ? "bg-white" : "bg-primary"
                }`}
              />
            </View>
          </View>
        </Pressable>

        {/* Thời gian */}
        <Text
          className={`mt-0.5 text-[9px] font-semibold ${
            isOwn ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>
    </Pressable>
  );
}
