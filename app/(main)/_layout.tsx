// Fragment import removed — replaced by View wrapper
import { Tabs } from "expo-router";
import { useColorScheme, View } from "react-native";
import { MessageCircleMore, Newspaper, PlayCircle, User, Users } from "lucide-react-native";

import { ChatSocketBootstrap } from "@/components/chat/ChatSocketBootstrap";
import { ReelUploadBanner } from "@/features/reels/components/ReelUploadBanner";

interface TabConfig {
  name: string;
  title: string;
  Icon: any;
}

const TABS: TabConfig[] = [
  { name: "(chat)", title: "Tin nhắn", Icon: MessageCircleMore },
  { name: "(contacts)", title: "Danh bạ", Icon: Users },
  { name: "(newsfeed)", title: "Bảng tin", Icon: Newspaper },
  { name: "(reels)", title: "Reels", Icon: PlayCircle },
  { name: "(profile)", title: "Tôi", Icon: User },
];

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <View style={{ flex: 1 }}>
      <ChatSocketBootstrap />
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
                <tab.Icon size={size - 2} color={color} strokeWidth={focused ? 2.2 : 1.5} />
              ),
            }}
          />
        ))}
      </Tabs>
      <ReelUploadBanner />
    </View>
  );
}
