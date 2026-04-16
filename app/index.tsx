import { View, Text } from "react-native";

export default function Index() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <View className="bg-card border border-border rounded-2xl p-6 w-72">
        <Text className="text-foreground text-xl font-bold mb-2">Zalogram</Text>
        <Text className="text-muted-foreground text-sm">NativeWind hoạt động ✓</Text>
        <View className="bg-primary rounded-lg mt-4 p-3">
          <Text className="text-primary-foreground text-center font-medium">Primary button</Text>
        </View>
      </View>
    </View>
  );
}
