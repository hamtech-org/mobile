import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Check,
  Clock,
  MessageCircle,
  Search,
  Send,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { EmptyState } from "@/components/common/EmptyState";
import { Loading } from "@/components/common/Loading";
import { SearchBar } from "@/components/common/SearchBar";
import { NotificationBellButton } from "@/components/notifications/NotificationBellButton";
import { useIconColors } from "@/hooks/useIconColors";
import { useCreateConversationMutation, useGetConversationsQuery } from "@/store/api/chatApi";
import {
  type ContactSearchUser,
  type FriendshipStatus,
  type FriendListItem,
  useAcceptFriendRequestMutation,
  useCancelFriendRequestMutation,
  useGetFriendsQuery,
  useGetPendingRequestsQuery,
  useGetSuggestedFriendsQuery,
  useRejectFriendRequestMutation,
  useRemoveFriendMutation,
  useSearchUsersByContactQuery,
  useSendUserFriendRequestMutation,
} from "@/store/api/userApi";
import type { IConversation } from "@/types/chat.types";
import { toast } from "@/utils/appToast";

type ContactTab = "friends" | "groups" | "requests";
type RequestTab = "received" | "sent" | "suggestions";
type StatusOverride = Partial<Pick<ContactSearchUser, "friendshipStatus" | "isFriend">>;

type Row =
  | { kind: "header"; key: string; title: string }
  | { kind: "friend"; key: string; friend: FriendListItem }
  | { kind: "group"; key: string; group: IConversation }
  | { kind: "request"; key: string; request: FriendListItem; mode: RequestTab };

const TABS: { id: ContactTab; label: string; Icon: typeof Users }[] = [
  { id: "friends", label: "Bạn bè", Icon: Users },
  { id: "groups", label: "Nhóm", Icon: Users },
  { id: "requests", label: "Lời mời", Icon: UserPlus },
];

const REQUEST_TABS: { id: RequestTab; label: string }[] = [
  { id: "received", label: "Nhận được" },
  { id: "sent", label: "Đã gửi" },
  { id: "suggestions", label: "Gợi ý" },
];

function friendName(row: FriendListItem): string {
  return String(row.displayName ?? row.userId ?? "").trim();
}

function normalizeStatus(status?: string | null) {
  return status === "online" ? "Đang hoạt động" : "Ngoại tuyến";
}

function matchesFriend(row: FriendListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.displayName, row.email, row.phone, row.userId]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

function matchesGroup(row: IConversation, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.conversationId]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

function groupFriendsByLetter(friends: FriendListItem[]): Row[] {
  const sorted = [...friends].sort((a, b) =>
    friendName(a).localeCompare(friendName(b), "vi", { sensitivity: "base" }),
  );
  const rows: Row[] = [];
  let current = "";
  for (const friend of sorted) {
    const first = friendName(friend).charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : "#";
    if (letter !== current) {
      current = letter;
      rows.push({ kind: "header", key: `h:${letter}`, title: letter });
    }
    rows.push({ kind: "friend", key: `f:${friend.userId}`, friend });
  }
  return rows;
}

export default function ContactsScreen() {
  const { primary, muted } = useIconColors();
  const [tab, setTab] = useState<ContactTab>("friends");
  const [requestTab, setRequestTab] = useState<RequestTab>("received");
  const [query, setQuery] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<FriendListItem | null>(null);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [addFriendQuery, setAddFriendQuery] = useState("");
  const [debouncedAddFriendQuery, setDebouncedAddFriendQuery] = useState("");
  const [searchStatusOverrides, setSearchStatusOverrides] = useState<
    Record<string, StatusOverride>
  >({});
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: friends = [],
    isLoading: friendsLoading,
    refetch: refetchFriends,
  } = useGetFriendsQuery();
  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    refetch: refetchConversations,
  } = useGetConversationsQuery();
  const {
    data: pending = { received: [], sent: [] },
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = useGetPendingRequestsQuery();
  const {
    data: suggested = [],
    isLoading: suggestedLoading,
    refetch: refetchSuggested,
  } = useGetSuggestedFriendsQuery({
    limit: 20,
  });
  const { data: contactSearch, isFetching: addFriendSearching } = useSearchUsersByContactQuery(
    { q: debouncedAddFriendQuery, pageSize: 10 },
    { skip: !debouncedAddFriendQuery },
  );

  const [createConversation] = useCreateConversationMutation();
  const [acceptFriend] = useAcceptFriendRequestMutation();
  const [rejectFriend] = useRejectFriendRequestMutation();
  const [cancelRequest] = useCancelFriendRequestMutation();
  const [sendRequest] = useSendUserFriendRequestMutation();
  const [removeFriend] = useRemoveFriendMutation();

  useEffect(() => {
    const trimmed = addFriendQuery.trim();
    const timer = setTimeout(() => {
      setDebouncedAddFriendQuery(trimmed);
    }, 300);
    return () => clearTimeout(timer);
  }, [addFriendQuery]);

  const groups = useMemo(
    () => conversations.filter((c) => c.type === "group" && !c.isDeleted),
    [conversations],
  );

  const addFriendResults = useMemo(
    () =>
      (contactSearch?.items ?? []).map((user) => ({
        ...user,
        ...searchStatusOverrides[user.userId],
      })),
    [contactSearch?.items, searchStatusOverrides],
  );

  const refetchAll = useCallback(async () => {
    await Promise.all([
      refetchFriends(),
      refetchConversations(),
      refetchPending(),
      refetchSuggested(),
    ]);
  }, [refetchConversations, refetchFriends, refetchPending, refetchSuggested]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [refetchAll]);

  const openFriendChat = useCallback(
    async (friend: FriendListItem) => {
      const existing = conversations.find(
        (c) => c.type === "direct" && c.otherUserId === friend.userId,
      );
      if (existing) {
        router.push(`/(main)/(chat)/${existing.conversationId}`);
        return;
      }
      try {
        const res = await createConversation({
          type: "direct",
          memberIds: [friend.userId],
        }).unwrap();
        router.push(`/(main)/(chat)/${res.data.conversationId}`);
      } catch {
        toast.error("Không thể mở cuộc trò chuyện");
      }
    },
    [conversations, createConversation],
  );

  const runFriendAction = useCallback(
    async (
      id: string,
      task: () => Promise<unknown>,
      success: string,
      afterSuccess?: () => void,
    ) => {
      setBusyIds((prev) => new Set(prev).add(id));
      try {
        await task();
        afterSuccess?.();
        await refetchAll();
        toast.success(success);
      } catch {
        toast.error("Không thể thực hiện thao tác");
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [refetchAll],
  );

  const updateSearchStatus = useCallback(
    (userId: string, friendshipStatus: FriendshipStatus, isFriend?: boolean) => {
      setSearchStatusOverrides((prev) => ({
        ...prev,
        [userId]: { friendshipStatus, isFriend },
      }));
    },
    [],
  );

  const closeAddFriend = useCallback(() => {
    setAddFriendOpen(false);
    setAddFriendQuery("");
    setDebouncedAddFriendQuery("");
    setSearchStatusOverrides({});
  }, []);

  const confirmRemoveFriend = useCallback(
    (friend: FriendListItem) => {
      Alert.alert("Xóa kết bạn", `Xóa ${friendName(friend) || "người này"} khỏi danh bạ?`, [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () =>
            void runFriendAction(
              friend.userId,
              () => removeFriend({ friendId: friend.userId }).unwrap(),
              "Đã xóa kết bạn",
            ),
        },
      ]);
    },
    [removeFriend, runFriendAction],
  );

  const rows = useMemo((): Row[] => {
    if (tab === "friends") {
      return groupFriendsByLetter(friends.filter((f) => matchesFriend(f, query)));
    }
    if (tab === "groups") {
      return groups
        .filter((g) => matchesGroup(g, query))
        .map((g) => ({ kind: "group" as const, key: `g:${g.conversationId}`, group: g }));
    }
    const source =
      requestTab === "received"
        ? pending.received
        : requestTab === "sent"
          ? pending.sent
          : suggested;
    return source
      .filter((f) => matchesFriend(f, query))
      .map((f) => ({
        kind: "request" as const,
        key: `${requestTab}:${f.userId}`,
        request: f,
        mode: requestTab,
      }));
  }, [friends, groups, pending.received, pending.sent, query, requestTab, suggested, tab]);

  const loading =
    (tab === "friends" && friendsLoading) ||
    (tab === "groups" && conversationsLoading) ||
    (tab === "requests" && (pendingLoading || suggestedLoading));

  const pendingCount = pending.received.length + pending.sent.length + suggested.length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <Text className="text-2xl font-bold text-foreground">Danh bạ</Text>
        <View className="flex-row items-center gap-1">
          <Pressable
            onPress={() => setAddFriendOpen(true)}
            className="size-10 items-center justify-center rounded-full bg-muted active:bg-muted/70"
          >
            <UserPlus size={19} color={muted} strokeWidth={1.8} />
          </Pressable>
          <NotificationBellButton />
        </View>
      </View>

      <View className="px-4 pb-3">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Tìm bạn bè, nhóm" />
      </View>

      <View className="flex-row gap-2 px-4 pb-3">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          const count =
            id === "friends" ? friends.length : id === "groups" ? groups.length : pendingCount;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              className={`min-w-0 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-2 py-2 ${
                active ? "bg-primary" : "bg-muted"
              }`}
            >
              <Icon size={15} color={active ? "#fff" : muted} strokeWidth={1.8} />
              <Text
                className={`text-xs font-semibold ${active ? "text-primary-foreground" : "text-foreground"}`}
                numberOfLines={1}
              >
                {label}
              </Text>
              <Text
                className={`text-[10px] font-bold ${active ? "text-primary-foreground/90" : "text-muted-foreground"}`}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "requests" ? (
        <View className="flex-row gap-2 px-4 pb-3">
          {REQUEST_TABS.map((item) => {
            const active = requestTab === item.id;
            const count =
              item.id === "received"
                ? pending.received.length
                : item.id === "sent"
                  ? pending.sent.length
                  : suggested.length;
            return (
              <Pressable
                key={item.id}
                onPress={() => setRequestTab(item.id)}
                className={`flex-1 rounded-lg px-2 py-2 ${active ? "bg-primary/15" : "bg-muted/60"}`}
              >
                <Text
                  className={`text-center text-xs font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
                  numberOfLines={1}
                >
                  {item.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {loading ? (
        <Loading fullScreen={false} message="Đang tải danh bạ..." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          refreshing={refreshing}
          onRefresh={() => {
            void handleRefresh();
          }}
          contentContainerStyle={{ flexGrow: rows.length === 0 ? 1 : undefined, paddingBottom: 20 }}
          ListEmptyComponent={
            <EmptyState
              icon={tab === "groups" ? Users : tab === "requests" ? UserPlus : Search}
              title={
                query.trim()
                  ? "Không tìm thấy kết quả"
                  : tab === "groups"
                    ? "Chưa có nhóm"
                    : tab === "requests"
                      ? "Không có mục nào"
                      : "Chưa có bạn bè"
              }
              description={
                tab === "friends"
                  ? "Bạn bè đã kết nối sẽ xuất hiện tại đây."
                  : tab === "groups"
                    ? "Các nhóm chat của bạn sẽ hiển thị tại đây."
                    : "Lời mời và gợi ý kết bạn sẽ xuất hiện tại đây."
              }
            />
          }
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <View className="px-4 pb-1 pt-3">
                  <Text className="text-xs font-bold text-muted-foreground">{item.title}</Text>
                </View>
              );
            }

            if (item.kind === "group") {
              const group = item.group;
              return (
                <Pressable
                  onPress={() => router.push(`/(main)/(chat)/${group.conversationId}`)}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-muted/60"
                >
                  <Avatar uri={group.avatar} name={group.name ?? undefined} isGroup />
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-foreground" numberOfLines={1}>
                      {group.name || "Nhóm chat"}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {group.memberCount ?? 0} thành viên
                    </Text>
                  </View>
                  <MessageCircle size={20} color={primary} strokeWidth={1.8} />
                </Pressable>
              );
            }

            const friend = item.kind === "friend" ? item.friend : item.request;
            const name = friendName(friend) || "Người dùng";
            const isBusy = busyIds.has(friend.userId);

            return (
              <Pressable
                onPress={() => (item.kind === "friend" ? setSelectedFriend(friend) : undefined)}
                className="flex-row items-center gap-3 px-4 py-3 active:bg-muted/60"
              >
                <Avatar
                  uri={friend.avatar}
                  name={name}
                  showOnlineDot={friend.status === "online"}
                />
                <View className="min-w-0 flex-1">
                  <Text className="font-semibold text-foreground" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {friend.email || friend.phone || friend.bio || normalizeStatus(friend.status)}
                  </Text>
                </View>

                {item.kind === "friend" ? (
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() => void openFriendChat(friend)}
                      className="size-9 items-center justify-center rounded-full bg-primary/10"
                    >
                      <MessageCircle size={18} color={primary} strokeWidth={1.8} />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemoveFriend(friend)}
                      className="size-9 items-center justify-center rounded-full bg-red-500/10"
                    >
                      <UserMinus size={17} color="#ef4444" strokeWidth={1.8} />
                    </Pressable>
                  </View>
                ) : item.mode === "received" ? (
                  <View className="flex-row gap-1">
                    <Pressable
                      disabled={isBusy}
                      onPress={() =>
                        void runFriendAction(
                          friend.userId,
                          () => acceptFriend({ senderId: friend.userId }).unwrap(),
                          "Đã chấp nhận lời mời",
                        )
                      }
                      className="size-9 items-center justify-center rounded-full bg-primary/10"
                    >
                      <Check size={18} color={primary} strokeWidth={2} />
                    </Pressable>
                    <Pressable
                      disabled={isBusy}
                      onPress={() =>
                        void runFriendAction(
                          friend.userId,
                          () => rejectFriend({ senderId: friend.userId }).unwrap(),
                          "Đã từ chối lời mời",
                        )
                      }
                      className="size-9 items-center justify-center rounded-full bg-red-500/10"
                    >
                      <X size={18} color="#ef4444" strokeWidth={2} />
                    </Pressable>
                  </View>
                ) : item.mode === "sent" ? (
                  <Pressable
                    disabled={isBusy}
                    onPress={() =>
                      void runFriendAction(
                        friend.userId,
                        () => cancelRequest({ friendId: friend.userId }).unwrap(),
                        "Đã hủy lời mời",
                      )
                    }
                    className="rounded-full bg-muted px-3 py-2"
                  >
                    <Text className="text-xs font-semibold text-foreground">Hủy</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    disabled={isBusy}
                    onPress={() =>
                      void runFriendAction(
                        friend.userId,
                        () => sendRequest({ friendId: friend.userId }).unwrap(),
                        "Đã gửi lời mời",
                      )
                    }
                    className="size-9 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Send size={17} color={primary} strokeWidth={1.8} />
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}

      <Modal
        visible={addFriendOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAddFriend}
      >
        <Pressable className="flex-1 justify-end bg-black/45" onPress={closeAddFriend}>
          <Pressable className="max-h-[88%] rounded-t-3xl bg-background px-4 pb-8 pt-5">
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
              <Pressable
                onPress={closeAddFriend}
                className="size-9 items-center justify-center rounded-full bg-muted"
              >
                <X size={18} color={muted} strokeWidth={2} />
              </Pressable>
            </View>

            <SearchBar
              value={addFriendQuery}
              onChangeText={setAddFriendQuery}
              placeholder="Email hoặc số điện thoại..."
              autoFocus
            />

            <View className="mt-4 min-h-[220px]">
              {addFriendSearching ? (
                <View className="items-center justify-center py-10">
                  <ActivityIndicator color={primary} />
                </View>
              ) : debouncedAddFriendQuery && addFriendResults.length > 0 ? (
                <FlatList
                  data={addFriendResults}
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
                              void runFriendAction(
                                user.userId,
                                () => cancelRequest({ friendId: user.userId }).unwrap(),
                                "Đã hủy lời mời",
                                () => updateSearchStatus(user.userId, "none", false),
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
                                void runFriendAction(
                                  user.userId,
                                  () => acceptFriend({ senderId: user.userId }).unwrap(),
                                  "Đã chấp nhận lời mời",
                                  () => updateSearchStatus(user.userId, "friend", true),
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
                                void runFriendAction(
                                  user.userId,
                                  () => rejectFriend({ senderId: user.userId }).unwrap(),
                                  "Đã từ chối lời mời",
                                  () => updateSearchStatus(user.userId, "none", false),
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
                              void runFriendAction(
                                user.userId,
                                () => sendRequest({ friendId: user.userId }).unwrap(),
                                "Đã gửi lời mời",
                                () => updateSearchStatus(user.userId, "pending_sent", false),
                              )
                            }
                            className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-2"
                          >
                            {isBusy ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <UserPlus size={14} color="#fff" strokeWidth={2} />
                            )}
                            <Text className="text-xs font-bold text-primary-foreground">
                              Kết bạn
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  }}
                />
              ) : (
                <View className="items-center justify-center py-10">
                  <Text className="text-center text-sm text-muted-foreground">
                    {debouncedAddFriendQuery
                      ? `Không tìm thấy người dùng với "${debouncedAddFriendQuery}"`
                      : "Nhập email hoặc số điện thoại để tìm kiếm"}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={selectedFriend !== null} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-end bg-black/45"
          onPress={() => setSelectedFriend(null)}
        >
          {selectedFriend ? (
            <Pressable className="rounded-t-3xl bg-background px-6 pb-8 pt-6">
              <View className="items-center gap-3">
                <Avatar uri={selectedFriend.avatar} name={friendName(selectedFriend)} size="xl" />
                <View className="items-center gap-1">
                  <Text className="text-2xl font-bold text-foreground">
                    {friendName(selectedFriend)}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {normalizeStatus(selectedFriend.status)}
                  </Text>
                </View>
              </View>

              <View className="mt-6 gap-3">
                {selectedFriend.email ? (
                  <View className="rounded-2xl bg-muted p-4">
                    <Text className="text-xs font-semibold uppercase text-muted-foreground">
                      Email
                    </Text>
                    <Text className="mt-1 font-semibold text-foreground">
                      {selectedFriend.email}
                    </Text>
                  </View>
                ) : null}
                {selectedFriend.phone ? (
                  <View className="rounded-2xl bg-muted p-4">
                    <Text className="text-xs font-semibold uppercase text-muted-foreground">
                      Điện thoại
                    </Text>
                    <Text className="mt-1 font-semibold text-foreground">
                      {selectedFriend.phone}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Pressable
                onPress={() => {
                  const friend = selectedFriend;
                  setSelectedFriend(null);
                  void openFriendChat(friend);
                }}
                className="mt-6 flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3"
              >
                <MessageCircle size={18} color="#fff" />
                <Text className="font-bold text-primary-foreground">Nhắn tin</Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
