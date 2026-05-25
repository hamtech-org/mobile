import React from "react";
import { Pressable, Text, View } from "react-native";

export function ActionRow({
  icon,
  label,
  hint,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3.5 rounded-xl py-3 pl-0.5 pr-2 active:bg-muted/50"
    >
      <View
        className={`size-10 items-center justify-center rounded-full ${destructive ? "bg-destructive/10" : "bg-muted/60"}`}
      >
        {icon}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className={`text-[15px] font-semibold ${destructive ? "text-destructive" : "text-foreground"}`}
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
