import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAddReelCommentMutation } from "@/store/api/newsfeedApi";

interface Props {
  reelId: string;
}

// Extra padding above keyboard — accounts for IME toolbar on Android
const KEYBOARD_EXTRA = 8;

export const ReelCommentInputBar = ({ reelId }: Props) => {
  const [text, setText] = useState("");
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [addComment, { isLoading: isSending }] = useAddReelCommentMutation();

  const bottomAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardOpen(true);
      const target = e.endCoordinates.height + KEYBOARD_EXTRA;
      if (Platform.OS === "android") {
        // keyboardDidShow fires after keyboard is fully shown — skip animation to avoid lag
        bottomAnim.setValue(target);
      } else {
        Animated.timing(bottomAnim, {
          toValue: target,
          duration: e.duration ?? 250,
          useNativeDriver: false,
        }).start();
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardOpen(false);
      Animated.timing(bottomAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
      Keyboard.dismiss();
    };
  }, [bottomAnim]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    try {
      await addComment({ reelId, content: trimmed }).unwrap();
    } catch {
      // silent
    }
    setText("");
    Keyboard.dismiss();
  }, [text, isSending, reelId, addComment]);

  return (
    <Animated.View
      style={[s.container, { bottom: bottomAnim, paddingBottom: isKeyboardOpen ? 14 : 10 }]}
    >
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Thêm bình luận..."
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={s.input}
        returnKeyType="send"
        onSubmitEditing={() => void handleSend()}
        editable={!isSending}
      />
      <Pressable
        onPress={() => void handleSend()}
        disabled={!text.trim() || isSending}
        style={[s.sendBtn, { opacity: !text.trim() || isSending ? 0.4 : 1 }]}
        hitSlop={8}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="send" size={18} color="#fff" />
        )}
      </Pressable>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "hsl(0, 0%, 12%)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    fontSize: 14,
    color: "#fff",
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
});
