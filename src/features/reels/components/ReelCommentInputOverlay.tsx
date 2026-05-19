import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAddReelCommentMutation } from "@/store/api/newsfeedApi";

interface Props {
  reelId: string;
  onClose: () => void;
}

export const ReelCommentInputOverlay = ({ reelId, onClose }: Props) => {
  const { bottom, top } = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [addComment, { isLoading: isSending }] = useAddReelCommentMutation();

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
    onClose();
  }, [text, isSending, reelId, addComment, onClose]);

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? top : 0}
      >
        {/* Phần trên tap để đóng */}
        <Pressable style={{ flex: 1 }} onPress={handleDismiss} />

        {/* Input bar sát đáy */}
        <View style={[s.inputBar, { paddingBottom: Math.max(bottom, 12) }]}>
          <TextInput
            autoFocus
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const s = StyleSheet.create({
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
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
