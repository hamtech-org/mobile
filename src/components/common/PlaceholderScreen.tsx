import { Text, View } from "react-native";

interface PlaceholderScreenProps {
  title: string;
  description: string;
}

export const PlaceholderScreen = ({ title, description }: PlaceholderScreenProps) => {
  return (
    <View className="flex-1 bg-background items-center justify-center px-6">
      <View className="bg-card border border-border rounded-2xl p-6 w-full max-w-md gap-2">
        <Text className="text-foreground text-xl font-bold">{title}</Text>
        <Text className="text-muted-foreground text-sm">{description}</Text>
      </View>
    </View>
  );
};
