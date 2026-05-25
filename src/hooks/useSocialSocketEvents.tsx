import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAppDispatch } from "@/hooks/useAppStore";
import { useSocket } from "@/hooks/useSocket";
import { addInboxNotification, setInboxUnreadCount } from "@/store/slices/inboxNotificationSlice";
import { friendStatusChanged } from "@/store/slices/chatSlice";
import { chatApi } from "@/store/api/baseChatApi";
import { notificationApi } from "@/store/api/notificationApi";
import { userApi } from "@/store/api/userApi";
import type { INotification } from "@/types/notification.types";
import { toast } from "@/utils/appToast";
import { showLocalSystemNotification } from "@/utils/localSystemNotification";
import { getNotificationPresentation } from "@/utils/notificationPresentation";

export { navigateFromNotification, openNotificationFromItem } from "@/utils/notificationNavigation";

export function useSocialSocketEvents(): ReactNode {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const [newDeviceOpen, setNewDeviceOpen] = useState(false);
  const [newDeviceIp, setNewDeviceIp] = useState<string | undefined>();
  const newDeviceOpenRef = useRef(false);

  const closeNewDeviceModal = () => {
    newDeviceOpenRef.current = false;
    setNewDeviceOpen(false);
  };

  const openProfileTab = () => {
    closeNewDeviceModal();
    router.push("/(main)/(profile)");
  };

  useEffect(() => {
    if (!socket) return;

    const invalidateFriends = () => {
      dispatch(userApi.util.invalidateTags(["Friend"]));
    };

    const invalidateFriendsAndConversations = () => {
      dispatch(userApi.util.invalidateTags(["Friend"]));
      dispatch(chatApi.util.invalidateTags(["Conversations"]));
    };

    const onNotificationNew = (payload: { notification?: INotification; unreadCount?: number }) => {
      if (payload.notification) {
        dispatch(addInboxNotification(payload.notification));

        // Show in-app Toast
        toast.info(`${payload.notification.title}: ${payload.notification.body}`, 5000);

        // Show System Local Push Notification
        const presentation = getNotificationPresentation(payload.notification);
        showLocalSystemNotification({
          title: presentation.title,
          body: presentation.body,
          channel: payload.notification.data.route === "chat" ? "messages" : "social",
          notificationId: `social-${payload.notification.notificationId || Date.now()}`,
          avatarUrl: presentation.avatar,
          data: payload.notification.data,
        });
      }
      if (typeof payload.unreadCount === "number") {
        dispatch(setInboxUnreadCount(payload.unreadCount));
      }
      dispatch(notificationApi.util.invalidateTags(["Notifications"]));
    };

    const onUnreadCount = (payload: { unreadCount?: number }) => {
      if (typeof payload.unreadCount === "number") {
        dispatch(setInboxUnreadCount(payload.unreadCount));
      }
    };

    const onFriendRequestNew = (data: {
      senderId?: string;
      senderName?: string;
      senderAvatar?: string | null;
    }) => {
      const name = data.senderName?.trim() || "Ai đó";

      // Show in-app Toast
      toast.info(`${name} đã gửi lời mời kết bạn`);

      // Show System Local Push Notification
      showLocalSystemNotification({
        title: name,
        body: "đã gửi lời mời kết bạn",
        channel: "social",
        notificationId: `social-friend-req-${data.senderId || Date.now()}`,
        avatarUrl: data.senderAvatar,
        data: {
          route: "friends",
          id: String(data.senderId ?? ""),
          actorId: data.senderId,
          actorName: name,
          actorAvatar: data.senderAvatar ?? null,
        },
      });

      invalidateFriendsAndConversations();
    };

    const onFriendAccepted = (data?: {
      senderId?: string;
      senderName?: string;
      senderAvatar?: string | null;
    }) => {
      const name = data?.senderName?.trim() || "Bạn bè";

      // Show in-app Toast
      toast.success("Lời mời kết bạn đã được chấp nhận");

      // Show System Local Push Notification
      showLocalSystemNotification({
        title: "Kết bạn",
        body: `${name} đã chấp nhận lời mời kết bạn`,
        channel: "social",
        notificationId: `social-friend-acc-${Date.now()}`,
        avatarUrl: data?.senderAvatar,
        data: { route: "friends", id: "" },
      });

      invalidateFriendsAndConversations();
    };

    const onFriendStatusChanged = (data: { userId?: string; status?: string }) => {
      const userId = String(data.userId ?? "").trim();
      const status = String(data.status ?? "").trim();
      if (!userId || !status) return;
      dispatch(friendStatusChanged({ userId, status }));
      dispatch(userApi.util.invalidateTags(["Friend"]));
    };

    const onReelNew = () => {
      // Show in-app Toast
      toast.info("Có reel mới từ người bạn theo dõi", 4000);

      // Show System Local Push Notification
      showLocalSystemNotification({
        title: "HamTech",
        body: "Có reel mới từ người bạn theo dõi",
        channel: "social",
        notificationId: `social-reel-${Date.now()}`,
        data: { route: "reel", id: "" },
      });
    };

    const onLiveStarted = (data: { title?: string }) => {
      const title = data.title?.trim() || "Bạn bè đang phát live";

      // Show in-app Toast
      toast.info(`Live: ${title}`, 4000);

      // Show System Local Push Notification
      showLocalSystemNotification({
        title: "Live",
        body: title,
        channel: "social",
        notificationId: `social-live-${Date.now()}`,
        data: { route: "live", id: "" },
      });
    };

    const onNewDeviceLogin = (data: { ipAddress?: string }) => {
      if (newDeviceOpenRef.current) return;
      newDeviceOpenRef.current = true;
      setNewDeviceIp(data.ipAddress);
      setNewDeviceOpen(true);
    };

    socket.on("notification:new", onNotificationNew);
    socket.on("notification:unread_count", onUnreadCount);
    socket.on("friendRequest:new", onFriendRequestNew);
    socket.on("friendRequest:accepted", onFriendAccepted);
    socket.on("friendRequest:rejected", invalidateFriends);
    socket.on("friendRequest:sent", invalidateFriends);
    socket.on("friend:added", invalidateFriendsAndConversations);
    socket.on("friend:removed", invalidateFriends);
    socket.on("friend:statusChanged", onFriendStatusChanged);
    socket.on("newsfeed:reel_new", onReelNew);
    socket.on("live:started", onLiveStarted);
    socket.on("auth:new_device_login", onNewDeviceLogin);

    return () => {
      socket.off("notification:new", onNotificationNew);
      socket.off("notification:unread_count", onUnreadCount);
      socket.off("friendRequest:new", onFriendRequestNew);
      socket.off("friendRequest:accepted", onFriendAccepted);
      socket.off("friendRequest:rejected", invalidateFriends);
      socket.off("friendRequest:sent", invalidateFriends);
      socket.off("friend:added", invalidateFriendsAndConversations);
      socket.off("friend:removed", invalidateFriends);
      socket.off("friend:statusChanged", onFriendStatusChanged);
      socket.off("newsfeed:reel_new", onReelNew);
      socket.off("live:started", onLiveStarted);
      socket.off("auth:new_device_login", onNewDeviceLogin);
    };
  }, [dispatch, socket]);

  return (
    <Modal
      visible={newDeviceOpen}
      transparent
      animationType="fade"
      onRequestClose={closeNewDeviceModal}
    >
      <View className="flex-1 justify-center bg-black/50 px-5">
        <View className="rounded-2xl border border-border bg-card p-5">
          <View className="flex-row items-start gap-4">
            <View className="size-12 items-center justify-center rounded-full bg-primary/10">
              <Ionicons name="phone-portrait-outline" size={24} color="hsl(var(--primary) / 1)" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-bold text-foreground">Đăng nhập thiết bị mới</Text>
              <Text className="mt-2 text-sm leading-5 text-muted-foreground">
                {newDeviceIp
                  ? `Phát hiện đăng nhập từ IP ${newDeviceIp}.`
                  : "Phát hiện đăng nhập từ thiết bị khác."}
              </Text>
              <Text className="mt-2 text-xs leading-5 text-muted-foreground">
                Bạn có thể kiểm tra danh sách thiết bị đăng nhập trong tab Tôi.
              </Text>
            </View>
          </View>

          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={closeNewDeviceModal}
              className="flex-1 items-center rounded-xl bg-muted px-4 py-3 active:opacity-80"
            >
              <Text className="font-semibold text-foreground">Đã hiểu</Text>
            </Pressable>
            <Pressable
              onPress={openProfileTab}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 active:opacity-80"
            >
              <Ionicons name="person-outline" size={17} color="#fff" />
              <Text className="font-semibold text-primary-foreground">Quản lý thiết bị</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
