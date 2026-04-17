import { useCallback, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import {
  Camera,
  FileText,
  Image as ImageIcon,
  PlusCircle,
  SendHorizontal,
  Smile,
  ThumbsUp,
  X,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";

export interface PendingAttachment {
  localId: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

interface ChatInputProps {
  onSend: (content: string) => Promise<void>;
  onSendMedia?: (attachment: PendingAttachment, caption: string) => Promise<void>;
  sending?: boolean;
  /** Tin nhắn đang reply (null = không reply) */
  replyingTo?: IMessage | null;
  onClearReply?: () => void;
  /** Gọi khi user đang gõ (debounced emit typing) */
  onTyping?: () => void;
}

/**
 * ChatInput — Messenger/Zalo style với:
 * - Nút add (media picker: camera, gallery, file)
 * - Reply preview bar
 * - Pill input multiline
 * - Send button / ThumbsUp
 * - Typing emit khi gõ
 */
export const ChatInput = ({
  onSend,
  onSendMedia,
  sending = false,
  replyingTo,
  onClearReply,
  onTyping,
}: ChatInputProps) => {
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const { muted, primary, foreground } = useIconColors();
  const hasText = content.trim().length > 0;
  const hasSendable = hasText || attachment !== null;

  // ── Send handler ─────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (sending) return;

    if (attachment && onSendMedia) {
      await onSendMedia(attachment, content.trim());
      setAttachment(null);
      setContent("");
      return;
    }

    const text = content.trim();
    if (!text) return;
    await onSend(text);
    setContent("");
  }, [content, sending, attachment, onSend, onSendMedia]);

  // ── Media picker — Gallery ───────────────────────────────
  const pickImage = useCallback(async () => {
    setShowMediaMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAttachment({
      localId: `${Date.now()}`,
      uri: asset.uri,
      name: asset.fileName ?? `media_${Date.now()}`,
      mimeType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize,
    });
  }, []);

  // ── Media picker — Camera ────────────────────────────────
  const takePhoto = useCallback(async () => {
    setShowMediaMenu(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Quyền truy cập", "Cần quyền sử dụng camera để chụp ảnh.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAttachment({
      localId: `${Date.now()}`,
      uri: asset.uri,
      name: asset.fileName ?? `photo_${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      size: asset.fileSize,
    });
  }, []);

  // ── Media picker — File/Document ─────────────────────────
  const pickFile = useCallback(async () => {
    setShowMediaMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setAttachment({
      localId: `${Date.now()}`,
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size ?? undefined,
    });
  }, []);

  // ── Text change ──────────────────────────────────────────
  const handleTextChange = useCallback(
    (text: string) => {
      setContent(text);
      onTyping?.();
    },
    [onTyping],
  );

  return (
    <View className="bg-background border-t border-border/20">
      {/* Reply preview bar */}
      {replyingTo && (
        <View className="flex-row items-center px-4 py-2.5 bg-muted/30 border-b border-border/20">
          <View className="flex-1 min-w-0 border-l-[3px] border-primary pl-3">
            <Text className="text-primary text-[11px] font-bold" numberOfLines={1}>
              Trả lời {replyingTo.senderDisplayName ?? replyingTo.senderId}
            </Text>
            <Text className="text-muted-foreground text-[12px]" numberOfLines={1}>
              {replyingTo.isRecalled
                ? "Tin nhắn đã được thu hồi"
                : replyingTo.content}
            </Text>
          </View>
          <Pressable
            onPress={onClearReply}
            className="p-1.5 rounded-full active:bg-muted"
            hitSlop={8}
          >
            <X size={16} color={muted} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      {/* Attachment preview */}
      {attachment && (
        <View className="flex-row items-center px-4 py-2 bg-muted/20 gap-3">
          {attachment.mimeType.startsWith("image/") ? (
            <ImageIcon size={20} color={primary} strokeWidth={1.5} />
          ) : (
            <FileText size={20} color={primary} strokeWidth={1.5} />
          )}
          <Text className="flex-1 text-foreground text-[13px]" numberOfLines={1}>
            {attachment.name}
          </Text>
          <Pressable
            onPress={() => setAttachment(null)}
            className="p-1 rounded-full active:bg-muted"
          >
            <X size={16} color={muted} strokeWidth={2} />
          </Pressable>
        </View>
      )}

      {/* Input row */}
      <View className="flex-row items-end px-2 pt-4 min-h-[56px] gap-1">
        {/* Nút Add — toggle media menu */}
        <View className="h-11 w-11 items-center justify-center">
          <Pressable
            onPress={() => setShowMediaMenu(!showMediaMenu)}
            className="active:opacity-70"
            hitSlop={10}
          >
            <PlusCircle
              size={28}
              color={showMediaMenu ? foreground : primary}
              strokeWidth={1.5}
              style={showMediaMenu ? { transform: [{ rotate: "45deg" }] } : undefined}
            />
          </Pressable>
        </View>

        {/* Pill Input */}
        <View
          className="flex-1 bg-muted rounded-[22px] px-4 flex-row items-center"
          style={{ minHeight: 44, paddingVertical: 4 }}
        >
          <TextInput
            className="flex-1 text-[16px] text-foreground p-0 m-0"
            placeholder="Aa"
            placeholderTextColor={muted}
            value={content}
            onChangeText={handleTextChange}
            multiline
            style={{
              minHeight: 36,
              maxHeight: 120,
              textAlignVertical: "center",
              paddingTop: 4,
              paddingBottom: 4,
            }}
          />
          {!hasText && !attachment && (
            <Pressable hitSlop={10}>
              <Smile size={24} color={muted} strokeWidth={1.5} />
            </Pressable>
          )}
        </View>

        {/* Nút Send hoặc Like */}
        <View className="h-11 w-11 items-center justify-center">
          {hasSendable ? (
            <Pressable
              onPress={handleSend}
              disabled={sending}
              className={`size-9 rounded-full bg-primary items-center justify-center ${
                sending ? "opacity-50" : "active:opacity-80"
              }`}
            >
              <SendHorizontal size={18} color="white" strokeWidth={2.0} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onSend("👍")}
              className="active:opacity-70"
              hitSlop={10}
            >
              <ThumbsUp size={26} color={primary} strokeWidth={1.5} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Media menu popup */}
      {showMediaMenu && (
        <View className="flex-row justify-around px-6 py-3 bg-muted/20 border-t border-border/15">
          <MediaMenuItem
            icon={<ImageIcon size={22} color={primary} strokeWidth={1.5} />}
            label="Ảnh/Video"
            onPress={pickImage}
          />
          <MediaMenuItem
            icon={<Camera size={22} color={primary} strokeWidth={1.5} />}
            label="Chụp ảnh"
            onPress={takePhoto}
          />
          <MediaMenuItem
            icon={<FileText size={22} color={primary} strokeWidth={1.5} />}
            label="Tài liệu"
            onPress={pickFile}
          />
        </View>
      )}
    </View>
  );
};

// ── Media Menu Item ──────────────────────────────────────────────────────

function MediaMenuItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center gap-1.5 px-4 py-2 rounded-xl active:bg-muted/50"
    >
      {icon}
      <Text className="text-foreground text-[12px] font-medium">{label}</Text>
    </Pressable>
  );
}
