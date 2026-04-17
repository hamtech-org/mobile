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
          backgroundColor: isDark ? "hsl(224 30% 10%)" : "#ffffff",
          borderTopColor: isDark ? "hsl(224 25% 22%)" : "hsl(220 14% 89%)",
          borderTopWidth: 0.5,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: isDark ? "hsl(214 100% 58%)" : "hsl(214 100% 50%)",
        tabBarInactiveTintColor: isDark ? "hsl(220 15% 45%)" : "hsl(220 10% 60%)",
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
