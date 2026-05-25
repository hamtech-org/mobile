import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, Check, Trash2, X } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useGetPendingPostsQuery, useResolvePendingPostMutation } from "@/store/api/communityApi";
import { type FriendListItem, usePostMultipleUsersMutation } from "@/store/api/userApi";
import { type IPost } from "@/types/newsfeed.types";
import { toast } from "@/utils/appToast";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";
import { MediaGallery } from "@/features/newsfeed/components/MediaGallery";
import { formatRelativeTime } from "@/utils/time";
import { useEffect, useMemo, useRef } from "react";

export interface PendingPostsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  mutedColor: string;
  foregroundColor: string;
}

export function PendingPostsModal({
  open,
  onClose,
  groupId,
  mutedColor,
  foregroundColor,
}: PendingPostsModalProps) {
  const {
    data: pendingPosts,
    isLoading,
    refetch,
  } = useGetPendingPostsQuery(groupId, { skip: !open });
  const [resolvePost, { isLoading: isResolving }] = useResolvePendingPostMutation();

  const [rejectingPost, setRejectingPost] = useState<IPost | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [profilesMap, setProfilesMap] = useState<Record<string, FriendListItem>>({});
  const [postMultipleUsers] = usePostMultipleUsersMutation();
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // Lấy danh sách authorIds từ bài viết chờ duyệt để batch fetch profile
  const authorIds = useMemo(() => {
    if (!pendingPosts) return [];
    return Array.from(new Set(pendingPosts.map((p) => p.authorId)));
  }, [pendingPosts]);

  useEffect(() => {
    const missingIds = authorIds.filter((id) => !fetchedIdsRef.current.has(id));
    if (missingIds.length > 0) {
      missingIds.forEach((id) => fetchedIdsRef.current.add(id));
      postMultipleUsers({ userIds: missingIds })
        .unwrap()
        .then((users) => {
          if (users && users.length > 0) {
            setProfilesMap((prev) => {
              const next = { ...prev };
              users.forEach((u) => {
                next[u.userId] = u;
              });
              return next;
            });
          }
        })
        .catch((err) => {
          console.error("Batch fetch pending post authors error:", err);
          missingIds.forEach((id) => fetchedIdsRef.current.delete(id));
        });
    }
  }, [authorIds, postMultipleUsers]);

  const handleResolve = async (postId: string, action: "approve" | "reject", reason?: string) => {
    try {
      await resolvePost({
        groupId,
        postId,
        action,
        rejectReason: reason,
      }).unwrap();

      toast.success(action === "approve" ? "Đã phê duyệt bài viết" : "Đã từ chối bài viết");
      if (action === "reject") {
        setRejectingPost(null);
        setRejectReason("");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể xử lý bài viết");
    }
  };

  const renderPendingPost = ({ item }: { item: IPost }) => {
    const profile = profilesMap[item.authorId];
    const authorName = profile?.displayName || item.author?.displayName || item.authorId;
    const avatarUri = profile?.avatar || item.author?.avatar;
    const postText = extractTextFromTiptapJson(item.content);

    return (
      <View className="mb-4 rounded-3xl border border-border/40 bg-card p-4">
        {/* Header tác giả */}
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={authorName} size="md" />
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-bold text-foreground" numberOfLines={1}>
              {authorName}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
        </View>

        {/* Nội dung text bài viết */}
        {!!postText.trim() && (
          <Text className="mt-3 text-sm font-medium leading-relaxed text-foreground">
            {postText}
          </Text>
        )}

        {/* Media đính kèm */}
        {item.mediaUrls && item.mediaUrls.length > 0 && (
          <View className="mt-1">
            <MediaGallery mediaUrls={item.mediaUrls} />
          </View>
        )}

        {/* Các nút phê duyệt */}
        <View className="mt-4 flex-row gap-3 border-t border-border/20 pt-3">
          <Pressable
            disabled={isResolving}
            onPress={() => void handleResolve(item.postId, "approve")}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-2xl bg-primary py-3 active:opacity-80 disabled:opacity-50"
          >
            <Check size={16} color="#ffffff" strokeWidth={2.5} />
            <Text className="text-sm font-bold text-primary-foreground">Phê duyệt</Text>
          </Pressable>
          <Pressable
            disabled={isResolving}
            onPress={() => setRejectingPost(item)}
            className="flex-row items-center justify-center rounded-2xl bg-destructive/10 px-5 py-3 active:opacity-80 disabled:opacity-50"
          >
            <Trash2 size={16} color="#ef4444" />
            <Text className="ml-1.5 text-sm font-bold text-destructive">Từ chối</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        {/* Header Modal */}
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="text-[15px] font-semibold text-foreground">Đóng</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">
            Duyệt bài viết ({pendingPosts?.length ?? 0})
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="rounded-xl px-3 py-2 active:opacity-70"
          >
            <Text className="text-[15px] font-semibold text-primary">Tải lại</Text>
          </Pressable>
        </View>

        {/* Nội dung danh sách chờ duyệt */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-3 text-muted-foreground">Đang tải danh sách bài viết...</Text>
          </View>
        ) : (
          <FlatList
            data={pendingPosts}
            keyExtractor={(item) => item.postId}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            renderItem={renderPendingPost}
            ListEmptyComponent={
              <View className="mt-16 items-center gap-3 p-8">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <FileText size={32} color="#3b82f6" />
                </View>
                <Text className="mt-2 text-center text-lg font-bold text-foreground">
                  Không có bài viết chờ duyệt
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Tất cả các bài thảo luận đã được đăng trực tiếp hoặc đã phê duyệt xong.
                </Text>
              </View>
            }
          />
        )}

        {/* Modal từ chối bài viết (nhập lý do) */}
        <Modal
          visible={rejectingPost !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setRejectingPost(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 items-center justify-center bg-black/60 p-6"
          >
            <View className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
              <View className="flex-row items-center justify-between border-b border-border/40 pb-3">
                <Text className="text-base font-bold text-foreground">Lý do từ chối</Text>
                <Pressable
                  onPress={() => {
                    setRejectingPost(null);
                    setRejectReason("");
                  }}
                  className="rounded-full bg-muted p-1 active:opacity-75"
                >
                  <X size={16} color={foregroundColor} />
                </Pressable>
              </View>

              <Text className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Nhập lý do từ chối bài thảo luận này để người đăng hiểu rõ nguyên nhân vi phạm.
              </Text>

              <TextInput
                multiline
                numberOfLines={3}
                placeholder="Nhập lý do vi phạm nội quy, ngôn từ không phù hợp..."
                placeholderTextColor={mutedColor}
                value={rejectReason}
                onChangeText={setRejectReason}
                className="mt-4 min-h-[80px] rounded-2xl border border-border bg-muted/30 p-3 text-sm text-foreground"
                textAlignVertical="top"
              />

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setRejectingPost(null);
                    setRejectReason("");
                  }}
                  className="flex-1 items-center justify-center rounded-2xl bg-muted py-3 active:opacity-80"
                >
                  <Text className="text-sm font-bold text-foreground">Hủy</Text>
                </Pressable>
                <Pressable
                  disabled={isResolving || !rejectReason.trim()}
                  onPress={() => {
                    if (rejectingPost) {
                      void handleResolve(rejectingPost.postId, "reject", rejectReason);
                    }
                  }}
                  className="flex-1 items-center justify-center rounded-2xl bg-destructive py-3 active:opacity-80 disabled:opacity-50"
                >
                  <Text className="text-destructive-foreground text-sm font-bold">Từ chối</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
