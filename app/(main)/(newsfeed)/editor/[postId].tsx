import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGetPostByIdQuery, useUpdatePostMutation } from "@/store/api/newsfeedApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import type { PostPublicationStatus, PostVisibility } from "@/types/newsfeed.types";
import TentapPostEditor from "@/components/newsfeed/TentapPostEditor";

const parseCsv = (raw: string): string[] =>
  raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);

export default function EditPostEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId: string }>();
  const postId = params.postId;

  const { data: post, isLoading } = useGetPostByIdQuery(postId ?? "", {
    skip: !postId,
  });

  const emptyDoc = useMemo(
    () => JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    [],
  );
  const [content, setContent] = useState<string>(() => emptyDoc);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [publicationStatus, setPublicationStatus] = useState<PostPublicationStatus>("published");
  const [categoriesText, setCategoriesText] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  useEffect(() => {
    if (!post) return;
    setContent(post.content ?? "");
    setVisibility(post.visibility);
    setPublicationStatus(post.publicationStatus);
    setCategoriesText((post.categories ?? []).join(", "));
    setTagsText((post.tags ?? []).join(", "));
    setMediaUrls(post.mediaUrls ?? []);
  }, [post]);

  const categories = useMemo(() => parseCsv(categoriesText), [categoriesText]);
  const tags = useMemo(() => parseCsv(tagsText), [tagsText]);
  const postType: "text" | "image" = mediaUrls.length > 0 ? "image" : "text";

  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();
  const [updatePost, { isLoading: updating }] = useUpdatePostMutation();

  const requestImageUpload = async (): Promise<string> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return "";

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return "";

    const asset = res.assets[0];
    const file = await prepareLocalFileForUpload({
      uri: asset.uri,
      name: asset.fileName ?? "post.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });

    const up = await uploadMedia({
      file: { uri: file.uri, name: file.name, type: file.type },
      mediaType: "image",
    }).unwrap();

    const url = up?.url?.trim();
    if (url) {
      setMediaUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
      return url;
    }
    return "";
  };

  const onSubmit = async () => {
    if (!postId) return;
    const trimmed = content.trim();
    if (!trimmed) return;

    await updatePost({
      postId,
      data: {
        content: trimmed,
        type: postType,
        visibility,
        publicationStatus,
        categories,
        tags,
        mediaUrls,
      },
    }).unwrap();

    router.replace("/(main)/(newsfeed)");
  };

  const busy = isLoading || updating || uploading;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 pb-4 pt-4">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            className="rounded-2xl bg-black/5 px-3 py-2"
            onPress={() => router.back()}
            disabled={busy}
          >
            <Text className="font-bold">Hủy</Text>
          </Pressable>
          <Text className="font-bold">Chỉnh sửa bài viết</Text>
          <View style={{ width: 60 }} />
        </View>

        <TentapPostEditor
          value={content}
          onChange={setContent}
          onRequestImageUpload={requestImageUpload}
        />

        <View className="mt-4 space-y-3">
          <View>
            <Text className="mb-2 text-sm font-bold">Hiển thị</Text>
            <View className="overflow-hidden rounded-2xl border border-border/40 bg-card">
              <Picker
                selectedValue={visibility}
                onValueChange={(v) => setVisibility(v as PostVisibility)}
                mode="dropdown"
              >
                <Picker.Item label="Công khai" value="public" />
                <Picker.Item label="Bạn bè" value="friends" />
                <Picker.Item label="Chỉ mình tôi" value="private" />
              </Picker>
            </View>
          </View>
          <View>
            <Text className="mb-2 text-sm font-bold">Trạng thái đăng</Text>
            <View className="overflow-hidden rounded-2xl border border-border/40 bg-card">
              <Picker
                selectedValue={publicationStatus}
                onValueChange={(v) => setPublicationStatus(v as PostPublicationStatus)}
                mode="dropdown"
              >
                <Picker.Item label="Đã đăng" value="published" />
                <Picker.Item label="Nháp" value="draft" />
              </Picker>
            </View>
          </View>
        </View>

        <TextInput
          value={categoriesText}
          onChangeText={setCategoriesText}
          placeholder="Categories (comma separated)"
          className="mt-4 rounded-2xl border border-border/40 bg-card px-3 py-2 text-sm"
        />
        <TextInput
          value={tagsText}
          onChangeText={setTagsText}
          placeholder="Tags (comma separated)"
          className="mt-2 rounded-2xl border border-border/40 bg-card px-3 py-2 text-sm"
        />

        {mediaUrls.length > 0 ? (
          <View className="mt-4 space-y-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold">Media ảnh</Text>
              <Pressable
                className="rounded-2xl bg-black/5 px-4 py-3"
                onPress={() => setMediaUrls([])}
                disabled={busy}
              >
                <Text className="text-sm font-bold">Xóa</Text>
              </Pressable>
            </View>
            {mediaUrls[0] ? (
              <Image source={{ uri: mediaUrls[0] }} className="h-56 w-full rounded-2xl" />
            ) : null}
          </View>
        ) : null}

        <Pressable
          className="mt-6 rounded-2xl bg-blue-600 px-4 py-4"
          onPress={() => void onSubmit()}
          disabled={busy}
        >
          <Text className="text-center font-bold text-white">Lưu thay đổi</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
