import { useEffect, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useAppDispatch } from "@/hooks/useAppStore";
import { useIconColors } from "@/hooks/useIconColors";
import { clearChatFrameBanner, type ChatFrameBanner as ChatFrameBannerData } from "@/store/slices/chatSlice";
import { formatConversationListActivityTime, formatTimestamp } from "@/utils/time";

interface ChatFrameBannerProps {
  banner: ChatFrameBannerData;
}

/**
 * Thông báo ngắn trong khung chat — giờ/cập nhật ở trên, nội dung bên dưới; có thể đóng.
 */
export function ChatFrameBanner({ banner }: ChatFrameBannerProps): ReactElement {
  const dispatch = useAppDispatch();
  const { muted } = useIconColors();
  const calendarNow = useCalendarNow();

  const timeLabel =
    formatConversationListActivityTime(banner.atIso, calendarNow) ||
    formatTimestamp(banner.atIso) ||
    "";

  useEffect(() => {
    const t = setTimeout(() => dispatch(clearChatFrameBanner()), 8000);
    return () => clearTimeout(t);
  }, [banner.atIso, banner.message, dispatch]);

  return (
    <View className="mx-3 mb-1.5 flex-row items-start gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {timeLabel ? `Cập nhật · ${timeLabel}` : "Cập nhật"}
        </Text>
        <Text className="mt-1 text-[13px] font-semibold leading-snug text-foreground" numberOfLines={4}>
          {banner.message}
        </Text>
      </View>
      <Pressable
        onPress={() => dispatch(clearChatFrameBanner())}
        hitSlop={10}
        className="rounded-full p-0.5 active:bg-primary/15"
        accessibilityLabel="Đóng thông báo"
      >
        <X size={18} color={muted} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
