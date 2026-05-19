import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import {
  Copy,
  CornerUpLeft,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Maximize2,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";

import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import {
  chatImageDisplayUrl,
  chatMediaDownloadFilename,
  chatMediaDownloadUrl,
} from "@/utils/chatMediaDisplay";
import {
  copyChatImageToClipboard,
  downloadChatFileToDevice,
  openOrShareChatFile,
  saveChatMediaToLibrary,
} from "@/utils/chatMediaDownload";
import { toast } from "@/utils/appToast";
import { canPinMessage, QUICK_REACT_EMOJIS } from "@/utils/chatMessageActions";

interface MessageActionSheetProps {
  message: IMessage | null;
  isOwn: boolean;
  onReply: (msg: IMessage) => void;
  onEdit: (msg: IMessage) => void;
  onRecall: (msg: IMessage) => void;
  onDelete: (msg: IMessage) => void;
  onTogglePin: (msg: IMessage) => void;
  onReact: (msg: IMessage, emoji: string) => void;
  onClose: () => void;
  onMediaSaved?: (messageId: string) => void;
  /** Xem ảnh/video toàn màn hình sau khi đóng sheet. */
  onPreviewMedia?: (msg: IMessage) => void;
  /** Mở file (PDF, …) sau khi đóng sheet. */
  onOpenFile?: (msg: IMessage) => void;
}

function isMediaActionMessage(msg: IMessage | null): msg is IMessage {
  return (
    !!msg &&
    (msg.type === "image" ||
      msg.type === "sticker" ||
      msg.type === "video" ||
      msg.type === "file") &&
    Boolean(msg.mediaUrl)
  );
}

function isImageCopyMessage(msg: IMessage): boolean {
  return msg.type === "image" || msg.type === "sticker";
}

function hasCopyableCaption(msg: IMessage): boolean {
  return Boolean((msg.content ?? "").trim());
}

/**
 * Bottom sheet khi giữ tin — dùng chung cho chữ, ảnh, video, file (giống ảnh mẫu).
 */
export const MessageActionSheet = ({
  message,
  isOwn,
  onReply,
  onEdit,
  onRecall,
  onDelete,
  onTogglePin,
  onReact,
  onClose,
  onMediaSaved,
  onPreviewMedia,
  onOpenFile,
}: MessageActionSheetProps) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const isMediaMessage = isMediaActionMessage(message);
  const snapPoints = useMemo(() => [isMediaMessage ? "58%" : "44%"], [isMediaMessage]);
  const { foreground, muted } = useIconColors();

  const handleAction = useCallback(
    (action: (msg: IMessage) => void) => {
      if (!message) return;
      onClose();
      setTimeout(() => action(message), 150);
    },
    [message, onClose],
  );

  const handleCopy = useCallback(async () => {
    if (!message) return;
    await Clipboard.setStringAsync(message.content ?? "");
    onClose();
    toast.success("Đã sao chép");
  }, [message, onClose]);

  const handleShareMedia = useCallback(async () => {
    if (!message) return;
    onClose();
    const downloadUrl = chatMediaDownloadUrl(message);
    if (!downloadUrl) {
      toast.error("Không có file để chia sẻ.");
      return;
    }

    try {
      const ok = await openOrShareChatFile(
        downloadUrl,
        chatMediaDownloadFilename(
          message,
          message.type === "video" ? "video" : message.type === "file" ? "file" : "media",
        ),
        message.mediaType,
      );
      toast[ok ? "success" : "error"](
        ok ? "Đã mở bảng chia sẻ" : "Không chia sẻ được. Thử lại sau.",
      );
    } catch {
      toast.error("Không chia sẻ được. Thử lại sau.");
    }
  }, [message, onClose]);

  const handleCopyImage = useCallback(async () => {
    if (!message || !isImageCopyMessage(message)) return;
    onClose();
    const downloadUrl = chatImageDisplayUrl(message) || chatMediaDownloadUrl(message);
    if (!downloadUrl) {
      toast.error("Không có hình ảnh để copy.");
      return;
    }

    const ok = await copyChatImageToClipboard(
      downloadUrl,
      chatMediaDownloadFilename(message, message.type === "sticker" ? "sticker" : "image"),
    );
    toast[ok ? "success" : "error"](ok ? "Đã copy hình ảnh" : "Không copy được hình ảnh.");
  }, [message, onClose]);

  const handleSaveMedia = useCallback(async () => {
    if (!message) return;
    const messageId = message.messageId;
    onClose();
    const downloadUrl = chatMediaDownloadUrl(message);
    if (!downloadUrl) {
      toast.error("Không có file để lưu.");
      return;
    }

    try {
      if (message.type === "image" || message.type === "sticker") {
        const ok = await saveChatMediaToLibrary(
          downloadUrl,
          chatMediaDownloadFilename(message, message.type === "sticker" ? "sticker" : "image"),
          "image",
        );
        if (ok) onMediaSaved?.(messageId);
        toast[ok ? "success" : "error"](ok ? "Đã lưu ảnh" : "Không lưu được ảnh.");
        return;
      }
      if (message.type === "video") {
        const ok = await saveChatMediaToLibrary(
          downloadUrl,
          chatMediaDownloadFilename(message, "video"),
          "video",
        );
        if (ok) onMediaSaved?.(messageId);
        toast[ok ? "success" : "error"](ok ? "Đã lưu video" : "Không lưu được video.");
        return;
      }
      if (message.type === "file") {
        const ok = await downloadChatFileToDevice(
          downloadUrl,
          chatMediaDownloadFilename(message, "file"),
          message.mediaType,
        );
        if (ok) onMediaSaved?.(messageId);
        toast[ok ? "success" : "error"](ok ? "Đã lưu file vào Tài liệu." : "Không tải được file.");
      }
    } catch {
      toast.error("Không lưu được. Thử lại sau.");
    }
  }, [message, onClose, onMediaSaved]);

  const handleEmojiReact = useCallback(
    (emoji: string) => {
      if (!message) return;
      onClose();
      setTimeout(() => onReact(message, emoji), 150);
    },
    [message, onClose, onReact],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  if (!message) return null;

  const showCopy = message.type === "text" || (isMediaMessage && hasCopyableCaption(message));
  const showEdit = isOwn && message.type === "text";

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "transparent" }}
      handleIndicatorStyle={{ backgroundColor: muted, width: 40 }}
    >
      <BottomSheetView className="flex-1 rounded-t-3xl bg-card px-4 pb-8">
        <View className="flex-row justify-center gap-3 border-b border-border/30 py-3">
          {QUICK_REACT_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleEmojiReact(emoji)}
              className="size-11 items-center justify-center rounded-full bg-muted/50 active:bg-muted"
            >
              <Text className="text-[22px]">{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mt-1">
          <ActionItem
            icon={<CornerUpLeft size={20} color={foreground} strokeWidth={1.5} />}
            label="Trả lời"
            onPress={() => handleAction(onReply)}
          />

          {showCopy ? (
            <ActionItem
              icon={<Copy size={20} color={foreground} strokeWidth={1.5} />}
              label="Sao chép"
              onPress={() => void handleCopy()}
            />
          ) : null}

          {showEdit ? (
            <ActionItem
              icon={<Pencil size={20} color={foreground} strokeWidth={1.5} />}
              label="Chỉnh sửa"
              onPress={() => handleAction(onEdit)}
            />
          ) : null}

          {isMediaMessage &&
          message &&
          (message.type === "image" || message.type === "sticker" || message.type === "video") &&
          onPreviewMedia ? (
            <ActionItem
              icon={
                message.type === "video" ? (
                  <Maximize2 size={20} color={foreground} strokeWidth={1.5} />
                ) : (
                  <ImageIcon size={20} color={foreground} strokeWidth={1.5} />
                )
              }
              label={message.type === "video" ? "Xem video toàn màn hình" : "Xem ảnh lớn"}
              onPress={() => handleAction(onPreviewMedia)}
            />
          ) : null}

          {isMediaMessage && message?.type === "file" && onOpenFile ? (
            <ActionItem
              icon={<ExternalLink size={20} color={foreground} strokeWidth={1.5} />}
              label="Mở file"
              onPress={() => handleAction(onOpenFile)}
            />
          ) : null}

          {isMediaMessage ? (
            <ActionItem
              icon={<Share2 size={20} color={foreground} strokeWidth={1.5} />}
              label="Chia sẻ"
              onPress={() => void handleShareMedia()}
            />
          ) : null}

          {isMediaMessage && isImageCopyMessage(message) ? (
            <ActionItem
              icon={<ImageIcon size={20} color={foreground} strokeWidth={1.5} />}
              label="Copy hình ảnh"
              onPress={() => void handleCopyImage()}
            />
          ) : null}

          {isMediaMessage ? (
            <ActionItem
              icon={<Download size={20} color={foreground} strokeWidth={1.5} />}
              label="Lưu về máy"
              onPress={() => void handleSaveMedia()}
            />
          ) : null}

          {canPinMessage(message) ? (
            <ActionItem
              icon={
                message.isPinned ? (
                  <PinOff size={20} color={foreground} strokeWidth={1.5} />
                ) : (
                  <Pin size={20} color={foreground} strokeWidth={1.5} />
                )
              }
              label={message.isPinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
              onPress={() => handleAction(onTogglePin)}
            />
          ) : null}

          {isOwn ? (
            <ActionItem
              icon={<RotateCcw size={20} color={foreground} strokeWidth={1.5} />}
              label="Thu hồi"
              onPress={() => handleAction(onRecall)}
            />
          ) : null}

          <ActionItem
            icon={<Trash2 size={20} color="#ef4444" strokeWidth={1.5} />}
            label="Xóa"
            labelColor="#ef4444"
            onPress={() => handleAction(onDelete)}
          />
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

function ActionItem({
  icon,
  label,
  labelColor,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  labelColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-xl px-2 py-3.5 active:bg-muted/50"
    >
      {icon}
      <Text
        className="text-[15px] font-medium"
        style={labelColor ? { color: labelColor } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}
