import { Tabs } from "expo-router";
import { useColorScheme } from "react-native";
import { MessageSquare, Newspaper, User, Users } from "lucide-react-native";

interface TabConfig {
  name: string;
  title: string;
  Icon: any;
}

const TABS: TabConfig[] = [
  { name: "(chat)", title: "Tin nhắn", Icon: MessageSquare },
  { name: "(contacts)", title: "Danh bạ", Icon: Users },
  { name: "(newsfeed)", title: "Bảng tin", Icon: Newspaper },
  { name: "(profile)", title: "Tôi", Icon: User },
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
            tabBarIcon: ({ focused, color, size }) => (
              <tab.Icon 
                size={size - 2} 
                color={color} 
                strokeWidth={focused ? 2.2 : 1.5} 
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
