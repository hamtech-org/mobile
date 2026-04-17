import { useCallback, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import {
  Copy,
  CornerUpLeft,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";

import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";

interface MessageActionSheetProps {
  /** Tin nhắn đang được chọn (null = ẩn sheet) */
  message: IMessage | null;
  /** Có phải tin nhắn của chính mình không */
  isOwn: boolean;
  /** Callbacks */
  onReply: (msg: IMessage) => void;
  onEdit: (msg: IMessage) => void;
  onRecall: (msg: IMessage) => void;
  onDelete: (msg: IMessage) => void;
  onTogglePin: (msg: IMessage) => void;
  onReact: (msg: IMessage, emoji: string) => void;
  onClose: () => void;
}

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "😡"];

/**
 * MessageActionSheet — Bottom Sheet hiện khi long-press message.
 * - Quick emoji react row
 * - Reply, Copy, Edit (own), Recall (own), Pin/Unpin, Delete
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
}: MessageActionSheetProps) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["35%"], []);
  const { foreground, muted, primary } = useIconColors();

  const handleAction = useCallback(
    (action: (msg: IMessage) => void) => {
      if (!message) return;
      onClose();
      // Delay nhẹ để animation sheet đóng xong
      setTimeout(() => action(message), 150);
    },
    [message, onClose],
  );

  const handleCopy = useCallback(async () => {
    if (!message) return;
    await Clipboard.setStringAsync(message.content ?? "");
    onClose();
  }, [message, onClose]);

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
      <BottomSheetView className="flex-1 bg-card rounded-t-3xl px-4 pb-6">
        {/* Quick emoji react row */}
        <View className="flex-row justify-center gap-3 py-3 border-b border-border/30">
          {QUICK_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => handleEmojiReact(emoji)}
              className="size-11 items-center justify-center rounded-full bg-muted/50 active:bg-muted"
            >
              <Text className="text-[22px]">{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {/* Actions */}
        <View className="mt-2">
          {/* Reply */}
          <ActionItem
            icon={<CornerUpLeft size={20} color={foreground} strokeWidth={1.5} />}
            label="Trả lời"
            onPress={() => handleAction(onReply)}
          />

          {/* Copy */}
          {message.type === "text" && (
            <ActionItem
              icon={<Copy size={20} color={foreground} strokeWidth={1.5} />}
              label="Sao chép"
              onPress={handleCopy}
            />
          )}

          {/* Edit (own only) */}
          {isOwn && message.type === "text" && (
            <ActionItem
              icon={<Pencil size={20} color={foreground} strokeWidth={1.5} />}
              label="Chỉnh sửa"
              onPress={() => handleAction(onEdit)}
            />
          )}

          {/* Pin/Unpin */}
          <ActionItem
            icon={
              message.isPinned ? (
                <PinOff size={20} color={foreground} strokeWidth={1.5} />
              ) : (
                <Pin size={20} color={foreground} strokeWidth={1.5} />
              )
            }
            label={message.isPinned ? "Bỏ ghim" : "Ghim"}
            onPress={() => handleAction(onTogglePin)}
          />

          {/* Recall (own only) */}
          {isOwn && (
            <ActionItem
              icon={<RotateCcw size={20} color={foreground} strokeWidth={1.5} />}
              label="Thu hồi"
              onPress={() => handleAction(onRecall)}
            />
          )}

          {/* Delete */}
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

// ── Action Item ─────────────────────────────────────────────────────────

function ActionItem({
  icon,
  label,
  labelColor,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 px-2 py-3.5 rounded-xl active:bg-muted/50"
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
