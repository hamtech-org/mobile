import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Alert } from "react-native";

import { useAppDispatch } from "@/hooks/useAppStore";
import { useSocket } from "@/hooks/useSocket";
import { addInboxNotification, setInboxUnreadCount } from "@/store/slices/inboxNotificationSlice";
import { notificationApi } from "@/store/api/notificationApi";
import { userApi } from "@/store/api/userApi";
import type { INotification } from "@/types/notification.types";
import { showLocalSystemNotification } from "@/utils/localSystemNotification";
import { getNotificationPresentation } from "@/utils/notificationPresentation";

export { navigateFromNotification, openNotificationFromItem } from "@/utils/notificationNavigation";

export function useSocialSocketEvents(): void {
  const socket = useSocket();
  const dispatch = useAppDispatch();
  const [newDeviceOpen, setNewDeviceOpen] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const onNotificationNew = (payload: { notification?: INotification; unreadCount?: number }) => {
      if (payload.notification) {
        dispatch(addInboxNotification(payload.notification));
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
      dispatch(userApi.util.invalidateTags(["Friend"]));
    };

    const onFriendAccepted = () => {
      showLocalSystemNotification({
        title: "Kết bạn",
        body: "Lời mời kết bạn đã được chấp nhận",
        channel: "social",
        notificationId: `social-friend-acc-${Date.now()}`,
        data: { route: "friends", id: "" },
      });
      dispatch(userApi.util.invalidateTags(["Friend"]));
    };

    const onReelNew = () => {
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
      showLocalSystemNotification({
        title: "Live",
        body: title,
        channel: "social",
        notificationId: `social-live-${Date.now()}`,
        data: { route: "live", id: "" },
      });
    };

    const onNewDeviceLogin = (data: { ipAddress?: string }) => {
      if (newDeviceOpen) return;
      setNewDeviceOpen(true);
      Alert.alert(
        "Đăng nhập thiết bị mới",
        data.ipAddress
          ? `Phát hiện đăng nhập từ IP ${data.ipAddress}`
          : "Phát hiện đăng nhập từ thiết bị khác.",
        [{ text: "Đã hiểu", onPress: () => setNewDeviceOpen(false) }],
      );
    };

    socket.on("notification:new", onNotificationNew);
    socket.on("notification:unread_count", onUnreadCount);
    socket.on("friendRequest:new", onFriendRequestNew);
    socket.on("friendRequest:accepted", onFriendAccepted);
    socket.on("newsfeed:reel_new", onReelNew);
    socket.on("live:started", onLiveStarted);
    socket.on("auth:new_device_login", onNewDeviceLogin);

    return () => {
      socket.off("notification:new", onNotificationNew);
      socket.off("notification:unread_count", onUnreadCount);
      socket.off("friendRequest:new", onFriendRequestNew);
      socket.off("friendRequest:accepted", onFriendAccepted);
      socket.off("newsfeed:reel_new", onReelNew);
      socket.off("live:started", onLiveStarted);
      socket.off("auth:new_device_login", onNewDeviceLogin);
    };
  }, [dispatch, newDeviceOpen, socket]);
}
