import { useMemo, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CloudOff, MessageSquare, Search, SquarePen } from "lucide-react-native";

import { Loading } from "@/components/common/Loading";
import { EmptyState } from "@/components/common/EmptyState";
import { SearchBar } from "@/components/common/SearchBar";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { useGetConversationsQuery } from "@/store/api/chatApi";
import { useIconColors } from "@/hooks/useIconColors";

export default function ChatListScreen() {
  const { data, isLoading, isError, refetch } = useGetConversationsQuery();
  const [searchText, setSearchText] = useState("");
  const { primary } = useIconColors();

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!searchText.trim()) return list;
    const q = searchText.toLowerCase();
    return list.filter(
      (c) => c.name?.toLowerCase().includes(q) || c.lastMessage?.content?.toLowerCase().includes(q),
    );
  }, [data, searchText]);

  if (isLoading) {
    return <Loading fullScreen message="Đang tải tin nhắn..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header — "Tin nhắn" bold + action icons */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <Text className="text-foreground text-2xl font-bold tracking-tight">Tin nhắn</Text>
        <View className="flex-row gap-1">
          <Pressable className="size-9 items-center justify-center rounded-full active:opacity-70" hitSlop={6}>
            <Search size={22} color={primary} strokeWidth={1.5} />
          </Pressable>
          <Pressable className="size-9 items-center justify-center rounded-full active:opacity-70" hitSlop={6}>
            <SquarePen size={22} color={primary} strokeWidth={1.5} />
          </Pressable>
        </View>
      </View>

      {/* Search bar */}
      <View className="px-4 pb-2">
        <SearchBar value={searchText} onChangeText={setSearchText} placeholder="Tìm trong tin nhắn..." />
      </View>

      {/* Thin divider */}
      <View className="h-px bg-border/50" />

      {isError ? (
        <EmptyState
          icon={CloudOff}
          title="Không tải được tin nhắn"
          description="Kiểm tra kết nối mạng và thử lại."
          action={{ label: "Thử lại", onPress: () => void refetch() }}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.conversationId}
          contentContainerStyle={{
            paddingVertical: 4,
            flexGrow: filtered.length === 0 ? 1 : undefined,
          }}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={() => router.push(`/(main)/(chat)/${item.conversationId}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={searchText ? Search : MessageSquare}
              title={searchText ? "Không tìm thấy" : "Chưa có tin nhắn"}
              description={
                searchText
                  ? `Không có hội thoại nào khớp với "${searchText}"`
                  : "Bắt đầu nhắn tin với bạn bè!"
              }
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="h-px bg-border/30 ml-[76px]" />}
        />
      )}
    </SafeAreaView>
  );
}
