import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  DeviceEventEmitter,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCreatePostMutation } from "@/store/api/newsfeedApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { useVideoPlayer, VideoView } from "expo-video";
import type { PostPublicationStatus, PostVisibility } from "@/types/newsfeed.types";
import TentapPostEditor from "@/components/newsfeed/TentapPostEditor";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import {
  Globe,
  Image as ImageIcon,
  MapPin,
  MoreHorizontal,
  Smile,
  UserPlus,
  Users,
  Lock,
  X,
  Pencil,
} from "lucide-react-native";
import { extractHashtags } from "@/utils/extractHashtags";

const MAX_MEDIA = 10;

/** Local asset not yet uploaded, or already-uploaded remote URL. */
type MobileMediaItem =
  | {
      kind: "local";
      localUri: string;
      fileName: string;
      mimeType: string;
      assetType: "image" | "video";
    }
  | { kind: "remote"; url: string };

/** Determines whether a URL/URI is likely a video */
const isVideoUrl = (url: string): boolean =>
  /\.(mp4|webm|mov|avi|mkv)/i.test(url) || url.includes("video");

const VideoPreviewPlayer = ({ url }: { url: string }) => {
  const player = useVideoPlayer(url);
  return (
    <VideoView
      style={{ width: "100%", height: "100%" }}
      player={player}
      allowsFullscreen
      nativeControls
      contentFit="cover"
    />
  );
};

export default function NewPostEditorScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const currentUser = useSelector((state: RootState) => state.auth.user);

  const emptyDoc = useMemo(
    () => JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
    [],
  );

  const [content, setContent] = useState<string>(() => emptyDoc);
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [mediaItems, setMediaItems] = useState<MobileMediaItem[]>([]);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);

  const postType: "text" | "image" = mediaItems.length > 0 ? "image" : "text";
  const previewUris = mediaItems.map((item) => (item.kind === "local" ? item.localUri : item.url));
  const hasContent = content !== emptyDoc || mediaItems.length > 0;

  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();
  const [createPost, { isLoading: creating }] = useCreatePostMutation();

  /** Stage assets locally – NO upload yet. Show instant local preview. */
  const requestImageUpload = async (): Promise<void> => {
    const remaining = MAX_MEDIA - mediaItems.length;
    if (remaining <= 0) return;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });

    if (res.canceled || !res.assets?.length) return;

    const newItems: MobileMediaItem[] = res.assets.map((asset) => ({
      kind: "local",
      localUri: asset.uri,
      fileName: asset.fileName ?? "post.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
      assetType: asset.type === "video" ? "video" : "image",
    }));

    setMediaItems((prev) => [...prev, ...newItems].slice(0, MAX_MEDIA));
  };

  /** Upload staged items then create/save the post. */
  const onSubmit = async (status: PostPublicationStatus = "published") => {
    if (!hasContent) return;

    const tags = extractHashtags(content);

    // 1. Upload all locally staged items sequentially
    const uploadedUrls: string[] = [];
    const localItems = mediaItems.filter(
      (item): item is Extract<MobileMediaItem, { kind: "local" }> => item.kind === "local",
    );
    for (const item of localItems) {
      try {
        const file = await prepareLocalFileForUpload({
          uri: item.localUri,
          name: item.fileName,
          mimeType: item.mimeType,
        });
        const up = await uploadMedia({
          file: { uri: file.uri, name: file.name, type: file.type },
          mediaType: item.assetType === "video" ? "video" : "image",
          deliveryScope: "general",
        }).unwrap();
        const url = up?.url?.trim();
        if (url) uploadedUrls.push(url);
      } catch {
        // skip failed uploads, continue
      }
    }

    // 2. Build final ordered mediaUrls (preserve insertion order)
    let uploadedIdx = 0;
    const finalMediaUrls = mediaItems
      .map((item) => {
        if (item.kind === "remote") return item.url;
        return uploadedUrls[uploadedIdx++] ?? null;
      })
      .filter((u): u is string => !!u);

    const payload = {
      content: content.trim() || emptyDoc,
      type: postType,
      visibility,
      publicationStatus: status,
      ...(groupId ? { groupId, communityId: groupId } : {}),
      categories: [] as string[],
      tags,
      mediaUrls: finalMediaUrls,
    };

    const res = await createPost(payload).unwrap();
    if (res && status === "published") {
      DeviceEventEmitter.emit("post:created", res);
    }
    router.replace(groupId ? `/(main)/(communities)/${groupId}` : "/(main)/(newsfeed)");
  };

  const handleCancel = () => {
    if (!hasContent) {
      router.back();
      return;
    }
    Alert.alert("Lưu bản nháp?", "Bạn có muốn lưu bài viết này vào mục nháp không?", [
      {
        text: "Bỏ qua",
        style: "destructive",
        onPress: () => router.back(),
      },
      {
        text: "Lưu nháp",
        onPress: () => void onSubmit("draft"),
      },
      {
        text: "Tiếp tục chỉnh sửa",
        style: "cancel",
      },
    ]);
  };

  const busy = creating || uploading;
  const isSubmitDisabled = busy || !hasContent;

  const PrivacyIcon = visibility === "public" ? Globe : visibility === "friends" ? Users : Lock;
  const privacyText =
    visibility === "public" ? "Công khai" : visibility === "friends" ? "Bạn bè" : "Chỉ mình tôi";

  const handleRemoveMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <Pressable onPress={handleCancel} disabled={busy} className="-ml-2 p-2">
            <Text className="text-lg font-bold">Hủy</Text>
          </Pressable>
          <Text className="text-lg font-bold">Tạo bài viết</Text>
          <Pressable
            onPress={() => void onSubmit("published")}
            disabled={isSubmitDisabled}
            className={`rounded-full px-4 py-1.5 ${isSubmitDisabled ? "bg-black/10 dark:bg-white/10" : "bg-blue-600"}`}
          >
            <Text
              className={`font-bold ${isSubmitDisabled ? "text-black/30 dark:text-white/30" : "text-white"}`}
            >
              {busy ? "Đang đăng..." : "Đăng"}
            </Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* User Info */}
          <View className="mb-4 flex-row items-center gap-3">
            <View className="size-11 items-center justify-center overflow-hidden rounded-full bg-muted/40">
              {currentUser?.avatar ? (
                <Image
                  source={{ uri: currentUser.avatar }}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Text className="font-bold text-muted-foreground">
                  {currentUser?.displayName?.charAt(0) || "U"}
                </Text>
              )}
            </View>
            <View>
              <Text className="text-[15px] font-bold">{currentUser?.displayName}</Text>
              <View className="mt-1 flex-row items-center gap-2">
                <Pressable
                  onPress={() => setIsMoreOpen(true)}
                  className="flex-row items-center gap-1.5 rounded-md bg-blue-100 px-2.5 py-1 dark:bg-blue-900/40"
                >
                  <PrivacyIcon size={12} color="#3b82f6" />
                  <Text className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    {privacyText}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Editor */}
          <View className="min-h-[150px]">
            <TentapPostEditor
              value={content}
              onChange={setContent}
              placeholderText={`${currentUser?.displayName?.split(" ").pop() || "Bạn"} ơi, bạn đang nghĩ gì thế?`}
            />
          </View>

          {/* Media gallery preview */}
          {previewUris.length > 0 && (
            <View className="mt-3">
              {previewUris.length === 1 ? (
                /* Single media */
                <View
                  className="relative w-full overflow-hidden rounded-2xl"
                  style={{ aspectRatio: 4 / 3 }}
                >
                  {mediaItems[0]?.kind === "local" ? (
                    mediaItems[0].assetType === "video" ? (
                      <View className="relative h-full w-full bg-black">
                        <VideoPreviewPlayer url={previewUris[0]} />
                      </View>
                    ) : (
                      <Image
                        source={{ uri: previewUris[0] }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    )
                  ) : isVideoUrl(previewUris[0]) ? (
                    <View className="relative h-full w-full bg-black">
                      <VideoPreviewPlayer url={previewUris[0]} />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: previewUris[0] }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  )}
                  <Pressable
                    className="absolute right-2 top-2 rounded-full bg-black/50 p-2"
                    onPress={() => handleRemoveMedia(0)}
                  >
                    <X size={14} color="#fff" />
                  </Pressable>
                  {mediaItems[0]?.kind === "local" && (
                    <View className="absolute bottom-2 left-2 rounded bg-orange-500/90 px-2 py-0.5">
                      <Text className="text-[9px] font-bold text-white">Chưa lưu</Text>
                    </View>
                  )}
                </View>
              ) : (
                /* Grid gallery */
                <View className="flex-row flex-wrap justify-between gap-y-2">
                  {mediaItems.slice(0, 4).map((item, index) => {
                    const uri = item.kind === "local" ? item.localUri : item.url;
                    const isVideo =
                      item.kind === "local" ? item.assetType === "video" : isVideoUrl(uri);
                    return (
                      <View
                        key={`preview-${index}`}
                        className="relative overflow-hidden rounded-xl"
                        style={{ width: "48.5%", aspectRatio: 1 }}
                      >
                        {isVideo ? (
                          <View className="relative h-full w-full bg-black">
                            <VideoPreviewPlayer url={uri} />
                          </View>
                        ) : (
                          <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                        )}
                        {index === 3 && previewUris.length > 4 && (
                          <View className="absolute inset-0 items-center justify-center bg-black/50">
                            <Text className="text-xl font-bold text-white">
                              +{previewUris.length - 4}
                            </Text>
                          </View>
                        )}
                        {mediaItems[index]?.kind === "local" && (
                          <View className="absolute bottom-1 left-1 rounded bg-orange-500/90 px-1.5 py-0.5">
                            <Text className="text-[8px] font-bold text-white">Chưa lưu</Text>
                          </View>
                        )}
                        <Pressable
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5"
                          onPress={() => handleRemoveMedia(index)}
                        >
                          <X size={12} color="#fff" />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Manage media button */}
              <Pressable
                onPress={() => setIsMediaManagerOpen(true)}
                className="mt-2 flex-row items-center justify-center gap-2 rounded-xl border border-border/60 py-2.5"
              >
                <Pencil size={14} color="#9ca3af" />
                <Text className="text-sm font-medium text-muted-foreground">
                  Quản lý media ({previewUris.length}/{MAX_MEDIA})
                </Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Add to Post Footer */}
        <View className="flex-row items-center justify-between border-t border-border/40 bg-card p-3">
          <Text className="ml-2 font-semibold">Thêm vào bài viết</Text>
          <View className="flex-row items-center gap-1">
            <Pressable
              className="p-2"
              onPress={requestImageUpload}
              disabled={busy || mediaItems.length >= MAX_MEDIA}
            >
              <ImageIcon size={24} color="#22c55e" />
            </Pressable>
            <Pressable className="p-2" disabled={busy}>
              <UserPlus size={24} color="#3b82f6" />
            </Pressable>
            <Pressable className="p-2" disabled={busy}>
              <Smile size={24} color="#eab308" />
            </Pressable>
            <Pressable className="p-2" disabled={busy}>
              <MapPin size={24} color="#ef4444" />
            </Pressable>
            <Pressable className="p-2" onPress={() => setIsMoreOpen(true)} disabled={busy}>
              <MoreHorizontal size={24} color="#9ca3af" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* More Options Modal – Visibility only */}
      <Modal visible={isMoreOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="space-y-4 rounded-t-3xl bg-background p-5 pb-8">
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Tùy chọn khác</Text>
              <Pressable onPress={() => setIsMoreOpen(false)} className="rounded-full bg-muted p-2">
                <X size={16} color="#666" />
              </Pressable>
            </View>

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
          </View>
        </View>
      </Modal>

      {/* Media Manager Modal */}
      <Modal visible={isMediaManagerOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-background p-5 pb-8" style={{ maxHeight: "80%" }}>
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold">Quản lý media</Text>
              <Pressable
                onPress={() => setIsMediaManagerOpen(false)}
                className="rounded-full bg-muted p-2"
              >
                <X size={16} color="#666" />
              </Pressable>
            </View>

            <ScrollView className="mb-4">
              <View className="flex-row flex-wrap justify-between gap-y-2">
                {mediaItems.map((item, index) => {
                  const uri = item.kind === "local" ? item.localUri : item.url;
                  const isVideo =
                    item.kind === "local" ? item.assetType === "video" : isVideoUrl(uri);
                  return (
                    <View
                      key={`manage-${index}`}
                      className="relative overflow-hidden rounded-xl"
                      style={{ width: "48.5%", aspectRatio: 1 }}
                    >
                      {isVideo ? (
                        <View className="relative h-full w-full bg-black">
                          <VideoPreviewPlayer url={uri} />
                        </View>
                      ) : (
                        <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                      )}
                      <Pressable
                        onPress={() => handleRemoveMedia(index)}
                        className="absolute right-1.5 top-1.5 rounded-lg bg-red-600/80 p-1.5"
                      >
                        <X size={12} color="#fff" />
                      </Pressable>
                      <View className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5">
                        <Text className="text-[10px] font-bold text-white">{index + 1}</Text>
                      </View>
                      {item.kind === "local" && (
                        <View className="absolute bottom-1.5 right-8 rounded bg-orange-500/90 px-1.5 py-0.5">
                          <Text className="text-[8px] font-bold text-white">Chưa lưu</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {mediaItems.length < MAX_MEDIA && (
                <Pressable
                  onPress={requestImageUpload}
                  disabled={uploading}
                  className="mt-3 items-center justify-center rounded-xl border-2 border-dashed border-border/60 py-4"
                >
                  <Text className="text-sm font-medium text-muted-foreground">
                    + Thêm media ({mediaItems.length}/{MAX_MEDIA})
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            <Pressable
              onPress={() => setIsMediaManagerOpen(false)}
              className="items-center rounded-xl bg-blue-600 py-3"
            >
              <Text className="font-bold text-white">Xong</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
