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
import { isSocketLocalNotificationEnabled } from "@/utils/localSystemNotification";
import { showLocalSystemNotification } from "@/utils/localSystemNotification";
import { getNotificationPresentation } from "@/utils/notificationPresentation";
import { categoryForNotificationKind } from "@/utils/notificationCategoryActions";
import { getNotificationSpec, inboxTypeToNotificationKind } from "@/utils/notificationRegistry";

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
    router.replace("/(main)/(profile)");
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
        if (isSocketLocalNotificationEnabled()) {
          const presentation = getNotificationPresentation(payload.notification);
          const kind = inboxTypeToNotificationKind(
            payload.notification.type,
            payload.notification.data?.route,
          );
          const spec = getNotificationSpec(kind);
          showLocalSystemNotification({
            title: presentation.title,
            body: presentation.body,
            channel: spec.channel,
            categoryIdentifier: categoryForNotificationKind(kind),
            notificationId: `social-${payload.notification.notificationId || Date.now()}`,
            avatarUrl: presentation.avatar,
            data: {
              ...payload.notification.data,
              notificationKind: kind,
            },
          });
        }
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
      if (isSocketLocalNotificationEnabled()) {
        const name = data.senderName?.trim() || "Ai đó";
        const kind = "friend_request" as const;
        showLocalSystemNotification({
          title: name,
          body: "đã gửi lời mời kết bạn",
          channel: getNotificationSpec(kind).channel,
          categoryIdentifier: categoryForNotificationKind(kind),
          notificationId: `social-friend-req-${data.senderId || Date.now()}`,
          avatarUrl: data.senderAvatar,
          data: {
            route: "friends",
            id: String(data.senderId ?? ""),
            actorId: data.senderId,
            actorName: name,
            notificationKind: kind,
          },
        });
      }
      invalidateFriendsAndConversations();
    };

    const onFriendAccepted = () => {
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
      if (isSocketLocalNotificationEnabled()) {
        const kind = "reel_new" as const;
        showLocalSystemNotification({
          title: "HamTech",
          body: "Có reel mới từ người bạn theo dõi",
          channel: getNotificationSpec(kind).channel,
          categoryIdentifier: categoryForNotificationKind(kind),
          notificationId: `social-reel-${Date.now()}`,
          data: { route: "reel", id: "", notificationKind: kind },
        });
      }
    };

    const onLiveStarted = (data: { title?: string }) => {
      if (isSocketLocalNotificationEnabled()) {
        const title = data.title?.trim() || "Bạn bè đang phát live";
        const kind = "live_started" as const;
        showLocalSystemNotification({
          title: "Live",
          body: title,
          channel: getNotificationSpec(kind).channel,
          categoryIdentifier: categoryForNotificationKind(kind),
          notificationId: `social-live-${Date.now()}`,
          data: { route: "live", id: "", notificationKind: kind },
        });
      }
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
    socket.on("friend:statusChanged", onFriendStatusChanged);
    socket.on("reel:new", onReelNew);
    socket.on("live:started", onLiveStarted);
    socket.on("auth:new_device_login", onNewDeviceLogin);

    return () => {
      socket.off("notification:new", onNotificationNew);
      socket.off("notification:unread_count", onUnreadCount);
      socket.off("friendRequest:new", onFriendRequestNew);
      socket.off("friendRequest:accepted", onFriendAccepted);
      socket.off("friendRequest:rejected", invalidateFriends);
      socket.off("friendRequest:sent", invalidateFriends);
      socket.off("friend:statusChanged", onFriendStatusChanged);
      socket.off("reel:new", onReelNew);
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
      <Pressable
        className="flex-1 items-center justify-center bg-black/50 px-6"
        onPress={closeNewDeviceModal}
      >
        <Pressable
          className="w-full max-w-sm rounded-2xl bg-background p-5"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="mb-3 flex-row items-center gap-2">
            <Ionicons name="shield-checkmark-outline" size={22} color="#0068FF" />
            <Text className="text-lg font-semibold text-foreground">Đăng nhập thiết bị mới</Text>
          </View>
          <Text className="text-sm leading-5 text-muted-foreground">
            Tài khoản vừa đăng nhập từ thiết bị hoặc trình duyệt khác
            {newDeviceIp ? ` (IP: ${newDeviceIp})` : ""}.
          </Text>
          <View className="mt-4 flex-row gap-2">
            <Pressable
              className="flex-1 items-center rounded-xl bg-muted px-4 py-3 active:opacity-80"
              onPress={closeNewDeviceModal}
            >
              <Text className="font-medium text-foreground">Đóng</Text>
            </Pressable>
            <Pressable
              className="flex-1 items-center rounded-xl bg-primary px-4 py-3 active:opacity-80"
              onPress={openProfileTab}
            >
              <Text className="font-medium text-primary-foreground">Xem bảo mật</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
