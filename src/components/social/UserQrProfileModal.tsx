import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { MessageCircle, UserCheck, UserPlus, X } from "lucide-react-native";
import { router } from "expo-router";

import { Avatar } from "@/components/common/Avatar";
import { useIconColors } from "@/hooks/useIconColors";
import { useAppSelector } from "@/hooks/useAppStore";
import { useCreateConversationMutation, useGetConversationsQuery } from "@/store/api/chatApi";
import {
  type FriendListItem,
  useGetFriendRequestStatusQuery,
  usePostMultipleUsersMutation,
  useSendUserFriendRequestMutation,
} from "@/store/api/userApi";
import type { UserQrPayload } from "@/utils/userQrPayload";
import { toast } from "@/utils/appToast";

type Props = {
  user: UserQrPayload | null;
  visible: boolean;
  onClose: () => void;
};

function displayName(user: UserQrPayload | FriendListItem | null): string {
  return String(user?.displayName ?? user?.userId ?? "Người dùng").trim();
}

export function UserQrProfileModal({ user, visible, onClose }: Props) {
  const { primary, muted } = useIconColors();
  const currentUserId = useAppSelector((state) => state.auth.user?.userId ?? "");
  const [profile, setProfile] = useState<FriendListItem | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [localFriend, setLocalFriend] = useState(false);

  const [fetchUsers] = usePostMultipleUsersMutation();
  const [sendRequest] = useSendUserFriendRequestMutation();
  const [createConversation] = useCreateConversationMutation();
  const { data: conversations, refetch: refetchConversations } = useGetConversationsQuery();
  const { data: friendshipStatus, refetch: refetchStatus } = useGetFriendRequestStatusQuery(
    user?.userId ?? "",
    { skip: !visible || !user?.userId || user.userId === currentUserId },
  );

  useEffect(() => {
    if (!visible || !user?.userId) {
      setProfile(null);
      setLocalFriend(false);
      return;
    }

    let cancelled = false;
    setLoadingProfile(true);
    void fetchUsers({ userIds: [user.userId] })
      .unwrap()
      .then((rows) => {
        if (!cancelled) setProfile(rows[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchUsers, user?.userId, visible]);

  const mergedUser = useMemo(
    () => ({
      userId: user?.userId ?? "",
      displayName: profile?.displayName || user?.displayName || user?.userId || "Người dùng",
      avatar: profile?.avatar ?? user?.avatar ?? null,
      email: profile?.email,
      phone: profile?.phone,
      bio: profile?.bio,
    }),
    [profile, user],
  );

  const status = localFriend ? "friend" : (friendshipStatus ?? "none");
  const isSelf = Boolean(user?.userId && user.userId === currentUserId);

  const handleSendRequest = async () => {
    if (!user?.userId || sendingRequest) return;
    setSendingRequest(true);
    try {
      await sendRequest({ friendId: user.userId }).unwrap();
      toast.success("Đã gửi lời mời kết bạn");
      await refetchStatus();
    } catch {
      toast.error("Không thể gửi lời mời kết bạn");
    } finally {
      setSendingRequest(false);
    }
  };

  const handleOpenChat = async () => {
    if (!user?.userId || openingChat) return;
    setOpeningChat(true);
    try {
      const existing = (conversations ?? []).find(
        (conversation) =>
          conversation.type === "direct" && conversation.otherUserId === user.userId,
      );
      if (existing) {
        onClose();
        router.push(`/(main)/(chat)/${existing.conversationId}`);
        return;
      }

      const created = await createConversation({
        type: "direct",
        memberIds: [user.userId],
      }).unwrap();
      await refetchConversations();
      onClose();
      router.push(`/(main)/(chat)/${created.data.conversationId}`);
    } catch {
      toast.error("Không thể mở cuộc trò chuyện");
    } finally {
      setOpeningChat(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-black/45 px-5" onPress={onClose}>
        <Pressable className="rounded-3xl border border-border bg-card p-5">
          <View className="flex-row justify-end">
            <Pressable
              onPress={onClose}
              className="size-9 items-center justify-center rounded-full bg-muted"
            >
              <X size={18} color={muted} />
            </Pressable>
          </View>

          <View className="items-center">
            <Avatar uri={mergedUser.avatar} name={displayName(mergedUser)} size="xl" />
            <Text className="mt-4 text-xl font-bold text-foreground" numberOfLines={1}>
              {displayName(mergedUser)}
            </Text>
            {loadingProfile ? (
              <ActivityIndicator className="mt-3" color={primary} />
            ) : (
              <Text className="mt-2 text-center text-sm text-muted-foreground" numberOfLines={2}>
                {mergedUser.email ||
                  mergedUser.phone ||
                  mergedUser.bio ||
                  "Thông tin từ mã QR HamTech"}
              </Text>
            )}
          </View>

          <View className="mt-6 flex-row gap-3">
            {isSelf ? (
              <View className="flex-1 items-center rounded-xl bg-muted px-4 py-3">
                <Text className="font-semibold text-foreground">Đây là QR của bạn</Text>
              </View>
            ) : status === "friend" ? (
              <>
                <View className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-green-500/10 px-4 py-3">
                  <UserCheck size={18} color="#22c55e" />
                  <Text className="font-semibold text-green-600">Đã là bạn bè</Text>
                </View>
                <Pressable
                  onPress={handleOpenChat}
                  disabled={openingChat}
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 active:opacity-80 disabled:opacity-60"
                >
                  {openingChat ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <MessageCircle size={18} color="#fff" />
                  )}
                  <Text className="font-semibold text-primary-foreground">Nhắn tin</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleSendRequest}
                disabled={
                  sendingRequest || status === "pending_sent" || status === "pending_received"
                }
                className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 active:opacity-80 disabled:opacity-60"
              >
                {sendingRequest ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <UserPlus size={18} color="#fff" />
                )}
                <Text className="font-semibold text-primary-foreground">
                  {status === "pending_sent"
                    ? "Đã gửi lời mời"
                    : status === "pending_received"
                      ? "Đã nhận lời mời"
                      : "Kết bạn"}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
