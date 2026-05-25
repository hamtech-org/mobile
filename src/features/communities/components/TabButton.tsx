import { Pressable, Text } from "react-native";

export function TabButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-full py-2.5 transition-all active:scale-95 ${
        active ? "bg-background shadow-sm" : "bg-transparent"
      }`}
    >
      <Text
        className={`text-center text-[13px] font-bold ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
