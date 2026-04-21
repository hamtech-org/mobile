import { useMemo, useState, useCallback } from "react";
import { router } from "expo-router";
import { Alert, FlatList, Pressable, Text, View, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CloudOff, MessageSquare, Search, SquarePen, Users } from "lucide-react-native";

import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchBar } from "@/components/common/SearchBar";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { CreateGroupModal } from "@/components/chat";
import {
  useGetConversationsQuery,
  usePatchConversationPreferencesMutation,
} from "@/store/api/chatApi";
import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import { toast } from "@/utils/appToast";

/**
 * ChatListScreen — Danh sách hội thoại.
 * - Hỗ trợ tìm kiếm local.
 * - Pull-to-refresh để cập nhật danh sách.
 * - Hiển thị unread badge và media preview.
 */
export default function ChatListScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useGetConversationsQuery();
  const [patchPrefs] = usePatchConversationPreferencesMutation();
  const [searchText, setSearchText] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const { primary } = useIconColors();

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openConversationQuickMenu = useCallback(
    (item: IConversation) => {
      const pinned = item.isPinnedToTop ?? false;
      const muted = item.isMuted ?? false;
      Alert.alert(item.name ?? "Hội thoại", undefined, [
        {
          text: pinned ? "Bỏ ghim" : "Ghim lên đầu",
          onPress: () => {
            void patchPrefs({ conversationId: item.conversationId, isPinnedToTop: !pinned })
              .unwrap()
              .then(() => toast.success(pinned ? "Đã bỏ ghim hội thoại" : "Đã ghim hội thoại"))
              .catch(() => toast.error("Không cập nhật được ghim hội thoại"));
          },
        },
        {
          text: muted ? "Bật thông báo" : "Tắt thông báo",
          onPress: () => {
            void patchPrefs({ conversationId: item.conversationId, isMuted: !muted })
              .unwrap()
              .then(() => toast.success(muted ? "Đã bật thông báo" : "Đã tắt thông báo"))
              .catch(() => toast.error("Không cập nhật được thông báo"));
          },
        },
        { text: "Hủy", style: "cancel" },
      ]);
    },
    [patchPrefs],
  );

  // Sắp xếp hội thoại mới nhất lên đầu + lọc theo search
  const filtered = useMemo(() => {
    let list = [...(data ?? [])];

    // Sort by last message / update time
    list.sort((a, b) => {
      const pinA = a.isPinnedToTop ? 1 : 0;
      const pinB = b.isPinnedToTop ? 1 : 0;
      if (pinB !== pinA) return pinB - pinA;
      const timeA = new Date(a.updatedAt || a.lastMessage?.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.lastMessage?.createdAt || 0).getTime();
      return timeB - timeA;
    });

    if (!searchText.trim()) return list;
    const q = searchText.toLowerCase();
    return list.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.lastMessage?.content?.toLowerCase().includes(q),
    );
  }, [data, searchText]);

  if (isLoading && !isFetching) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header — "Tin nhắn" bold + action icons */}
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <Text className="text-2xl font-bold tracking-tight text-foreground">Tin nhắn</Text>
        <View className="flex-row gap-1">
          <Pressable
            className="size-10 items-center justify-center rounded-full active:bg-muted/50"
            hitSlop={6}
          >
            <Search size={22} color={primary} strokeWidth={1.5} />
          </Pressable>
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
          <Pressable
            className="size-10 items-center justify-center rounded-full active:bg-muted/50"
            hitSlop={6}
            onPress={() =>
              Alert.alert("Soạn tin", "Chọn nhóm hoặc mở cuộc trò chuyện từ danh sách.", [
                { text: "OK" },
              ])
            }
          >
            <SquarePen size={22} color={primary} strokeWidth={1.5} />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <View className="px-4 pb-3">
        <SearchBar
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Tìm kiếm tin nhắn, bạn bè..."
        />
      </View>

      {/* Main List */}
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
            data={filtered}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={{
              paddingVertical: 4,
              flexGrow: filtered.length === 0 ? 1 : undefined,
            }}
            refreshControl={
              <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={primary} />
            }
            renderItem={({ item }) => (
              <ConversationItem
                conversation={item}
                onPress={() => router.push(`/(main)/(chat)/${item.conversationId}`)}
                onLongPressMenu={openConversationQuickMenu}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                icon={searchText ? Search : MessageSquare}
                title={searchText ? "Không tìm thấy" : "Chưa có tin nhắn"}
                description={
                  searchText
                    ? `Không có hội thoại nào khớp với "${searchText}"`
                    : "Bắt đầu nhắn tin với bạn bè ngay!"
                }
              />
            }
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View className="ml-[76px] h-px bg-border/30" />}
          />
        )}
      </View>

      <CreateGroupModal visible={createGroupOpen} onClose={() => setCreateGroupOpen(false)} />
    </SafeAreaView>
  );
}
