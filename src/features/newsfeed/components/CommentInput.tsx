import { forwardRef, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import { useAddCommentMutation } from "@/store/api/newsfeedApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import type { IComment } from "@/types/newsfeed.types";

interface MediaAttachment {
  uri: string;
  name: string;
  mimeType: string;
}

interface CommentInputProps {
  postId: string;
  replyTo: { commentId: string; authorName: string } | null;
  onClearReply: () => void;
  onCommentSubmitted: (comment: IComment) => void;
  onReplySubmitted: (parentCommentId: string, reply: IComment) => void;
  authorName: string;
  authorAvatar: string;
  authorInitial: string;
}

export const CommentInput = forwardRef<TextInput, CommentInputProps>(
  (
    {
      postId,
      replyTo,
      onClearReply,
      onCommentSubmitted,
      onReplySubmitted,
      authorName,
      authorAvatar,
      authorInitial,
    },
    ref,
  ) => {
    const [text, setText] = useState("");
    const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [addComment] = useAddCommentMutation();
    const [uploadMedia] = useUploadMediaMutation();

    const handleEmojiSelected = (emojiObj: EmojiType) => {
      setText((prev) => prev + emojiObj.emoji);
      setIsEmojiPickerOpen(false);
    };

    const pickMedia = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 4 - mediaAttachments.length,
      });
      if (result.canceled) return;
      const incoming: MediaAttachment[] = result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? `media_${Date.now()}`,
        mimeType: a.mimeType ?? "image/jpeg",
      }));
      setMediaAttachments((prev) => [...prev, ...incoming].slice(0, 4));
    };

    const removeAttachment = (idx: number) => {
      setMediaAttachments((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
      const content = text.trim();
      if (!content && mediaAttachments.length === 0) return;
      setIsSubmitting(true);
      try {
        const mediaUrls: string[] = [];
        for (const att of mediaAttachments) {
          const mediaType = att.mimeType.startsWith("video/") ? "video" : "image";
          const res = await uploadMedia({
            file: { uri: att.uri, name: att.name, type: att.mimeType },
            mediaType,
            deliveryScope: "general",
          }).unwrap();
          mediaUrls.push(res.url);
        }

        const created = await addComment({
          postId,
          content,
          parentId: replyTo?.commentId,
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        }).unwrap();

        if (created) {
          if (replyTo) {
            onReplySubmitted(replyTo.commentId, created);
          } else {
            onCommentSubmitted(created);
          }
        }
        setText("");
        setMediaAttachments([]);
        onClearReply();
      } catch {
        // no-op
      } finally {
        setIsSubmitting(false);
      }
    };

    const canSubmit = !isSubmitting && (text.trim().length > 0 || mediaAttachments.length > 0);

    return (
      <View className="flex-row items-start gap-2">
        {/* Avatar */}
        <View className="size-8 items-center justify-center overflow-hidden rounded-full bg-muted/40">
          {authorAvatar ? (
            <Image source={{ uri: authorAvatar }} className="h-full w-full" resizeMode="cover" />
          ) : (
            <Text className="text-xs font-bold text-muted-foreground">{authorInitial}</Text>
          )}
        </View>

        <View className="flex-1 overflow-hidden rounded-2xl border border-border/60 bg-background">
          {/* Banner "Đang trả lời X" */}
          {replyTo && (
            <View className="flex-row items-center justify-between border-b border-border/40 bg-muted/40 px-3 py-1.5">
              <Text className="text-xs text-muted-foreground">
                Đang trả lời{" "}
                <Text className="font-semibold text-foreground">{replyTo.authorName}</Text>
              </Text>
              <Pressable onPress={onClearReply} className="rounded-full p-0.5 active:bg-muted">
                <Ionicons name="close" size={14} color="#94a3b8" />
              </Pressable>
            </View>
          )}

          {/* Thumbnails preview */}
          {mediaAttachments.length > 0 && (
            <View className="flex-row flex-wrap gap-1.5 border-b border-border/40 p-2">
              {mediaAttachments.map((att, idx) => (
                <View key={idx} className="size-16 overflow-hidden rounded-lg bg-muted/40">
                  {att.mimeType.startsWith("video/") ? (
                    <View className="size-16 items-center justify-center bg-muted/60">
                      <Ionicons name="videocam" size={24} color="#64748b" />
                    </View>
                  ) : (
                    <Image source={{ uri: att.uri }} className="h-full w-full" resizeMode="cover" />
                  )}
                  <Pressable
                    onPress={() => removeAttachment(idx)}
                    className="absolute right-0.5 top-0.5 size-5 items-center justify-center rounded-full bg-background/80"
                  >
                    <Ionicons name="close" size={12} color="#334155" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Text input */}
          <TextInput
            ref={ref}
            value={text}
            onChangeText={setText}
            placeholder={replyTo ? `Trả lời ${replyTo.authorName}...` : "Viết bình luận..."}
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={() => void handleSubmit()}
            style={{ minHeight: 36, maxHeight: 96 }}
            className="px-3 py-2 text-sm text-foreground"
          />

          {/* Toolbar */}
          <View className="flex-row items-center justify-between border-t border-border/50 px-2 py-1.5">
            <View className="flex-row items-center gap-1">
              <Pressable
                onPress={() => setIsEmojiPickerOpen(true)}
                className="rounded-lg p-1.5 active:bg-muted/40"
              >
                <Ionicons name="happy-outline" size={16} color="#f59e0b" />
              </Pressable>
              <Pressable
                onPress={() => void pickMedia()}
                disabled={mediaAttachments.length >= 4}
                className="rounded-lg p-1.5 active:bg-muted/40 disabled:opacity-40"
              >
                <Ionicons name="image-outline" size={16} color="#16a34a" />
              </Pressable>
            </View>
            <Pressable
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
              className="flex-row items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 disabled:opacity-60"
            >
              {isSubmitting ? (
                <View className="size-3.5 rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Ionicons name="send" size={13} color="#fff" />
              )}
              <Text className="text-xs font-bold text-white">
                {isSubmitting ? "Đang gửi..." : "Gửi"}
              </Text>
            </Pressable>
          </View>
        </View>

        <EmojiPicker
          open={isEmojiPickerOpen}
          onClose={() => setIsEmojiPickerOpen(false)}
          onEmojiSelected={handleEmojiSelected}
          theme={{
            backdrop: "#00000088",
            knob: "#3b82f6",
            container: "#1e1e1e",
            header: "#f8fafc",
            skinTonesContainer: "#252427",
            category: {
              icon: "#94a3b8",
              iconActive: "#3b82f6",
              container: "#252427",
              containerActive: "#333333",
            },
          }}
        />
      </View>
    );
  },
);
