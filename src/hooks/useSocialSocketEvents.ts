import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { Alert } from "react-native";

import { useAppDispatch } from "@/hooks/useAppStore";
import { useSocket } from "@/hooks/useSocket";
import { addInboxNotification, setInboxUnreadCount } from "@/store/slices/inboxNotificationSlice";
import { notificationApi } from "@/store/api/notificationApi";
import { userApi } from "@/store/api/userApi";
import type { INotification } from "@/types/notification.types";
import { toast } from "@/utils/appToast";

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
      dispatch(userApi.util.invalidateTags(["Friend"]));
    };

    const onFriendAccepted = () => {
      toast.success("Lời mời kết bạn đã được chấp nhận");
      dispatch(userApi.util.invalidateTags(["Friend"]));
    };

    const onReelNew = () => {
      toast.info("Có reel mới từ người bạn theo dõi", 4000);
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
    socket.on("auth:new_device_login", onNewDeviceLogin);

    return () => {
      socket.off("notification:new", onNotificationNew);
      socket.off("notification:unread_count", onUnreadCount);
      socket.off("friendRequest:new", onFriendRequestNew);
      socket.off("friendRequest:accepted", onFriendAccepted);
      socket.off("newsfeed:reel_new", onReelNew);
      socket.off("auth:new_device_login", onNewDeviceLogin);
    };
  }, [dispatch, newDeviceOpen, socket]);
}
