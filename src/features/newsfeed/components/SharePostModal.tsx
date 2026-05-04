import { useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSharePostMutation } from "@/store/api/newsfeedApi";
import type { IPost, ISharedPostInfo, PostVisibility } from "@/types/newsfeed.types";
import { SharedPostPreview } from "./SharedPostPreview";

interface Props {
  visible: boolean;
  post: IPost;
  onClose: () => void;
}

const VISIBILITY_OPTIONS: { value: PostVisibility; label: string; icon: string }[] = [
  { value: "public", label: "Công khai", icon: "globe-outline" },
  { value: "friends", label: "Bạn bè", icon: "people-outline" },
  { value: "private", label: "Chỉ mình tôi", icon: "lock-closed-outline" },
];

export const SharePostModal = ({ visible, post, onClose }: Props) => {
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>(
    post.visibility === "private" ? "friends" : post.visibility,
  );
  const [showVisibilityPicker, setShowVisibilityPicker] = useState(false);

  const [sharePost, { isLoading }] = useSharePostMutation();

  const handleShare = async () => {
    try {
      const result = await sharePost({
        postId: post.postId,
        content: caption.trim() || undefined,
        visibility,
      }).unwrap();
      DeviceEventEmitter.emit("post:created", result);
      setCaption("");
      onClose();
    } catch {
      // error handled by middleware
    }
  };

  const previewSource: ISharedPostInfo = post.sharedFrom ?? {
    postId: post.postId,
    authorId: post.authorId,
    content: post.content,
    mediaUrls: post.mediaUrls,
    type: post.type,
    author: post.author,
    createdAt: post.createdAt,
  };

  const selectedVisibility = VISIBILITY_OPTIONS.find((o) => o.value === visibility)!;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-background px-4 pb-10 pt-4"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-muted" />

          {/* Title row */}
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold">Chia sẻ bài viết</Text>
            <Pressable onPress={onClose} className="rounded-full p-1 active:bg-muted/40">
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Caption input */}
            <TextInput
              placeholder="Thêm nội dung (tùy chọn)..."
              value={caption}
              onChangeText={setCaption}
              maxLength={20000}
              multiline
              numberOfLines={3}
              className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-foreground"
              placeholderTextColor="#94a3b8"
              textAlignVertical="top"
            />

            {/* Visibility picker */}
            <Pressable
              className="mt-3 flex-row items-center gap-2 self-start rounded-full border border-border/50 px-3 py-1.5 active:bg-muted/40"
              onPress={() => setShowVisibilityPicker(true)}
            >
              <Ionicons name={selectedVisibility.icon as any} size={15} color="#64748b" />
              <Text className="text-sm font-medium text-muted-foreground">
                {selectedVisibility.label}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#94a3b8" />
            </Pressable>

            {/* Original post preview */}
            <SharedPostPreview sharedFrom={previewSource} />

            {/* Action buttons */}
            <View className="mt-4 flex-row gap-3">
              <Pressable
                className="flex-1 items-center justify-center rounded-xl border border-border/50 py-3 active:bg-muted/40"
                onPress={onClose}
                disabled={isLoading}
              >
                <Text className="font-semibold text-muted-foreground">Hủy</Text>
              </Pressable>
              <Pressable
                className="flex-1 items-center justify-center rounded-xl bg-primary py-3 active:opacity-80"
                onPress={() => void handleShare()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="font-semibold text-primary-foreground">Chia sẻ</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>

      {/* Visibility picker modal */}
      <Modal visible={showVisibilityPicker} transparent animationType="fade">
        <Pressable
          className="flex-1 items-center justify-center bg-black/40"
          onPress={() => setShowVisibilityPicker(false)}
        >
          <View className="w-64 overflow-hidden rounded-2xl border border-border/40 bg-background shadow-lg">
            {VISIBILITY_OPTIONS.map((opt, i) => (
              <Pressable
                key={opt.value}
                className={`flex-row items-center gap-3 px-5 py-4 active:bg-muted ${
                  i < VISIBILITY_OPTIONS.length - 1 ? "border-b border-border/40" : ""
                }`}
                onPress={() => {
                  setVisibility(opt.value);
                  setShowVisibilityPicker(false);
                }}
              >
                <Ionicons name={opt.icon as any} size={20} color="#64748b" />
                <Text className="flex-1 text-base font-medium">{opt.label}</Text>
                {visibility === opt.value && (
                  <Ionicons name="checkmark" size={18} color="#3b82f6" />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
};
