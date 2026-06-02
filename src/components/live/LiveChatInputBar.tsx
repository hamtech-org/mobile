import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import LottieView from "lottie-react-native";
import { Heart } from "lucide-react-native";

import { useSocketContext } from "@/contexts/SocketContext";
import { useIconColors } from "@/hooks/useIconColors";
import { REACTION_META } from "@/types/reaction.types";
import type { LiveReactionType } from "@/components/live/LiveChatPanel";

const KEYBOARD_EXTRA = 8;

type Props = {
  sessionId: string;
  visible?: boolean;
  onKeyboardOffsetChange?: (offset: number) => void;
  /** Nền trong suốt, đè lên video live */
  overlayOnVideo?: boolean;
  paddingBottomInset?: number;
};

const REACTIONS: LiveReactionType[] = ["like", "love", "haha", "wow", "sad", "angry"];

export const LiveChatInputBar = ({
  sessionId,
  visible = true,
  onKeyboardOffsetChange,
  overlayOnVideo = false,
  paddingBottomInset = 0,
}: Props) => {
  const socket = useSocketContext();
  const { muted, foreground, isDark, primary } = useIconColors();
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const bottomAnim = useRef(new Animated.Value(0)).current;

  const bg = useMemo(() => {
    if (overlayOnVideo) return "transparent";
    return isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.85)";
  }, [isDark, overlayOnVideo]);
  const borderColor = useMemo(
    () => (overlayOnVideo ? "transparent" : isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.10)"),
    [isDark, overlayOnVideo],
  );
  const inputBg = useMemo(
    () =>
      overlayOnVideo ? "rgba(0,0,0,0.42)" : isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
    [isDark, overlayOnVideo],
  );
  const placeholderColor = overlayOnVideo ? "rgba(255,255,255,0.55)" : muted;
  const textColor = overlayOnVideo ? "#fff" : foreground;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardOpen(true);
      const target = e.endCoordinates.height + KEYBOARD_EXTRA;
      onKeyboardOffsetChange?.(Platform.OS === "android" ? 0 : target);
      if (Platform.OS === "android") {
        bottomAnim.setValue(target);
        return;
      }
      Animated.timing(bottomAnim, {
        toValue: target,
        duration: e.duration ?? 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
      onKeyboardOffsetChange?.(0);
      if (Platform.OS === "android") {
        bottomAnim.setValue(0);
        return;
      }
      Animated.timing(bottomAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [bottomAnim, onKeyboardOffsetChange]);

  const sendChat = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !socket) return;
    socket.emit("live:chat-message", { sessionId, text: trimmed });
    setText("");
  }, [sessionId, socket, text]);

  const sendReaction = useCallback(
    (type: LiveReactionType) => {
      if (!socket) return;
      socket.emit("live:reaction", { sessionId, reactionType: type });
      setPickerOpen(false);
    },
    [sessionId, socket],
  );

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        s.container,
        {
          bottom: bottomAnim,
          paddingBottom: (isKeyboardOpen ? 14 : 10) + paddingBottomInset,
          backgroundColor: bg,
          borderTopColor: borderColor,
          borderTopWidth: overlayOnVideo ? 0 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      {pickerOpen ? (
        <View style={[s.picker, { borderColor }]}>
          {REACTIONS.map((t) => {
            const meta = REACTION_META[t];
            return (
              <Pressable key={t} onPress={() => sendReaction(t)} style={s.pickerItem} hitSlop={8}>
                <LottieView source={meta.lottie} autoPlay loop={false} style={s.pickerLottie} />
                <Text style={s.pickerLabel}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={s.row}>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            setPickerOpen((v) => !v);
          }}
          hitSlop={10}
          style={[s.reactionBtn, { borderColor }]}
        >
          <Heart size={18} color={primary} />
        </Pressable>

        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="Nhắn tin..."
          placeholderTextColor={placeholderColor}
          style={[s.input, { backgroundColor: inputBg, color: textColor }]}
          returnKeyType="send"
          onSubmitEditing={sendChat}
        />

        <Pressable
          onPress={sendChat}
          disabled={!text.trim()}
          hitSlop={10}
          style={[
            s.sendBtn,
            { opacity: text.trim() ? 1 : 0.35, backgroundColor: isDark ? "#2563eb" : "#2563eb" },
          ]}
        >
          <Text style={[s.sendText, overlayOnVideo && s.sendTextOnVideo]}>Gửi</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  picker: {
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.72)",
    marginBottom: 10,
  },
  pickerItem: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pickerLottie: {
    width: 30,
    height: 30,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 2,
  },
  reactionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  sendBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  sendTextOnVideo: {
    color: "#fff",
  },
});
