import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const iconName =
            route.name === "(chat)"
              ? "chatbubble-outline"
              : route.name === "(contacts)"
                ? "people-outline"
                : route.name === "(newsfeed)"
                  ? "newspaper-outline"
                  : "person-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="(chat)" options={{ title: "Chat" }} />
      <Tabs.Screen name="(contacts)" options={{ title: "Contacts" }} />
      <Tabs.Screen name="(newsfeed)" options={{ title: "Feed" }} />
      <Tabs.Screen name="(profile)" options={{ title: "Profile" }} />
    </Tabs>
  );
}
