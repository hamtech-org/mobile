import { useMemo, useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CloudOff,
  MessageCircle,
  MessageSquare,
  Pin,
  QrCode,
  Search,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react-native";

import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchBar } from "@/components/common/SearchBar";
import { ConversationItem } from "@/components/chat/ConversationItem";
import {
  ConversationListActionSheet,
  CreateGroupModal,
  MutedConversationsFooter,
  MuteNotificationsModal,
} from "@/components/chat";
import { GroupJoinQrScannerModal } from "@/components/chat/GroupJoinQrScannerModal";
import { AddFriendModal } from "@/components/social/AddFriendModal";
import { UserQrProfileModal } from "@/components/social/UserQrProfileModal";
import { useGroupJoinLinkModal } from "@/contexts/GroupJoinLinkModalContext";
import { getJoinGroupUrl } from "@/utils/joinGroupUrl";
import type { UserQrPayload } from "@/utils/userQrPayload";
import {
  useGetConversationsQuery,
  usePatchConversationPreferencesMutation,
} from "@/store/api/chatApi";
import {
  useBlockFriendMutation,
  useGetFriendRequestStatusQuery,
  useUnblockFriendMutation,
} from "@/store/api/userApi";
import { useAppSelector } from "@/hooks/useAppStore";
import { useActiveChatRouteConversationId } from "@/hooks/useActiveChatRouteConversationId";
import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import { toast } from "@/utils/appToast";
import {
  buildPatchForMutePayload,
  describeMuteSuccess,
  type MuteNotificationsApplyPayload,
} from "@/utils/muteNotifications";
import { MAX_PINNED_CHATS_TO_TOP } from "@/constants/chatPin";
import { formatConversationListLastPreview } from "@/utils/conversationListPreview";
import { sortConversationsForSidebar } from "@/utils/conversationListSort";
import { useDueTaskNotifications } from "@/hooks/useDueTaskNotifications";

type ChatListRow =
  | {
      kind: "header";
      key: string;
      title: string;
      count?: number;
      variant: "pinned" | "chats";
    }
  | { kind: "conversation"; key: string; conversation: IConversation };

export default function ChatListScreen() {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId ?? "");
  const activeOpenConversationId = useActiveChatRouteConversationId();
  const { data, isLoading, isError, refetch, isFetching } = useGetConversationsQuery();
  const [patchPrefs] = usePatchConversationPreferencesMutation();
  const [blockFriend] = useBlockFriendMutation();
  const [unblockFriend] = useUnblockFriendMutation();
  const [searchText, setSearchText] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scannedUserQr, setScannedUserQr] = useState<UserQrPayload | null>(null);
  const { openGroupJoinLinkModal } = useGroupJoinLinkModal();
  const [muteTarget, setMuteTarget] = useState<IConversation | null>(null);
  const [muteSubmitting, setMuteSubmitting] = useState(false);
  const [mutedExpanded, setMutedExpanded] = useState(false);
  const [quickMenuConversation, setQuickMenuConversation] = useState<IConversation | null>(null);
  const quickMenuOtherUserId =
    quickMenuConversation?.type === "direct" ? quickMenuConversation.otherUserId?.trim() : "";
  const { data: quickMenuFriendshipStatus } = useGetFriendRequestStatusQuery(
    quickMenuOtherUserId ?? "",
    {
      skip: !quickMenuOtherUserId,
    },
  );
  const { primary, muted: iconMuted } = useIconColors();

  useDueTaskNotifications({
    conversations: data ?? [],
    currentUserId,
  });

  const handleRetryFetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleQuickMenuTogglePin = useCallback(
    (item: IConversation) => {
      const pinned = item.isPinnedToTop ?? false;
      if (!pinned) {
        const list = data ?? [];
        const pinnedCount = list.filter((c) => c.isPinnedToTop).length;
        if (!item.isPinnedToTop && pinnedCount >= MAX_PINNED_CHATS_TO_TOP) {
          toast.error(
            `Chỉ ghim được tối đa ${MAX_PINNED_CHATS_TO_TOP} hội thoại lên đầu danh sách.`,
          );
          return;
        }
      }
      void patchPrefs({ conversationId: item.conversationId, isPinnedToTop: !pinned })
        .unwrap()
        .then(() => toast.success(pinned ? "Đã bỏ ghim hội thoại" : "Đã ghim hội thoại"))
        .catch((e: unknown) => {
          const msg =
            (e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? "";
          if (msg.includes("Chỉ ghim được tối đa")) {
            toast.error(msg);
          } else {
            toast.error("Không cập nhật được ghim hội thoại");
          }
        });
    },
    [data, patchPrefs],
  );

  const handleQuickMenuUnmute = useCallback(
    (item: IConversation) => {
      void patchPrefs({
        conversationId: item.conversationId,
        isMuted: false,
        notificationsMutedUntil: null,
      })
        .unwrap()
        .then(() => toast.success("Đã bật thông báo"))
        .catch(() => toast.error("Không cập nhật được thông báo"));
    },
    [patchPrefs],
  );

  const handleQuickMenuBlockFriend = useCallback(
    (item: IConversation) => {
      const friendId = item.otherUserId?.trim();
      if (!friendId) {
        toast.error("Không xác định được người cần chặn");
        return;
      }

      Alert.alert(
        "Chặn bạn bè?",
        `Lịch sử hội thoại sẽ được giữ nguyên, nhưng hai bên sẽ không thể nhận tin hoặc gọi 1-1 với ${item.name ?? "người này"}.`,
        [
          { text: "Không", style: "cancel" },
          {
            text: "Chặn",
            style: "destructive",
            onPress: () => {
              void blockFriend({ friendId })
                .unwrap()
                .then(async () => {
                  toast.success("Đã chặn người dùng");
                  await refetch();
                })
                .catch(() => toast.error("Không thể chặn người dùng"));
            },
          },
        ],
      );
    },
    [blockFriend, refetch],
  );

  const handleQuickMenuUnblockFriend = useCallback(
    (item: IConversation) => {
      const friendId = item.otherUserId?.trim();
      if (!friendId) {
        toast.error("Không xác định được người cần bỏ chặn");
        return;
      }

      void unblockFriend({ friendId })
        .unwrap()
        .then(async () => {
          toast.success("Đã bỏ chặn người dùng");
          await refetch();
        })
        .catch(() => toast.error("Không thể bỏ chặn người dùng"));
    },
    [refetch, unblockFriend],
  );

  const openConversationQuickMenu = useCallback((item: IConversation) => {
    setQuickMenuConversation(item);
  }, []);

  const handleQrScannedSuffix = useCallback(
    (suffix: string) => {
      setQrScannerOpen(false);
      openGroupJoinLinkModal({
        suffix,
        url: getJoinGroupUrl(suffix),
        groupName: "Nhóm chat",
      });
    },
    [openGroupJoinLinkModal],
  );

  const handleQrScannedUser = useCallback((user: UserQrPayload) => {
    setQrScannerOpen(false);
    setScannedUserQr(user);
  }, []);

  const { listRows, mutedConversations, mutedUnreadTotal, listableCount, searchOnlyInMuted } =
    useMemo(() => {
      const raw = data ?? [];
      const listable = raw.filter((c) => !(c.type === "group" && c.isDeleted));
      const q = searchText.trim().toLowerCase();

      /** Cùng quy tắc web `sidebarBaseConversations`: lọc rồi sort. */
      const sidebarBase = !q
        ? sortConversationsForSidebar(listable)
        : sortConversationsForSidebar(
            listable.filter((c) => {
              const name = (c.name ?? "").toLowerCase();
              const preview = formatConversationListLastPreview(c, currentUserId).toLowerCase();
              return (
                name.includes(q) ||
                preview.includes(q) ||
                c.conversationId.toLowerCase().includes(q)
              );
            }),
          );

      const pinned = sidebarBase.filter((c) => c.isPinnedToTop).slice(0, MAX_PINNED_CHATS_TO_TOP);
      const normal = sidebarBase.filter((c) => !c.isPinnedToTop && !c.isMuted);
      const muted = sidebarBase.filter((c) => !c.isPinnedToTop && c.isMuted);
      const mutedUnreadTotal = muted.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

      const rows: ChatListRow[] = [];

      if (listable.length === 0) {
        return {
          listRows: rows,
          mutedConversations: muted,
          mutedUnreadTotal: 0,
          listableCount: 0,
          searchOnlyInMuted: false,
        };
      }

      if (q && sidebarBase.length === 0) {
        return {
          listRows: rows,
          mutedConversations: muted,
          mutedUnreadTotal,
          listableCount: listable.length,
          searchOnlyInMuted: false,
        };
      }

      if (pinned.length > 0) {
        rows.push({
          kind: "header",
          key: "h:pinned",
          title: "GHIM",
          count: pinned.length,
          variant: "pinned",
        });
        for (const c of pinned) {
          rows.push({ kind: "conversation", key: `c:${c.conversationId}`, conversation: c });
        }
      }
      rows.push({
        kind: "header",
        key: "h:chats",
        title: "TIN NHẮN",
        count: normal.length,
        variant: "chats",
      });
      for (const c of normal) {
        rows.push({ kind: "conversation", key: `c:${c.conversationId}`, conversation: c });
      }

      const searchOnlyInMuted = Boolean(
        q && pinned.length === 0 && normal.length === 0 && muted.length > 0,
      );

      return {
        listRows: rows,
        mutedConversations: muted,
        mutedUnreadTotal,
        listableCount: listable.length,
        searchOnlyInMuted,
      };
    }, [data, searchText, currentUserId]);

  const conversationRowCount = useMemo(
    () => listRows.filter((r) => r.kind === "conversation").length,
    [listRows],
  );

  const showMutedFooter = mutedConversations.length > 0;

  useEffect(() => {
    if (mutedConversations.length === 0) setMutedExpanded(false);
  }, [mutedConversations.length]);

  if (isLoading && !isFetching) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <Text className="min-w-0 flex-1 text-2xl font-bold tracking-tight text-foreground">
          Tin nhắn
        </Text>
        <Pressable
          className="mr-1 size-10 items-center justify-center rounded-full bg-primary/10 active:opacity-70"
          hitSlop={6}
          onPress={() => router.push("/(main)/ai-assistant")}
          accessibilityLabel="Mở Trợ lý HAMTECH"
        >
          <Sparkles size={20} color={primary} strokeWidth={1.9} />
        </Pressable>
      </View>

      <View className="flex-row items-center gap-2 px-4 pb-3">
        <View className="min-w-0 flex-1">
          <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Tìm kiếm" />
        </View>
        <Pressable
          className="size-10 shrink-0 items-center justify-center rounded-lg active:bg-muted/60"
          hitSlop={6}
          onPress={() => setQrScannerOpen(true)}
          accessibilityLabel="Quét mã QR tham gia nhóm"
        >
          <QrCode size={20} color={primary} strokeWidth={1.75} />
        </Pressable>
        <Pressable
          className="size-10 shrink-0 items-center justify-center rounded-lg active:bg-muted/60"
          hitSlop={6}
          onPress={() => setAddFriendOpen(true)}
          accessibilityLabel="Thêm bạn bè"
        >
          <UserPlus size={20} color={primary} strokeWidth={1.75} />
        </Pressable>
        <Pressable
          className="size-10 shrink-0 items-center justify-center rounded-lg active:bg-muted/60"
          hitSlop={6}
          onPress={() => setCreateGroupOpen(true)}
          accessibilityLabel="Tạo nhóm mới"
        >
          <Users size={20} color={primary} strokeWidth={1.5} />
        </Pressable>
      </View>

      <View className="flex-1">
        {isError && !data ? (
          <EmptyState
            icon={CloudOff}
            title="Không tải được tin nhắn"
            description="Kiểm tra kết nối mạng và thử lại."
            action={{ label: "Thử lại", onPress: handleRetryFetch }}
          />
        ) : (
          <FlatList
            data={listRows}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{
              paddingVertical: 4,
              flexGrow:
                listableCount === 0 || (conversationRowCount === 0 && searchText.trim())
                  ? 1
                  : undefined,
            }}
            renderItem={({ item, index }) => {
              const prev = index > 0 ? listRows[index - 1] : null;
              const showSep = prev?.kind === "conversation" && item.kind === "conversation";
              if (item.kind === "header") {
                const Icon = item.variant === "pinned" ? Pin : MessageCircle;
                const countLabel =
                  item.variant === "pinned"
                    ? `${item.count ?? 0}/${MAX_PINNED_CHATS_TO_TOP}`
                    : String(item.count ?? 0);
                return (
                  <View className="px-4 pb-1 pt-2">
                    <View className="flex-row items-center justify-between">
                      <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <Icon size={14} color={iconMuted} strokeWidth={2} />
                        <Text
                          className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                      </View>
                      <View
                        className={
                          item.variant === "pinned"
                            ? "rounded-full bg-primary/15 px-2.5 py-0.5"
                            : "rounded-full bg-muted px-2.5 py-0.5"
                        }
                      >
                        <Text
                          className={`text-[11px] font-bold tabular-nums ${
                            item.variant === "pinned" ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {countLabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }
              return (
                <View>
                  {showSep ? <View className="ml-[76px] h-px bg-border/30" /> : null}
                  <ConversationItem
                    conversation={item.conversation}
                    isActive={
                      Boolean(activeOpenConversationId) &&
                      item.conversation.conversationId === activeOpenConversationId
                    }
                    onPress={() =>
                      router.push(`/(main)/(chat)/${item.conversation.conversationId}`)
                    }
                    onLongPressMenu={openConversationQuickMenu}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              listableCount === 0 ||
              (searchText.trim() &&
                conversationRowCount === 0 &&
                mutedConversations.length === 0) ? (
                <EmptyState
                  icon={searchText.trim() ? Search : MessageSquare}
                  title={searchText.trim() ? "Không tìm thấy kết quả" : "Chưa có tin nhắn"}
                  description={
                    searchText.trim()
                      ? `Thử tên hội thoại, dòng cuối hoặc mã — "${searchText.trim()}"`
                      : "Bắt đầu nhắn tin với bạn bè ngay!"
                  }
                />
              ) : null
            }
            ListFooterComponent={
              showMutedFooter ? (
                <View>
                  {searchOnlyInMuted ? (
                    <View className="border-t border-border/60 px-4 py-3">
                      <Text className="text-center text-[13px] text-muted-foreground">
                        Không có trong mục Tin nhắn — kết quả nằm ở Đã tắt thông báo bên dưới.
                      </Text>
                    </View>
                  ) : null}
                  <MutedConversationsFooter
                    conversations={mutedConversations}
                    expanded={mutedExpanded}
                    onToggleExpanded={() => setMutedExpanded((v) => !v)}
                    mutedUnreadTotal={mutedUnreadTotal}
                    onOpenConversation={(id) => router.push(`/(main)/(chat)/${id}`)}
                    onLongPressMenu={openConversationQuickMenu}
                  />
                </View>
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <CreateGroupModal visible={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />

      <AddFriendModal
        visible={addFriendOpen}
        onClose={() => setAddFriendOpen(false)}
        onChanged={async () => {
          await refetch();
        }}
      />

      <GroupJoinQrScannerModal
        visible={qrScannerOpen}
        onClose={() => setQrScannerOpen(false)}
        onScannedSuffix={handleQrScannedSuffix}
        onScannedUser={handleQrScannedUser}
      />

      <UserQrProfileModal
        visible={scannedUserQr !== null}
        user={scannedUserQr}
        onClose={() => setScannedUserQr(null)}
      />

      <ConversationListActionSheet
        conversation={quickMenuConversation}
        onClose={() => setQuickMenuConversation(null)}
        onTogglePin={handleQuickMenuTogglePin}
        onOpenMutePicker={(item) => setMuteTarget(item)}
        onUnmute={handleQuickMenuUnmute}
        onBlockFriend={handleQuickMenuBlockFriend}
        onUnblockFriend={handleQuickMenuUnblockFriend}
        isBlocked={quickMenuFriendshipStatus === "blocked"}
      />

      <MuteNotificationsModal
        visible={muteTarget !== null}
        mode="create"
        isSubmitting={muteSubmitting}
        onClose={() => !muteSubmitting && setMuteTarget(null)}
        onConfirm={async (p: MuteNotificationsApplyPayload) => {
          if (!muteTarget) return;
          setMuteSubmitting(true);
          try {
            await patchPrefs(buildPatchForMutePayload(muteTarget.conversationId, p)).unwrap();
            toast.success(describeMuteSuccess(p));
            setMuteTarget(null);
          } catch {
            toast.error("Không thể cập nhật thông báo");
            throw new Error("mute_failed");
          } finally {
            setMuteSubmitting(false);
          }
        }}
      />
    </SafeAreaView>
  );
}
