import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useIconColors } from "@/hooks/useIconColors";
import type { ChatMessage } from "@/store/api/chatApi";

interface ChatBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  /** Có phải tin nhắn trong group không — để hiện sender name */
  isGroup?: boolean;
  /** Trạng thái gửi (chỉ cho own message) */
  status?: "sent" | "delivered" | "read";
}

/**
 * Format giờ phút từ ISO string
 */
function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * ChatBubble — hiển thị một tin nhắn trong chat detail.
 * - Tail bubble: border-radius bất đối xứng (góc gần cạnh thiếu)
 * - Own message: bg-primary, right-aligned, message status icon
 * - Other message: bg-card, left-aligned, sender name cho group
 * - Recalled: text italic, muted màu
 */
export const ChatBubble = ({ message, isOwn, isGroup = false, status = "sent" }: ChatBubbleProps) => {
  const isRecalled = Boolean(message.isRecalled);
  const { muted, primary } = useIconColors();

  return (
    <View className={`mb-0.5 ${isOwn ? "items-end" : "items-start"}`}>
      {/* Sender name — chỉ hiện cho group chat + other người */}
      {!isOwn && isGroup && message.senderDisplayName ? (
        <Text className="text-primary text-[11px] font-semibold mb-1 ml-2">{message.senderDisplayName}</Text>
      ) : null}

      {/* Bubble */}
      <View
        className={[
          "max-w-[78%] px-4 py-2.5",
          isOwn
            ? "bg-primary rounded-[20px] rounded-br-[5px]"
            : "bg-card rounded-[20px] rounded-bl-[5px]",
          isRecalled ? "opacity-50" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isRecalled ? (
          /* Tin nhắn đã thu hồi */
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="ban-outline" size={13} color={isOwn ? "rgba(255,255,255,0.6)" : muted} />
            <Text className={`text-sm italic ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>
              Tin nhắn đã được thu hồi
            </Text>
          </View>
        ) : (
          /* Nội dung tin nhắn */
          <Text className={`text-[15px] leading-[22px] ${isOwn ? "text-white" : "text-foreground"}`}>{message.content}</Text>
        )}
      </View>

      {/* Timestamp + Status row */}
      <View className={`flex-row items-center gap-1 mt-0.5 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
        <Text className="text-muted-foreground text-[11px]">{formatTimestamp(message.createdAt)}</Text>

        {/* Status icon — chỉ cho own message */}
        {isOwn && !isRecalled ? (
          <Ionicons
            name={status === "read" ? "checkmark-done" : status === "delivered" ? "checkmark-done-outline" : "checkmark"}
            size={12}
            color={status === "read" ? primary : muted}
          />
        ) : null}
      </View>
    </View>
  );
};
