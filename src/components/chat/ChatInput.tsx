import { useCallback, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
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
import { toast } from "@/utils/appToast";
import type { IMessage } from "@/types/chat.types";
import { formatFileSize } from "@/utils/file";
import { formatChatPreviewLine } from "@/utils/messageDisplay";

export interface PendingAttachment {
  localId: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

interface ChatInputProps {
  onSend: (content: string) => void | Promise<void>;
  onSendMedia?: (attachment: PendingAttachment, caption: string) => void | Promise<void>;
  /** Tin nhắn đang reply (null = không reply) */
  replyingTo?: IMessage | null;
  /** Dùng để format preview reply (tránh JSON thô). */
  currentUserId?: string;
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
  replyingTo,
  currentUserId = "",
  onClearReply,
  onTyping,
}: ChatInputProps) => {
  const [content, setContent] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const { muted, primary, foreground } = useIconColors();
  const hasText = content.trim().length > 0;
  const hasSendable = hasText || attachment !== null;

  // ── Send handler — clear ngay, gửi nền (không chờ API, không loading ô nhập) ──
  const handleSend = useCallback(() => {
    if (attachment && onSendMedia) {
      const att = attachment;
      const cap = content.trim();
      setAttachment(null);
      setContent("");
      setShowMediaMenu(false);
      void Promise.resolve(onSendMedia(att, cap)).catch(() => {});
      return;
    }

    const text = content.trim();
    if (!text) return;
    setContent("");
    void Promise.resolve(onSend(text)).catch(() => {});
  }, [content, attachment, onSend, onSendMedia]);

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
      toast.error("Cần quyền sử dụng camera để chụp ảnh");
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
              {formatChatPreviewLine(replyingTo, currentUserId)}
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

      {/* Attachment preview — ảnh/video/file trước khi gửi */}
      {attachment && (
        <View className="px-3 pt-2 pb-1 bg-muted/25 border-b border-border/15">
          <View className="rounded-2xl overflow-hidden bg-muted/40 border border-border/20 max-h-[240px]">
            {attachment.mimeType.startsWith("image/") ? (
              <Image
                source={{ uri: attachment.uri }}
                className="w-full min-h-[180px] max-h-[220px]"
                resizeMode="cover"
                accessibilityLabel="Xem trước ảnh"
              />
            ) : attachment.mimeType.startsWith("video/") ? (
              <AttachmentVideoPreview
                key={attachment.uri}
                uri={attachment.uri}
              />
            ) : (
              <View className="flex-row items-center gap-3 px-4 py-6">
                <FileText size={40} color={primary} strokeWidth={1.5} />
                <View className="flex-1 min-w-0">
                  <Text className="text-foreground text-sm font-semibold" numberOfLines={2}>
                    {attachment.name}
                  </Text>
                  {attachment.size != null && attachment.size > 0 ? (
                    <Text className="text-muted-foreground text-xs mt-1">{formatFileSize(attachment.size)}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
          <View className="flex-row items-center justify-end gap-2 py-2">
            <Pressable
              onPress={() => {
                setAttachment(null);
                setShowMediaMenu(true);
              }}
              className="px-3 py-1.5 rounded-full bg-muted/70 active:opacity-80"
            >
              <Text className="text-foreground text-xs font-medium">Chọn lại</Text>
            </Pressable>
            <Pressable onPress={() => setAttachment(null)} className="px-3 py-1.5 rounded-full active:bg-destructive/15">
              <Text className="text-destructive text-xs font-medium">Xóa</Text>
            </Pressable>
          </View>
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
              className="size-9 rounded-full bg-primary items-center justify-center active:opacity-80"
            >
              <SendHorizontal size={18} color="white" strokeWidth={2.0} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                void Promise.resolve(onSend("👍")).catch(() => {});
              }}
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

/** Preview video trước khi gửi — dùng expo-video thay cho expo-av (deprecated). */
function AttachmentVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: 200 }}
      contentFit="cover"
      nativeControls
      accessibilityLabel="Xem trước video"
    />
  );
}

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
