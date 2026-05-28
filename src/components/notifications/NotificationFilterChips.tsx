import { Pressable, ScrollView, Text, View } from "react-native";

import type { NotificationFilterChip } from "@/utils/notificationFilters";

const CHIPS: { id: NotificationFilterChip; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "unread", label: "Chưa đọc" },
  { id: "message", label: "Tin nhắn" },
  { id: "direct", label: "1:1" },
  { id: "group", label: "Nhóm" },
  { id: "friend", label: "Kết bạn" },
  { id: "post", label: "Bài viết" },
  { id: "reel", label: "Reels" },
  { id: "live", label: "Live" },
  { id: "community", label: "Cộng đồng" },
];

interface NotificationFilterChipsProps {
  active: NotificationFilterChip;
  onChange: (chip: NotificationFilterChip) => void;
  counts?: Partial<Record<NotificationFilterChip, number>>;
}

export function NotificationFilterChips({
  active,
  onChange,
  counts,
}: NotificationFilterChipsProps) {
  return (
    <View className="border-b border-border py-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
      >
        {CHIPS.map((chip) => {
          const selected = active === chip.id;
          const count = counts?.[chip.id];
          return (
            <Pressable
              key={chip.id}
              onPress={() => onChange(chip.id)}
              className={`rounded-full border px-3 py-1.5 ${
                selected ? "border-primary bg-primary" : "border-border bg-card"
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  selected ? "text-primary-foreground" : "text-foreground"
                }`}
              >
                {chip.label}
                {typeof count === "number" && count > 0 ? ` (${count})` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
