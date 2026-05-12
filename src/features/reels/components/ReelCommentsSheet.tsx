import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import type { IComment } from "@/types/newsfeed.types";
import { useGetReelCommentsQuery, useLazyGetReelCommentsQuery } from "@/store/api/newsfeedApi";
import { useIconColors } from "@/hooks/useIconColors";
import { ReelCommentItem } from "./ReelCommentItem";

interface Props {
  reelId: string;
  visible: boolean;
  onClose: () => void;
  onReply?: (commentId: string, authorName: string) => void;
}

export const ReelCommentsSheet = ({ reelId, visible, onClose, onReply }: Props) => {
  const sheetRef = useRef<BottomSheet>(null);
  const { isDark, muted } = useIconColors();

  // Chuyển đổi mã màu trực tiếp cho BottomSheet
  const sheetBg = isDark ? "hsl(224 30% 10%)" : "hsl(0 0% 97%)";
  const indicatorColor = isDark ? "hsl(220 15% 58%)" : "hsl(220 10% 46%)";

  const { data, isLoading } = useGetReelCommentsQuery(
    { reelId, limit: 20 },
    { skip: !visible || !reelId },
  );
  const [fetchMore] = useLazyGetReelCommentsQuery();

  const [extraComments, setExtraComments] = useState<IComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const prevReelIdRef = useRef(reelId);

  // Reset extra khi reelId thay đổi
  if (prevReelIdRef.current !== reelId) {
    prevReelIdRef.current = reelId;
    setExtraComments([]);
    setNextCursor(null);
    setHasMore(false);
  }

  const baseComments = data?.items ?? [];
  const baseCursor = data?.nextCursor ?? null;
  const baseHasMore = data?.hasMore ?? false;

  const allComments = [...baseComments, ...extraComments];
  const effectiveNextCursor = extraComments.length > 0 ? nextCursor : baseCursor;
  const effectiveHasMore = extraComments.length > 0 ? hasMore : baseHasMore;

  const handleLoadMore = useCallback(async () => {
    const cursor = effectiveNextCursor;
    if (!cursor || isFetchingMore) return;
    setIsFetchingMore(true);
    try {
      const page = await fetchMore({ reelId, limit: 20, cursor }).unwrap();
      setExtraComments((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // no-op
    } finally {
      setIsFetchingMore(false);
    }
  }, [effectiveNextCursor, isFetchingMore, fetchMore, reelId]);

  const renderItem = useCallback(
    ({ item }: { item: IComment }) => (
      <ReelCommentItem comment={item} reelId={reelId} onReply={onReply} />
    ),
    [reelId, onReply],
  );

  const keyExtractor = useCallback((item: IComment) => item.commentId, []);

  const snapPoints = useMemo(() => ["65%"], []);

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: sheetBg }}
      handleIndicatorStyle={{ backgroundColor: indicatorColor, opacity: 0.5, width: 40 }}
      style={s.sheet}
    >
      {/* Header */}
      <View className="border-b border-border px-4 pb-3">
        <Text className="text-base font-bold text-foreground">
          Bình luận ({allComments.length})
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={muted} />
        </View>
      ) : allComments.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-base font-semibold text-muted-foreground">
            Chưa có bình luận nào
          </Text>
          <Text className="mt-1 text-xs text-muted-foreground opacity-60">
            Hãy là người đầu tiên bình luận!
          </Text>
        </View>
      ) : (
        <BottomSheetFlatList
          data={allComments}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={s.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          onEndReached={() => void handleLoadMore()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingMore ? (
              <View className="items-center py-3">
                <ActivityIndicator size="small" color={muted} />
              </View>
            ) : effectiveHasMore ? (
              <Text
                className="py-3 text-center text-sm font-semibold text-blue-400"
                onPress={() => void handleLoadMore()}
              >
                Xem thêm bình luận
              </Text>
            ) : null
          }
        />
      )}
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  sheet: { zIndex: 999 },
  listContent: { padding: 16, paddingBottom: 80 },
});
