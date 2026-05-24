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
        toast.info(`${payload.notification.title}: ${payload.notification.body}`, 5000);
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

    const onFriendRequestNew = (data: { senderId?: string; senderName?: string }) => {
      toast.info(`${data.senderName ?? "Ai đó"} đã gửi lời mời kết bạn`);
      invalidateFriendsAndConversations();
    };

    const onFriendAccepted = () => {
      toast.success("Lời mời kết bạn đã được chấp nhận");
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
      toast.info("Có reel mới từ người bạn theo dõi", 4000);
    };

    const onLiveStarted = (data: { title?: string }) => {
      const label = data.title?.trim() ? `Live: ${data.title}` : "Bạn bè đang phát live";
      toast.info(label, 4000);
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
