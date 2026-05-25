import React from "react";
import { Text, View } from "react-native";

export function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1">
      <View className="flex-row items-center gap-2">
        <View className="size-8 items-center justify-center rounded-lg bg-primary/10">{icon}</View>
        <Text className="text-sm text-muted-foreground">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
