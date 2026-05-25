import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PlaceholderScreenProps {
  title: string;
  description: string;
}

export const PlaceholderScreen = ({ title, description }: PlaceholderScreenProps) => {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-background px-6" edges={["top"]}>
      <View className="w-full max-w-md gap-2 rounded-2xl border border-border bg-card p-6">
        <Text className="text-xl font-bold text-foreground">{title}</Text>
        <Text className="text-sm text-muted-foreground">{description}</Text>
      </View>
    </SafeAreaView>
  );
};
