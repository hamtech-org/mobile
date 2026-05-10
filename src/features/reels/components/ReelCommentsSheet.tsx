import { useCallback, useMemo, useRef } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useGetReelCommentsQuery } from "@/store/api/newsfeedApi";
import type { IComment } from "@/types/newsfeed.types";

interface Props {
  reelId: string;
  visible: boolean;
  onClose: () => void;
}

export const ReelCommentsSheet = ({ reelId, visible, onClose }: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["70%"], []);

  const { data, isLoading } = useGetReelCommentsQuery({ reelId, limit: 30 }, { skip: !visible });
  const comments = data?.items ?? [];

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  );

  const renderComment = useCallback(
    ({ item }: { item: IComment }) => (
      <View style={s.commentRow}>
        {item.author?.avatar ? (
          <Image source={{ uri: item.author.avatar }} style={s.avatar} />
        ) : (
          <View style={s.avatarFallback}>
            <Text style={s.avatarFallbackText}>
              {item.author?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.authorName} numberOfLines={1}>
            {item.author?.displayName ?? "Người dùng"}
          </Text>
          {item.content ? <Text style={s.commentText}>{item.content}</Text> : null}
        </View>
      </View>
    ),
    [],
  );

  if (!visible) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={s.sheetBg}
      handleIndicatorStyle={s.handle}
    >
      <BottomSheetView style={s.sheetContent}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Bình luận ({comments.length})</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>

        {/* Comments list */}
        {isLoading ? (
          <View style={s.centered}>
            <ActivityIndicator color="rgba(255,255,255,0.5)" />
          </View>
        ) : comments.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyText}>Chưa có bình luận nào</Text>
            <Text style={s.emptySubText}>Hãy là người đầu tiên bình luận!</Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={comments}
            keyExtractor={(item) => item.commentId}
            renderItem={renderComment}
            style={{ flex: 1 }}
            // paddingBottom đủ để comment cuối không bị input bar che
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 80 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </BottomSheetView>
    </BottomSheet>
  );
};

const s = StyleSheet.create({
  sheetBg: { backgroundColor: "hsl(0, 0%, 7%)" },
  handle: { backgroundColor: "rgba(255,255,255,0.3)", width: 40 },
  sheetContent: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  emptySubText: { color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 },
  commentRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  authorName: { color: "#fff", fontSize: 14, fontWeight: "600" },
  commentText: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 2, lineHeight: 20 },
});
