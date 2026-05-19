import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAddReelCommentMutation } from "@/store/api/newsfeedApi";
import { useIconColors } from "@/hooks/useIconColors";

interface Props {
  reelId: string;
  replyTo?: { commentId: string; authorName: string } | null;
  onClearReply?: () => void;
}

const KEYBOARD_EXTRA = 8;

export const ReelCommentInputBar = ({ reelId, replyTo, onClearReply }: Props) => {
  const [text, setText] = useState("");
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [addComment, { isLoading: isSending }] = useAddReelCommentMutation();
  const inputRef = useRef<TextInput>(null);
  const bottomAnim = useRef(new Animated.Value(0)).current;
  const { muted, foreground, isDark } = useIconColors();

  const bg = isDark ? "hsl(224, 30%, 10%)" : "hsl(0, 0%, 97%)";
  const borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";
  const inputBg = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
  const replyChipBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setIsKeyboardOpen(true);
      const target = e.endCoordinates.height + KEYBOARD_EXTRA;
      if (Platform.OS === "android") {
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

  // Auto-focus khi replyTo thay đổi
  useEffect(() => {
    if (replyTo) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [replyTo?.commentId]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    try {
      await addComment({
        reelId,
        content: trimmed,
        parentId: replyTo?.commentId,
      }).unwrap();
    } catch {
      // silent
    }
    setText("");
    onClearReply?.();
  }, [text, isSending, reelId, replyTo, addComment, onClearReply]);

  return (
    <Animated.View
      style={[
        s.container,
        {
          bottom: bottomAnim,
          paddingBottom: isKeyboardOpen ? 14 : 10,
          backgroundColor: bg,
          borderTopColor: borderColor,
        },
      ]}
    >
      {/* Reply chip */}
      {replyTo && (
        <View style={[s.replyChip, { backgroundColor: replyChipBg }]}>
          <Text style={[s.replyText, { color: muted }]}>
            Đang trả lời{" "}
            <Text style={[s.replyName, { color: foreground }]}>{replyTo.authorName}</Text>
          </Text>
          <Pressable onPress={onClearReply} hitSlop={8} style={s.replyClose}>
            <Ionicons name="close" size={14} color={muted} />
          </Pressable>
        </View>
      )}

      {/* Input row */}
      <View style={s.inputRow}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? `Trả lời ${replyTo.authorName}...` : "Thêm bình luận..."}
          placeholderTextColor={muted}
          style={[s.input, { backgroundColor: inputBg, color: foreground }]}
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
  },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  replyText: {
    fontSize: 12,
  },
  replyName: {
    fontWeight: "600",
  },
  replyClose: {
    padding: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 14,
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
