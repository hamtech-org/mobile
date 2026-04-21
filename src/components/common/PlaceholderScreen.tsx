import { Text, View } from "react-native";

interface PlaceholderScreenProps {
  title: string;
  description: string;
}

export const PlaceholderScreen = ({ title, description }: PlaceholderScreenProps) => {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-md gap-2 rounded-2xl border border-border bg-card p-6">
        <Text className="text-xl font-bold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground">{description}</Text>
      </View>
    </View>
  );
};
