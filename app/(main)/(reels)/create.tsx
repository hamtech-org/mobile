import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSelector } from "react-redux";

import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { newsfeedApi } from "@/store/api/newsfeedApi";
import type { RootState } from "@/store/store";
import { store } from "@/store/store";
import {
  uploadStarted,
  setProgress,
  uploadCompleted,
  uploadFailed,
} from "@/store/slices/reelUploadSlice";
import { toast } from "@/utils/appToast";
import type { PostVisibility } from "@/types/newsfeed.types";
import { env } from "@/config/env";

type VisibilityOption = { key: PostVisibility; label: string; icon: string };

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  { key: "public", label: "Công khai", icon: "globe-outline" },
  { key: "friends", label: "Bạn bè", icon: "people-outline" },
  { key: "private", label: "Chỉ mình tôi", icon: "lock-closed-outline" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreateReelScreen() {
  const router = useRouter();
  const token = useSelector((state: RootState) => state.auth?.accessToken);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [videoType, setVideoType] = useState("video/mp4");
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [videoFileSize, setVideoFileSize] = useState(0);
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("public");
  const [submitting, setSubmitting] = useState(false);

  const player = useVideoPlayer(videoUri ?? "", (p) => {
    p.loop = true;
    p.muted = true;
  });

  const handlePickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      // iOS: native transcode at medium quality (~50-60% smaller file)
      // Android: quality param is ignored for videos
      quality: 0.6,
      videoMaxDuration: 600,
    });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    setVideoUri(asset.uri);
    setVideoName(asset.fileName ?? `reel_${Date.now()}.mp4`);
    setVideoType(asset.mimeType ?? "video/mp4");
    setVideoDuration(Math.round(asset.duration ?? 0));
    setVideoWidth(asset.width ?? 0);
    setVideoHeight(asset.height ?? 0);
    setVideoFileSize(asset.fileSize ?? 0);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!videoUri || submitting) return;

    // Capture everything needed before component possibly unmounts
    const uri = videoUri;
    const name = videoName;
    const mime = videoType.trim() || "video/mp4";
    const duration = videoDuration;
    const width = videoWidth;
    const height = videoHeight;
    const captionText = caption;
    const hashtagsRaw = hashtagsText;
    const vis = visibility;
    const authToken = token;

    const hashtags = hashtagsRaw
      .split(/[,\s#]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    const ratio =
      width && height
        ? width / height < 0.7
          ? ("9:16" as const)
          : width / height < 0.9
            ? ("4:5" as const)
            : ("1:1" as const)
        : ("9:16" as const);

    const fullCaption = `${captionText}${hashtags.length > 0 ? "\n" + hashtags.map((h) => `#${h}`).join(" ") : ""}`;

    setSubmitting(true);
    store.dispatch(uploadStarted());

    // Navigate immediately — banner takes over
    router.replace("/(main)/(reels)");

    // XHR continues after navigation — callbacks use store.dispatch (not component state)
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        store.dispatch(setProgress(e.loaded / e.total));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let uploadedUrl: string | null = null;
        let thumbnailUrl: string | null = null;

        try {
          const envelope = JSON.parse(xhr.responseText) as {
            success: boolean;
            data: { url: string; thumbnailUrl: string | null };
            message?: string;
          };
          if (envelope.success && envelope.data?.url) {
            uploadedUrl = envelope.data.url;
            thumbnailUrl = envelope.data.thumbnailUrl;
          }
        } catch {
          store.dispatch(uploadFailed("Phản hồi upload không hợp lệ"));
          return;
        }

        if (!uploadedUrl) {
          store.dispatch(uploadFailed("Upload thất bại"));
          return;
        }

        // Create reel via store.dispatch — component may be unmounted at this point
        store
          .dispatch(
            newsfeedApi.endpoints.createReel.initiate({
              videoUrl: uploadedUrl,
              thumbnailUrl: thumbnailUrl ?? undefined,
              caption: fullCaption,
              durationMs: duration,
              width,
              height,
              aspectRatio: ratio,
              visibility: vis,
            }),
          )
          .then((result) => {
            if ("error" in result) {
              store.dispatch(uploadFailed("Không thể tạo reel"));
            } else {
              store.dispatch(uploadCompleted());
              toast.success("Reel đã được đăng!");
            }
          })
          .catch(() => {
            store.dispatch(uploadFailed("Không thể tạo reel"));
          });
      } else if (xhr.status === 401) {
        store.dispatch(uploadFailed("Phiên đăng nhập hết hạn"));
      } else {
        store.dispatch(uploadFailed(`Upload thất bại (${xhr.status})`));
      }
    };

    xhr.onerror = () => store.dispatch(uploadFailed("Lỗi kết nối mạng"));
    xhr.ontimeout = () => store.dispatch(uploadFailed("Upload quá thời gian"));

    const base = env.apiBaseUrl.replace(/\/$/, "");
    xhr.open("POST", `${base}/media/upload`);
    xhr.timeout = 120_000;
    if (authToken) xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);

    const formData = new FormData();
    formData.append("file", { uri, name, type: mime } as unknown as Blob);
    formData.append("mediaType", "video");
    formData.append("deliveryScope", "general");

    xhr.send(formData);
  }, [
    videoUri,
    submitting,
    videoName,
    videoType,
    videoDuration,
    videoWidth,
    videoHeight,
    caption,
    hashtagsText,
    visibility,
    token,
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
                  setVideoFileSize(0);
                }}
                className="absolute right-2 top-2 size-8 items-center justify-center rounded-full bg-black/60"
              >
                <Ionicons name="close" size={18} color="#fff" />
              </Pressable>
              <View className="absolute bottom-2 left-2 flex-row gap-2">
                {videoDuration > 0 && (
                  <View className="rounded bg-black/70 px-2 py-0.5">
                    <Text className="text-[11px] font-bold text-white">
                      {Math.floor(videoDuration / 60000)}:
                      {String(Math.floor((videoDuration % 60000) / 1000)).padStart(2, "0")}
                    </Text>
                  </View>
                )}
                {videoFileSize > 0 && (
                  <View className="rounded bg-black/70 px-2 py-0.5">
                    <Text className="text-[11px] text-white">{formatBytes(videoFileSize)}</Text>
                  </View>
                )}
              </View>
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
              <Text className="mt-1 text-xs text-muted-foreground">MP4, MOV — Tối đa 10 phút</Text>
            </Pressable>
          )}

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
                    name={opt.icon as never}
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

        <View className="absolute inset-x-0 bottom-0 border-t border-border/40 bg-background px-4 pb-8 pt-3">
          <Pressable
            onPress={handleSubmit}
            disabled={!videoUri || submitting}
            className={`h-12 items-center justify-center rounded-xl ${
              !videoUri || submitting ? "bg-muted" : "bg-blue-600"
            }`}
          >
            {submitting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator size="small" color="#fff" />
                <Text className="text-sm font-bold text-white">Đang chuẩn bị...</Text>
              </View>
            ) : (
              <Text
                className={`text-[15px] font-bold ${!videoUri ? "text-muted-foreground" : "text-white"}`}
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
