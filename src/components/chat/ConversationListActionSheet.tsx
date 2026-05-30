import { useCallback, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ban, Bell, BellOff, Pin, PinOff, Trash2 } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";

type ConversationListActionSheetProps = {
  conversation: IConversation | null;
  onClose: () => void;
  onTogglePin: (c: IConversation) => void;
  onOpenMutePicker: (c: IConversation) => void;
  onUnmute: (c: IConversation) => void;
  onBlockFriend?: (c: IConversation) => void;
  onUnblockFriend?: (c: IConversation) => void;
  isBlocked?: boolean;
  onDeleteConversation?: (c: IConversation) => void;
};

/**
 * Bottom sheet khi nhấn giữ một hội thoại trên danh sách tin nhắn
 * (thay cho Alert.alert — bố cục rõ, đồng bộ với MessageActionSheet).
 */
export function ConversationListActionSheet({
  conversation,
  onClose,
  onTogglePin,
  onOpenMutePicker,
  onUnmute,
  onBlockFriend,
  onUnblockFriend,
  isBlocked = false,
  onDeleteConversation,
}: ConversationListActionSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["52%"], []);
  const { foreground, muted } = useIconColors();

  const pinned = conversation?.isPinnedToTop ?? false;
  const isMuted = conversation?.isMuted ?? false;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [],
  );

  const deferAfterClose = useCallback(
    (fn: () => void) => {
      onClose();
      setTimeout(fn, 160);
    },
    [onClose],
  );

  if (!conversation) return null;

  const c = conversation;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "transparent" }}
      handleIndicatorStyle={{ backgroundColor: muted, width: 44 }}
    >
      <BottomSheetView className="flex-1 rounded-t-3xl bg-card px-4 pb-8 pt-1">
        <View className="border-b border-border/40 pb-3">
          <Text className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hội thoại
          </Text>
          <Text className="mt-2 text-lg font-bold leading-tight text-foreground" numberOfLines={2}>
            {c.name?.trim() || "Hội thoại"}
          </Text>
        </View>

        <View className="mt-1">
          <ActionRow
            icon={
              pinned ? (
                <PinOff size={22} color={foreground} strokeWidth={1.5} />
              ) : (
                <Pin size={22} color={foreground} strokeWidth={1.5} />
              )
            }
            label={pinned ? "Bỏ ghim" : "Ghim lên đầu"}
            hint={pinned ? "Gỡ khỏi mục Ghim" : "Đưa lên đầu danh sách"}
            onPress={() => deferAfterClose(() => onTogglePin(c))}
          />

          {isMuted ? (
            <ActionRow
              icon={<Bell size={22} color={foreground} strokeWidth={1.5} />}
              label="Bật thông báo"
              hint="Nhận lại tin nhắn và thông báo"
              onPress={() => deferAfterClose(() => onUnmute(c))}
            />
          ) : (
            <ActionRow
              icon={<BellOff size={22} color={foreground} strokeWidth={1.5} />}
              label="Tắt thông báo"
              hint="Chọn thời gian hoặc tắt hẳn"
              onPress={() => deferAfterClose(() => onOpenMutePicker(c))}
            />
          )}

          {c.type !== "group" && (onBlockFriend || onUnblockFriend) ? (
            <ActionRow
              icon={<Ban size={22} color={isBlocked ? "#059669" : "#ef4444"} strokeWidth={1.75} />}
              label={isBlocked ? "Bỏ chặn bạn bè" : "Chặn bạn bè"}
              hint={
                isBlocked
                  ? "Cho phép nhận tin và gọi lại"
                  : "Giữ lịch sử, chặn nhận tin và cuộc gọi 1-1"
              }
              danger={!isBlocked}
              success={isBlocked}
              onPress={() =>
                deferAfterClose(() => {
                  if (isBlocked) onUnblockFriend?.(c);
                  else onBlockFriend?.(c);
                })
              }
            />
          ) : null}

          {onDeleteConversation && (
            <ActionRow
              icon={<Trash2 size={22} color="#ef4444" strokeWidth={1.5} />}
              label={c.type === "direct" ? "Xóa cuộc hội thoại" : "Xóa lịch sử trò chuyện"}
              hint={
                c.type === "direct"
                  ? "Xóa tin nhắn phía bạn và ẩn khỏi danh sách"
                  : "Xóa tin nhắn phía bạn và giữ lại nhóm"
              }
              danger
              onPress={() =>
                deferAfterClose(() => {
                  onDeleteConversation(c);
                })
              }
            />
          )}
        </View>

        <Pressable
          onPress={onClose}
          className="mt-3 items-center rounded-xl border border-border/60 py-3.5 active:bg-muted/40"
        >
          <Text className="text-[15px] font-semibold text-muted-foreground">Đóng</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onPress,
  danger,
  success,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onPress: () => void;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-xl py-3.5 pl-0.5 pr-2 active:bg-muted/50"
    >
      <View className="size-10 items-center justify-center rounded-full bg-muted/60">{icon}</View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${
            danger ? "text-red-500" : success ? "text-emerald-600" : "text-foreground"
          }`}
        >
          {label}
        </Text>
        <Text className="mt-0.5 text-[12px] leading-snug text-muted-foreground" numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}
