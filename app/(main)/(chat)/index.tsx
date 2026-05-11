import { useMemo, useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, Text, View, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CloudOff, MessageCircle, MessageSquare, Pin, Search, Users } from "lucide-react-native";

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
import {
  useGetConversationsQuery,
  usePatchConversationPreferencesMutation,
} from "@/store/api/chatApi";
import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import { toast } from "@/utils/appToast";
import {
  buildPatchForMutePayload,
  describeMuteSuccess,
  type MuteNotificationsApplyPayload,
} from "@/utils/muteNotifications";
import { MAX_PINNED_CHATS_TO_TOP } from "@/constants/chatPin";
import { sortConversationsForSidebar } from "@/utils/conversationListSort";
import { formatUnreadBadge } from "@/utils/chatBadge";

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
  const { data, isLoading, isError, refetch, isFetching } = useGetConversationsQuery();
  const [patchPrefs] = usePatchConversationPreferencesMutation();
  const [searchText, setSearchText] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [muteTarget, setMuteTarget] = useState<IConversation | null>(null);
  const [muteSubmitting, setMuteSubmitting] = useState(false);
  const [mutedExpanded, setMutedExpanded] = useState(false);
  const [quickMenuConversation, setQuickMenuConversation] = useState<IConversation | null>(null);
  const { primary, muted: iconMuted } = useIconColors();

  const onRefresh = useCallback(() => {
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

  const openConversationQuickMenu = useCallback((item: IConversation) => {
    setQuickMenuConversation(item);
  }, []);

  const { listRows, mutedConversations, totalUnread, mutedUnreadTotal, listableCount } =
    useMemo(() => {
      const raw = data ?? [];
      const listable = raw.filter((c) => !(c.type === "group" && c.isDeleted));
      const sorted = sortConversationsForSidebar(listable);
      const q = searchText.trim().toLowerCase();

      const totalUnread = listable.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

      const pinned = sorted.filter((c) => c.isPinnedToTop).slice(0, MAX_PINNED_CHATS_TO_TOP);
      const normal = sorted.filter((c) => !c.isPinnedToTop && !c.isMuted);
      const muted = sorted.filter((c) => !c.isPinnedToTop && c.isMuted);
      const mutedUnreadTotal = muted.reduce((s, c) => s + (c.unreadCount ?? 0), 0);

      const rows: ChatListRow[] = [];

      if (q) {
        const hit = sorted.filter((c) => {
          const name = (c.name ?? "").toLowerCase();
          const preview = (c.lastMessage?.content ?? "").toLowerCase();
          return name.includes(q) || preview.includes(q);
        });
        for (const c of sortConversationsForSidebar(hit)) {
          rows.push({ kind: "conversation", key: `c:${c.conversationId}`, conversation: c });
        }
        return {
          listRows: rows,
          mutedConversations: muted,
          totalUnread,
          mutedUnreadTotal,
          listableCount: listable.length,
        };
      }

      if (listable.length === 0) {
        return {
          listRows: [],
          mutedConversations: muted,
          totalUnread: 0,
          mutedUnreadTotal: 0,
          listableCount: 0,
        };
      }

      if (pinned.length > 0) {
        rows.push({
          kind: "header",
          key: "h:pinned",
          title: "Ghim",
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
        title: "Tin nhắn",
        count: normal.length,
        variant: "chats",
      });
      for (const c of normal) {
        rows.push({ kind: "conversation", key: `c:${c.conversationId}`, conversation: c });
      }

      return {
        listRows: rows,
        mutedConversations: muted,
        totalUnread,
        mutedUnreadTotal,
        listableCount: listable.length,
      };
    }, [data, searchText]);

  const conversationRowCount = useMemo(
    () => listRows.filter((r) => r.kind === "conversation").length,
    [listRows],
  );

  const showMutedFooter = !searchText.trim() && mutedConversations.length > 0;

  useEffect(() => {
    if (mutedConversations.length === 0) setMutedExpanded(false);
  }, [mutedConversations.length]);

  if (isLoading && !isFetching) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
          <Text className="text-2xl font-bold tracking-tight text-foreground">Tin nhắn</Text>
          {totalUnread > 0 ? (
            <View className="min-h-[22px] min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5">
              <Text className="text-[11px] font-bold leading-none text-white">
                {formatUnreadBadge(totalUnread)}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          className="size-10 items-center justify-center rounded-full active:bg-muted/50"
          hitSlop={6}
          onPress={() =>
            Alert.alert("Tạo mới", undefined, [
              { text: "Tạo nhóm", onPress: () => setCreateGroupOpen(true) },
              { text: "Hủy", style: "cancel" },
            ])
          }
        >
          <Users size={22} color={primary} strokeWidth={1.5} />
        </Pressable>
      </View>

      <View className="px-4 pb-3">
        <SearchBar
          value={searchText}
          onChangeText={(t) => {
            setSearchText(t);
            if (t.trim()) setMutedExpanded(false);
          }}
          placeholder="Tìm kiếm tin nhắn, bạn bè..."
        />
      </View>

      <View className="flex-1">
        {isError && !data ? (
          <EmptyState
            icon={CloudOff}
            title="Không tải được tin nhắn"
            description="Kiểm tra kết nối mạng và thử lại."
            action={{ label: "Thử lại", onPress: onRefresh }}
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
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={primary} />
            }
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
                    onPress={() =>
                      router.push(`/(main)/(chat)/${item.conversation.conversationId}`)
                    }
                    onLongPressMenu={openConversationQuickMenu}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              listableCount === 0 || (searchText.trim() && conversationRowCount === 0) ? (
                <EmptyState
                  icon={searchText.trim() ? Search : MessageSquare}
                  title={searchText.trim() ? "Không tìm thấy" : "Chưa có tin nhắn"}
                  description={
                    searchText.trim()
                      ? `Không có hội thoại nào khớp với "${searchText.trim()}"`
                      : "Bắt đầu nhắn tin với bạn bè ngay!"
                  }
                />
              ) : null
            }
            ListFooterComponent={
              showMutedFooter ? (
                <MutedConversationsFooter
                  conversations={mutedConversations}
                  expanded={mutedExpanded}
                  onToggleExpanded={() => setMutedExpanded((v) => !v)}
                  mutedUnreadTotal={mutedUnreadTotal}
                  onOpenConversation={(id) => router.push(`/(main)/(chat)/${id}`)}
                  onLongPressMenu={openConversationQuickMenu}
                />
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <CreateGroupModal visible={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />

      <ConversationListActionSheet
        conversation={quickMenuConversation}
        onClose={() => setQuickMenuConversation(null)}
        onTogglePin={handleQuickMenuTogglePin}
        onOpenMutePicker={(item) => setMuteTarget(item)}
        onUnmute={handleQuickMenuUnmute}
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
