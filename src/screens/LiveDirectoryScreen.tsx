import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Plus, Radio, RefreshCw } from "lucide-react-native";

import { CreateLiveSessionSheet } from "@/components/live/CreateLiveSessionSheet";
import { LiveSessionCard } from "@/components/live/LiveSessionCard";
import { useIconColors } from "@/hooks/useIconColors";
import { LIVE_AS_VIEWER_PARAM, useMyLiveDirectory } from "@/hooks/useMyLiveDirectory";
import { useListLiveSessionsQuery, type LiveSessionListItem } from "@/store/api/liveApi";

export function LiveDirectoryScreen() {
  const { primary, foreground } = useIconColors();
  const { data, isLoading, isFetching, refetch } = useListLiveSessionsQuery();
  const {
    mySession,
    publicSessions,
    showMyLiveViewerButton,
    showResumeHostButton,
    hasMyActiveSession,
  } = useMyLiveDirectory(data);
  const [createOpen, setCreateOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: LiveSessionListItem }) => (
      <LiveSessionCard session={item} durationNowMs={nowMs} />
    ),
    [nowMs],
  );

  const listHeader = (
    <>
      {(showMyLiveViewerButton || showResumeHostButton) && mySession ? (
        <View className="mb-4 gap-2">
          {showMyLiveViewerButton ? (
            <Pressable
              onPress={() =>
                router.push(`/(main)/(live)/${mySession.sessionId}/watch?${LIVE_AS_VIEWER_PARAM}=1`)
              }
              className="flex-row items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3 active:opacity-90"
            >
              <Radio size={18} color={primary} />
              <Text className="font-semibold text-primary">Phiên live của tôi</Text>
            </Pressable>
          ) : null}
          {showResumeHostButton ? (
            <Pressable
              onPress={() => router.push(`/(main)/(live)/${mySession.sessionId}/host`)}
              className="items-center rounded-xl bg-primary py-3 active:opacity-90"
            >
              <Text className="font-semibold text-primary-foreground">Tiếp tục phát sóng</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );

  const listEmpty =
    !isLoading && !publicSessions.length && !showMyLiveViewerButton && !showResumeHostButton ? (
      <View className="items-center py-16">
        <Text className="text-center text-muted-foreground">
          Chưa có phiên live nào. Hãy tạo phiên đầu tiên!
        </Text>
      </View>
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-2">
          <Radio size={22} color={primary} />
          <Text className="text-lg font-semibold text-foreground">Đang phát trực tiếp</Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => void refetch()}
            className="size-9 items-center justify-center rounded-full active:bg-muted"
          >
            <RefreshCw size={20} color={foreground} />
          </Pressable>
          {!hasMyActiveSession ? (
            <Pressable
              onPress={() => setCreateOpen(true)}
              className="flex-row items-center gap-1 rounded-full bg-primary px-3 py-2 active:opacity-90"
            >
              <Plus size={16} color="#fff" />
              <Text className="text-xs font-semibold text-primary-foreground">Tạo phiên</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={publicSessions}
          keyExtractor={(item) => item.sessionId}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => void refetch()}
            />
          }
        />
      )}

      <CreateLiveSessionSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </SafeAreaView>
  );
}
