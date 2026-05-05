import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import BottomSheet, { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useGetReelCommentsQuery, useAddReelCommentMutation } from "@/store/api/newsfeedApi";
import type { IComment } from "@/types/newsfeed.types";

interface Props {
  reelId: string;
  visible: boolean;
  onClose: () => void;
}

/**
 * Bottom sheet bình luận cho Reel (mobile).
 * Dùng @gorhom/bottom-sheet (đã có trong project).
 */
export const ReelCommentsSheet = ({ reelId, visible, onClose }: Props) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["60%", "90%"], []);

  const { data, isLoading } = useGetReelCommentsQuery({ reelId, limit: 30 }, { skip: !visible });
  const [addComment, { isLoading: isSending }] = useAddReelCommentMutation();
  const [text, setText] = useState("");

  const comments = data?.items ?? [];

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    try {
      await addComment({ reelId, content: trimmed }).unwrap();
      setText("");
      Keyboard.dismiss();
    } catch {
      // Error handling
    }
  }, [text, isSending, reelId, addComment]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ),
    [],
  );

  const renderComment = useCallback(
    ({ item }: { item: IComment }) => (
      <View className="flex-row gap-2.5 px-4 py-2">
        {item.author?.avatar ? (
          <Image source={{ uri: item.author.avatar }} className="size-8 rounded-full" />
        ) : (
          <View className="size-8 items-center justify-center rounded-full bg-muted">
            <Text className="text-xs font-bold text-foreground">
              {item.author?.displayName?.charAt(0)?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-baseline gap-2">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {item.author?.displayName ?? "Người dùng"}
            </Text>
          </View>
          {item.content ? (
            <Text className="mt-0.5 text-sm leading-snug text-foreground/90">{item.content}</Text>
          ) : null}
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
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "hsl(0 0% 7%)" }}
      handleIndicatorStyle={{ backgroundColor: "rgba(255,255,255,0.3)", width: 40 }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-white/10 px-4 pb-3">
        <Text className="text-base font-bold text-white">Bình luận ({comments.length})</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </View>

      {/* Comments list */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator color="rgba(255,255,255,0.5)" />
        </View>
      ) : comments.length === 0 ? (
        <View className="flex-1 items-center justify-center py-12">
          <Text className="text-sm text-white/50">Chưa có bình luận nào</Text>
          <Text className="mt-1 text-xs text-white/30">Hãy là người đầu tiên bình luận!</Text>
        </View>
      ) : (
        <FlatList
          data={comments}
          keyExtractor={(item) => item.commentId}
          renderItem={renderComment}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input */}
      <View className="flex-row items-center gap-2 border-t border-white/10 px-4 py-3">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Viết bình luận..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white"
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!isSending}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || isSending}
          className="size-10 items-center justify-center rounded-xl bg-blue-600"
          style={{ opacity: !text.trim() || isSending ? 0.5 : 1 }}
          hitSlop={8}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </BottomSheet>
  );
};
