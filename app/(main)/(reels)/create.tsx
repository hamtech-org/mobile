import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { VideoView, useVideoPlayer } from "expo-video";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { useCreateReelMutation } from "@/store/api/newsfeedApi";
import type { PostVisibility } from "@/types/newsfeed.types";

type VisibilityOption = { key: PostVisibility; label: string; icon: string };

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  { key: "public", label: "Công khai", icon: "globe-outline" },
  { key: "friends", label: "Bạn bè", icon: "people-outline" },
  { key: "private", label: "Chỉ mình tôi", icon: "lock-closed-outline" },
];

/**
 * Màn hình tạo Reel mới cho mobile.
 * Flow: chọn video → preview → nhập caption + hashtags → upload → POST /reels.
 * Route: /(reels)/create
 */
export default function CreateReelScreen() {
  const router = useRouter();

  // Form state
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [videoType, setVideoType] = useState("video/mp4");
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");

  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();
  const [createReel, { isLoading: creating }] = useCreateReelMutation();

  const busy = uploading || creating;

  // Video player for preview
  const player = useVideoPlayer(videoUri ?? "", (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Pick video
  const handlePickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
      videoMaxDuration: 60,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    setVideoUri(asset.uri);
    setVideoName(asset.fileName ?? `reel_${Date.now()}.mp4`);
    setVideoType(asset.mimeType ?? "video/mp4");
    setVideoDuration(Math.round((asset.duration ?? 0) * 1000));
    setVideoWidth(asset.width ?? 0);
    setVideoHeight(asset.height ?? 0);
  }, []);

  // Submit
  const handleSubmit = useCallback(async () => {
    if (!videoUri || busy) return;

    try {
      // 1. Upload video
      const videoResult = await uploadMedia({
        file: { uri: videoUri, name: videoName, type: videoType },
        mediaType: "video",
        deliveryScope: "general",
      }).unwrap();

      const uploadedVideoUrl = videoResult?.url;
      if (!uploadedVideoUrl) throw new Error("Video upload failed");

      // 2. Parse hashtags
      const hashtags = hashtagsText
        .split(/[,\s#]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      // 3. Determine aspect ratio
      const ratio =
        videoWidth && videoHeight
          ? videoWidth / videoHeight < 0.7
            ? ("9:16" as const)
            : videoWidth / videoHeight < 0.9
              ? ("4:5" as const)
              : ("1:1" as const)
          : ("9:16" as const);

      // 4. Create reel
      await createReel({
        videoUrl: uploadedVideoUrl,
        thumbnailUrl: videoResult?.thumbnailUrl ?? "",
        caption: `${caption}${hashtags.length > 0 ? "\n" + hashtags.map((h) => `#${h}`).join(" ") : ""}`,
        durationMs: videoDuration,
        width: videoWidth,
        height: videoHeight,
        aspectRatio: ratio,
        visibility,
      }).unwrap();

      Alert.alert("Thành công", "Reel đã được tạo!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Không thể tạo reel";
      Alert.alert("Lỗi", msg);
    }
  }, [
    videoUri,
    busy,
    videoName,
    videoType,
    caption,
    hashtagsText,
    videoDuration,
    videoWidth,
    videoHeight,
    visibility,
    uploadMedia,
    createReel,
    router,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <ScreenHeader title="Tạo Reel" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Video picker / preview */}
          {videoUri ? (
            <View className="relative mb-4 overflow-hidden rounded-2xl bg-black">
              <VideoView
                player={player}
                style={{ width: "100%", height: 300 }}
                contentFit="contain"
                nativeControls={false}
              />
              <Pressable
                onPress={() => {
                  setVideoUri(null);
                  setVideoDuration(0);
                  setVideoWidth(0);
                  setVideoHeight(0);
                }}
                className="absolute right-2 top-2 size-8 items-center justify-center rounded-full bg-black/60"
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
              {videoDuration > 0 && (
                <View className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5">
                  <Text className="text-[11px] font-bold text-white">
                    {Math.floor(videoDuration / 60000)}:
                    {String(Math.floor((videoDuration % 60000) / 1000)).padStart(2, "0")}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Pressable
              onPress={handlePickVideo}
              className="mb-4 items-center justify-center rounded-2xl border-2 border-dashed border-border/60 py-16"
            >
              <View className="mb-3 size-16 items-center justify-center rounded-2xl bg-blue-600/10">
                <Ionicons name="videocam" size={32} color="#3b82f6" />
              </View>
              <Text className="text-sm font-semibold text-foreground">Chọn video</Text>
              <Text className="mt-1 text-xs text-muted-foreground">MP4, MOV — Tối đa 60 giây</Text>
            </Pressable>
          )}

          {/* Caption */}
          <View className="mb-4">
            <Text className="mb-1.5 text-xs font-medium text-muted-foreground">Mô tả</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Viết mô tả cho reel..."
              placeholderTextColor="hsl(220 10% 60%)"
              className="min-h-[80px] rounded-xl bg-muted/40 px-4 py-3 text-sm text-foreground"
              multiline
              textAlignVertical="top"
              maxLength={2200}
            />
          </View>

          {/* Hashtags */}
          <View className="mb-4">
            <Text className="mb-1.5 text-xs font-medium text-muted-foreground">Hashtags</Text>
            <TextInput
              value={hashtagsText}
              onChangeText={setHashtagsText}
              placeholder="du lịch, ẩm thực, công nghệ..."
              placeholderTextColor="hsl(220 10% 60%)"
              className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-foreground"
              maxLength={500}
            />
            <Text className="mt-1 text-[11px] text-muted-foreground">
              Ngăn cách bằng dấu phẩy hoặc khoảng trắng
            </Text>
          </View>

          {/* Visibility */}
          <View className="mb-4">
            <Text className="mb-1.5 text-xs font-medium text-muted-foreground">Quyền riêng tư</Text>
            <View className="flex-row gap-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setVisibility(opt.key)}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 ${
                    visibility === opt.key ? "bg-blue-600" : "bg-muted/50"
                  }`}
                >
                  <Ionicons
                    name={opt.icon as any}
                    size={14}
                    color={visibility === opt.key ? "#fff" : "hsl(220 10% 60%)"}
                  />
                  <Text
                    className={`text-xs font-semibold ${
                      visibility === opt.key ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Submit button */}
        <View className="absolute inset-x-0 bottom-0 border-t border-border/40 bg-background px-4 pb-8 pt-3">
          <Pressable
            onPress={handleSubmit}
            disabled={!videoUri || busy}
            className={`h-12 items-center justify-center rounded-xl ${
              !videoUri || busy ? "bg-muted" : "bg-blue-600"
            }`}
          >
            {busy ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-sm font-bold text-white">
                  {uploading ? "Đang tải video..." : "Đang tạo reel..."}
                </Text>
              </View>
            ) : (
              <Text
                className={`text-[15px] font-bold ${
                  !videoUri ? "text-muted-foreground" : "text-white"
                }`}
              >
                Đăng Reel
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
