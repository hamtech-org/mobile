import { router } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/common/Button";
import { Loading } from "@/components/common/Loading";
import { ConversationItem } from "@/components/chat/ConversationItem";
import { useGetConversationsQuery } from "@/store/api/chatApi";

export default function ChatListScreen() {
  const { data, isLoading, isError, refetch } = useGetConversationsQuery();

  if (isLoading) {
    return <Loading fullScreen message="Đang tải danh sách hội thoại..." />;
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 px-4 py-4 gap-4">
        <Text className="text-foreground text-xl font-bold">Chat</Text>

        {isError ? (
          <View className="bg-card border border-border rounded-2xl p-5 gap-3">
            <Text className="text-destructive text-sm">Không tải được danh sách hội thoại.</Text>
            <Button label="Thử lại" size="sm" onPress={() => void refetch()} />
          </View>
        ) : (
          <FlatList
            data={data ?? []}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={{ gap: 10, paddingBottom: 16, flexGrow: (data?.length ?? 0) === 0 ? 1 : undefined }}
            renderItem={({ item }) => (
              <ConversationItem conversation={item} onPress={() => router.push(`/(main)/(chat)/${item.conversationId}`)} />
            )}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center">
                <Text className="text-muted-foreground">Chưa có hội thoại nào.</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
