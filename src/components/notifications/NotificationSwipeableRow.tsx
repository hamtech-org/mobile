import { Pressable, Text, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { Check, EyeOff } from "lucide-react-native";

import type { INotification } from "@/types/notification.types";
import { getNotificationActor, getNotificationFallbackInitial } from "@/utils/notificationActor";

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Vừa xong";
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} giờ`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

interface NotificationSwipeableRowProps {
  item: INotification;
  onPress: () => void;
  onMarkRead: () => void;
  onHide: () => void;
}

export function NotificationSwipeableRow({
  item,
  onPress,
  onMarkRead,
  onHide,
}: NotificationSwipeableRowProps) {
  const actor = getNotificationActor(item);

  const renderRightActions = () => (
    <View className="mb-2 flex-row">
      {!item.isRead ? (
        <Pressable
          onPress={onMarkRead}
          className="justify-center bg-emerald-600 px-4"
          accessibilityLabel="Đánh dấu đã đọc"
        >
          <Check size={20} color="#fff" />
          <Text className="mt-1 text-[10px] font-medium text-white">Đã đọc</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onHide}
        className="justify-center rounded-r-xl bg-slate-500 px-4"
        accessibilityLabel="Ẩn thông báo"
      >
        <EyeOff size={20} color="#fff" />
        <Text className="mt-1 text-[10px] font-medium text-white">Ẩn</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={onPress}
        className={`mb-2 flex-row gap-3 rounded-xl border p-3 ${
          item.isRead ? "border-border bg-card" : "border-primary/30 bg-primary/10"
        }`}
      >
        <View className="size-11 items-center justify-center overflow-hidden rounded-full bg-muted">
          {actor.avatar ? (
            <Image source={{ uri: actor.avatar }} className="size-11" contentFit="cover" />
          ) : (
            <Text className="text-sm font-bold text-foreground">
              {getNotificationFallbackInitial(item)}
            </Text>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start gap-2">
            <Text
              className={`flex-1 text-sm leading-snug ${
                item.isRead ? "font-medium text-foreground" : "font-semibold text-foreground"
              }`}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {!item.isRead ? (
              <View className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />
            ) : null}
          </View>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={2}>
            {item.body}
          </Text>
          <Text className="mt-1 text-[11px] text-muted-foreground">
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}
