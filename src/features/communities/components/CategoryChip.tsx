import { Pressable, Text } from "react-native";
import { type CommunityCategory } from "@/types/community.types";
import { CATEGORY_LABEL } from "../constants";

export function CategoryChip({
  category,
  active,
  onPress,
}: {
  category: CommunityCategory | "all";
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 active:opacity-80 ${
        active ? "border-primary bg-primary" : "border-border bg-card"
      }`}
    >
      <Text
        className={
          active ? "font-semibold text-primary-foreground" : "font-semibold text-foreground"
        }
      >
        {category === "all" ? "Tất cả" : CATEGORY_LABEL[category] || category}
      </Text>
    </Pressable>
  );
}
