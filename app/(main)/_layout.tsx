import { Tabs } from "expo-router";
import { useEffect, useMemo } from "react";
import { useColorScheme, View } from "react-native";

import { requestNotificationPermissionAsync } from "@/utils/notificationPermission";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MessageCircleMore,
  Newspaper,
  PlayCircle,
  User,
  Users,
  Radio,
  CircleDot,
} from "lucide-react-native";

import { ChatSocketBootstrap } from "@/components/chat/ChatSocketBootstrap";
import { SocialSocketBootstrap } from "@/components/notifications/SocialSocketBootstrap";
import { ReelUploadBanner } from "@/features/reels/components/ReelUploadBanner";
import { useGetConversationsQuery } from "@/store/api/chatApi";
import { useGetNotificationsQuery } from "@/store/api/notificationApi";
import { useAppDispatch } from "@/hooks/useAppStore";
import { setInboxNotifications, setInboxUnreadCount } from "@/store/slices/inboxNotificationSlice";
import { formatUnreadBadge } from "@/utils/chatBadge";

interface TabConfig {
  name: string;
  title: string;
  Icon: any;
}

const TABS: TabConfig[] = [
  { name: "(chat)", title: "Tin nhắn", Icon: MessageCircleMore },
  { name: "(contacts)", title: "Danh bạ", Icon: Users },
  { name: "(newsfeed)", title: "Bảng tin", Icon: Newspaper },
  { name: "(communities)", title: "Cộng đồng", Icon: CircleDot },
  { name: "(live)", title: "Live", Icon: Radio },
  { name: "(reels)", title: "Reels", Icon: PlayCircle },
  { name: "(profile)", title: "Tôi", Icon: User },
];

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { data: conversations } = useGetConversationsQuery();
  const { data: notifData } = useGetNotificationsQuery({ limit: 50 });

  const chatTabBadge = useMemo(() => {
    const total = (conversations ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    return formatUnreadBadge(total);
  }, [conversations]);

  useEffect(() => {
    if (notifData?.items) {
      dispatch(setInboxNotifications(notifData.items));
      dispatch(setInboxUnreadCount(notifData.unreadCount));
    }
  }, [dispatch, notifData]);

  useEffect(() => {
    void requestNotificationPermissionAsync();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <ChatSocketBootstrap />
      <SocialSocketBootstrap />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: isDark ? "hsl(224 30% 10%)" : "#ffffff",
            borderTopColor: isDark ? "hsl(224 25% 22%)" : "hsl(220 14% 89%)",
            borderTopWidth: 0.5,
            height: 52 + Math.max(insets.bottom, 8),
            paddingBottom: Math.max(insets.bottom, 8),
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
              tabBarBadge: tab.name === "(chat)" && chatTabBadge ? chatTabBadge : undefined,
              tabBarIcon: ({ focused, color, size }) => (
                <tab.Icon size={size - 2} color={color} strokeWidth={focused ? 2.2 : 1.5} />
              ),
            }}
          />
        ))}
        <Tabs.Screen name="(notifications)" options={{ href: null }} />
        <Tabs.Screen name="ai-assistant" options={{ href: null }} />
      </Tabs>
      <ReelUploadBanner />
    </View>
  );
}
