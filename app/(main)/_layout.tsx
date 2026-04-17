import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface TabConfig {
  name: string;
  title: string;
  icon: IconName;
  activeIcon: IconName;
}

const TABS: TabConfig[] = [
  { name: "(chat)", title: "Tin nhắn", icon: "chatbubble-outline", activeIcon: "chatbubble" },
  { name: "(contacts)", title: "Danh bạ", icon: "people-outline", activeIcon: "people" },
  { name: "(newsfeed)", title: "Bảng tin", icon: "newspaper-outline", activeIcon: "newspaper" },
  { name: "(profile)", title: "Tôi", icon: "person-circle-outline", activeIcon: "person-circle" },
];

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: isDark ? "#1a1f2e" : "#ffffff",
          borderTopColor: isDark ? "#2a3040" : "#e5e7eb",
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: isDark ? "#60a5fa" : "#2563eb",
        tabBarInactiveTintColor: isDark ? "#6b7280" : "#9ca3af",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? tab.activeIcon : tab.icon} size={size} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
