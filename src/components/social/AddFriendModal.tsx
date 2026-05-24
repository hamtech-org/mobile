import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Keyboard, Modal, Pressable, Text, View } from "react-native";
import { Check, Clock, QrCode, UserCheck, UserPlus, X } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";

import { Avatar } from "@/components/common/Avatar";
import { SearchBar } from "@/components/common/SearchBar";
import { useIconColors } from "@/hooks/useIconColors";
import { useAppSelector } from "@/hooks/useAppStore";
import {
  type ContactSearchUser,
  type FriendshipStatus,
  useAcceptFriendRequestMutation,
  useCancelFriendRequestMutation,
  useRejectFriendRequestMutation,
  useSearchUsersByContactQuery,
  useSendUserFriendRequestMutation,
} from "@/store/api/userApi";
import { toast } from "@/utils/appToast";
import { buildUserQrPayload } from "@/utils/userQrPayload";

type StatusOverride = Partial<Pick<ContactSearchUser, "friendshipStatus" | "isFriend">>;

interface AddFriendModalProps {
  visible: boolean;
  onClose: () => void;
  onChanged?: () => Promise<unknown> | void;
}

function friendName(row: ContactSearchUser): string {
  return String(row.displayName ?? row.userId ?? "").trim();
}

export function AddFriendModal({ visible, onClose, onChanged }: AddFriendModalProps) {
  const { primary, muted } = useIconColors();
  const currentUser = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [myQrOpen, setMyQrOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [statusOverrides, setStatusOverrides] = useState<Record<string, StatusOverride>>({});

  const { data, isFetching } = useSearchUsersByContactQuery(
    { q: debouncedQuery, pageSize: 10 },
    { skip: !visible || !debouncedQuery },
  );

  const [acceptFriend] = useAcceptFriendRequestMutation();
  const [rejectFriend] = useRejectFriendRequestMutation();
  const [cancelRequest] = useCancelFriendRequestMutation();
  const [sendRequest] = useSendUserFriendRequestMutation();

  const myQrValue = useMemo(
    () =>
      currentUser?.userId
        ? buildUserQrPayload({
            userId: currentUser.userId,
            displayName: currentUser.displayName,
            avatar: currentUser.avatar,
          })
        : "",
    [currentUser],
  );

  useEffect(() => {
    const trimmed = query.trim();
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setDebouncedQuery("");
      setMyQrOpen(false);
      setKeyboardHeight(0);
      setStatusOverrides({});
      setBusyIds(new Set());
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const results = useMemo(
    () =>
      (data?.items ?? []).map((user) => ({
        ...user,
        ...statusOverrides[user.userId],
      })),
    [data?.items, statusOverrides],
  );

  const updateStatus = useCallback(
    (userId: string, friendshipStatus: FriendshipStatus, isFriend?: boolean) => {
      setStatusOverrides((prev) => ({
        ...prev,
        [userId]: { friendshipStatus, isFriend },
      }));
    },
    [],
  );

  const runAction = useCallback(
    async (
      userId: string,
      task: () => Promise<unknown>,
      success: string,
      nextStatus: FriendshipStatus,
      isFriend?: boolean,
    ) => {
      setBusyIds((prev) => new Set(prev).add(userId));
      try {
        await task();
        updateStatus(userId, nextStatus, isFriend);
        await onChanged?.();
        toast.success(success);
      } catch {
        toast.error("Không thể thực hiện thao tác");
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    },
    [onChanged, updateStatus],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/45" onPress={onClose}>
        <Pressable
          className="max-h-[88%] rounded-t-3xl bg-background px-4 pb-8 pt-5"
          style={{ marginBottom: keyboardHeight }}
        >
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="size-10 items-center justify-center rounded-2xl bg-primary/10">
                <UserPlus size={20} color={primary} strokeWidth={1.8} />
              </View>
              <View>
                <Text className="text-lg font-bold text-foreground">Thêm bạn bè</Text>
                <Text className="text-xs text-muted-foreground">
                  Tìm bằng email hoặc số điện thoại
                </Text>
              </View>
            </View>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setMyQrOpen((value) => !value)}
                className="size-9 items-center justify-center rounded-full bg-primary/10"
              >
                <QrCode size={18} color={primary} strokeWidth={2} />
              </Pressable>
              <Pressable
                onPress={onClose}
                className="size-9 items-center justify-center rounded-full bg-muted"
              >
                <X size={18} color={muted} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {myQrOpen ? (
            <View className="mb-4 items-center rounded-2xl border border-border bg-muted/30 p-4">
              <Text className="mb-3 text-base font-bold text-foreground">QR của tôi</Text>
              {myQrValue ? (
                <View className="rounded-2xl bg-white p-3">
                  <QRCode value={myQrValue} size={190} />
                </View>
              ) : (
                <ActivityIndicator color={primary} />
              )}
              <Text className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                Đưa mã này cho người khác quét để xem thông tin và gửi lời mời kết bạn.
              </Text>
            </View>
          ) : null}

          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Email hoặc số điện thoại..."
          />

          <View className="mt-4 min-h-[220px]">
            {isFetching ? (
              <View className="items-center justify-center py-10">
                <ActivityIndicator color={primary} />
              </View>
            ) : debouncedQuery && results.length > 0 ? (
              <FlatList
                data={results}
                keyExtractor={(item) => item.userId}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: user }) => {
                  const status = user.friendshipStatus ?? "none";
                  const isBusy = busyIds.has(user.userId);
                  const name = friendName(user) || "Người dùng";

                  return (
                    <View className="flex-row items-center gap-3 rounded-2xl px-1 py-3">
                      <Avatar uri={user.avatar} name={name} />
                      <View className="min-w-0 flex-1">
                        <Text className="font-semibold text-foreground" numberOfLines={1}>
                          {name}
                        </Text>
                        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                          {user.email || user.phone || user.bio || "Không có thông tin liên hệ"}
                        </Text>
                      </View>

                      {status === "friend" ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-green-500/10 px-3 py-2">
                          <UserCheck size={14} color="#22c55e" strokeWidth={2} />
                          <Text className="text-xs font-bold text-green-600">Bạn bè</Text>
                        </View>
                      ) : status === "pending_sent" ? (
                        <Pressable
                          disabled={isBusy}
                          onPress={() =>
                            void runAction(
                              user.userId,
                              () => cancelRequest({ friendId: user.userId }).unwrap(),
                              "Đã hủy lời mời",
                              "none",
                              false,
                            )
                          }
                          className="flex-row items-center gap-1 rounded-full bg-yellow-500/10 px-3 py-2"
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#ca8a04" />
                          ) : (
                            <Clock size={14} color="#ca8a04" strokeWidth={2} />
                          )}
                          <Text className="text-xs font-bold text-yellow-600">Hủy</Text>
                        </Pressable>
                      ) : status === "pending_received" ? (
                        <View className="flex-row gap-1">
                          <Pressable
                            disabled={isBusy}
                            onPress={() =>
                              void runAction(
                                user.userId,
                                () => acceptFriend({ senderId: user.userId }).unwrap(),
                                "Đã chấp nhận lời mời",
                                "friend",
                                true,
                              )
                            }
                            className="size-9 items-center justify-center rounded-full bg-primary/10"
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color={primary} />
                            ) : (
                              <Check size={18} color={primary} strokeWidth={2} />
                            )}
                          </Pressable>
                          <Pressable
                            disabled={isBusy}
                            onPress={() =>
                              void runAction(
                                user.userId,
                                () => rejectFriend({ senderId: user.userId }).unwrap(),
                                "Đã từ chối lời mời",
                                "none",
                                false,
                              )
                            }
                            className="size-9 items-center justify-center rounded-full bg-muted"
                          >
                            <X size={18} color={muted} strokeWidth={2} />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          disabled={isBusy}
                          onPress={() =>
                            void runAction(
                              user.userId,
                              () => sendRequest({ friendId: user.userId }).unwrap(),
                              "Đã gửi lời mời",
                              "pending_sent",
                              false,
                            )
                          }
                          className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-2"
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <UserPlus size={14} color="#fff" strokeWidth={2} />
                          )}
                          <Text className="text-xs font-bold text-primary-foreground">Kết bạn</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                }}
              />
            ) : (
              <View className="items-center justify-center py-10">
                <Text className="text-center text-sm text-muted-foreground">
                  {debouncedQuery
                    ? `Không tìm thấy người dùng với "${debouncedQuery}"`
                    : "Nhập email hoặc số điện thoại để tìm kiếm"}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
