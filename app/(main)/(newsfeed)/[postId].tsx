import React, { useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useAddCommentMutation,
  useGetCommentsQuery,
  useGetPostByIdQuery,
} from "@/store/api/newsfeedApi";
import type { IComment, IPost } from "@/types/newsfeed.types";
import TentapPostReadOnly from "@/components/newsfeed/TentapPostReadOnly";
import { SafeAreaView } from "react-native-safe-area-context";

function buildThread(comments: IComment[]) {
  const roots = comments.filter((c) => c.parentId === null);
  const childrenByParent = new Map<string, IComment[]>();
  for (const c of comments) {
    if (!c.parentId) continue;
    const arr = childrenByParent.get(c.parentId) ?? [];
    arr.push(c);
    childrenByParent.set(c.parentId, arr);
  }
  return { roots, childrenByParent };
}

export default function PostDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId: string }>();
  const postId = params.postId;

  const { data: post, isLoading: loadingPost } = useGetPostByIdQuery(postId ?? "", {
    skip: !postId,
  });
  const { data: comments = [], isLoading: loadingComments } = useGetCommentsQuery(postId ?? "", {
    skip: !postId,
  });

  const { roots, childrenByParent } = useMemo(() => buildThread(comments), [comments]);

  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const [addComment, { isLoading: addingComment }] = useAddCommentMutation();

  const submitRoot = async () => {
    const text = commentText.trim();
    if (!text || !postId) return;
    await addComment({ postId, content: text }).unwrap();
    setCommentText("");
  };

  const submitReply = async (parentId: string) => {
    const text = replyText.trim();
    if (!text || !postId) return;
    await addComment({ postId, content: text, parentId }).unwrap();
    setReplyTo(null);
    setReplyText("");
  };

  if (!postId) return null;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 px-4 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable className="rounded-2xl bg-black/5 px-3 py-2" onPress={() => router.back()}>
            <Text className="font-bold">Quay lại</Text>
          </Pressable>
          <Text className="text-xs text-muted-foreground">
            {post ? new Date(post.createdAt).toLocaleString() : ""}
          </Text>
        </View>

        {loadingPost || !post ? (
          <Text className="text-sm text-muted-foreground">Đang tải...</Text>
        ) : null}

        {post ? (
          <View className="mb-4 rounded-3xl border border-border/40 bg-card p-4">
            <Text className="font-bold">{post.author?.displayName ?? post.authorId}</Text>
            <Text className="mt-1 text-xs text-muted-foreground">
              {post.visibility} • {post.publicationStatus}
            </Text>
            <View className="mt-3">
              <TentapPostReadOnly content={post.content} />
            </View>
          </View>
        ) : null}

        <View className="flex-1 rounded-3xl border border-border/40 bg-card p-4">
          <Text className="mb-3 text-lg font-bold">Bình luận</Text>

          {loadingComments && comments.length === 0 ? (
            <Text className="text-sm text-muted-foreground">Đang tải...</Text>
          ) : null}

          <FlatList
            data={roots}
            keyExtractor={(item) => item.commentId}
            renderItem={({ item }) => {
              const kids = childrenByParent.get(item.commentId) ?? [];
              return (
                <View className="mb-4">
                  <View className="rounded-2xl border border-border/40 bg-card p-3">
                    <Text className="text-sm font-bold">{item.authorId}</Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                    <Text className="mt-2 text-sm">{item.content}</Text>
                    <Pressable className="mt-3" onPress={() => setReplyTo(item.commentId)}>
                      <Text className="text-sm font-bold text-blue-600">Trả lời</Text>
                    </Pressable>
                  </View>

                  {kids.length > 0 ? (
                    <View className="ml-4 mt-3 space-y-3">
                      {kids.map((c) => (
                        <View
                          key={c.commentId}
                          className="rounded-2xl border border-border/40 bg-muted/20 p-3"
                        >
                          <Text className="text-sm font-bold">{c.authorId}</Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            {new Date(c.createdAt).toLocaleString()}
                          </Text>
                          <Text className="mt-2 text-sm">{c.content}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {replyTo === item.commentId ? (
                    <View className="ml-4 mt-3">
                      <TextInput
                        value={replyText}
                        onChangeText={setReplyText}
                        placeholder="Nhập nội dung trả lời..."
                        className="rounded-2xl border border-border/40 bg-background px-3 py-2 text-sm"
                        multiline
                      />
                      <View className="mt-2 flex-row gap-3">
                        <Pressable
                          className="rounded-2xl bg-blue-600 px-4 py-2"
                          onPress={() => void submitReply(item.commentId)}
                          disabled={addingComment}
                        >
                          <Text className="text-sm font-bold text-white">Gửi</Text>
                        </Pressable>
                        <Pressable
                          className="rounded-2xl bg-black/5 px-4 py-2"
                          onPress={() => {
                            setReplyTo(null);
                            setReplyText("");
                          }}
                        >
                          <Text className="text-sm font-bold">Hủy</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <Text className="text-sm text-muted-foreground">Chưa có bình luận.</Text>
            }
          />

          <View className="mt-3">
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Nhập bình luận..."
              className="rounded-2xl border border-border/40 bg-background px-3 py-2 text-sm"
              multiline
            />
            <Pressable
              className="mt-3 rounded-2xl bg-blue-600 px-4 py-3"
              onPress={() => void submitRoot()}
              disabled={addingComment}
            >
              <Text className="text-center text-sm font-bold text-white">Gửi bình luận</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
