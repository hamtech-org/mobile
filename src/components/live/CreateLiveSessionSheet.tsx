import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Check, Radio, Upload } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import {
  getLiveCategoryLabel,
  LIVE_CATEGORIES,
  LIVE_COVER_COLORS,
  useCreateLiveSessionMutation,
  type LiveCategory,
  type LiveCoverColor,
} from "@/store/api/liveApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { resolveLiveCoverBackground } from "@/utils/liveSessionUtils";
import { toast } from "@/utils/appToast";

const COVER_COLOR_KEYS = Object.keys(LIVE_COVER_COLORS) as LiveCoverColor[];

interface CreateLiveSessionSheetProps {
  open: boolean;
  onClose: () => void;
}

export function CreateLiveSessionSheet({ open, onClose }: CreateLiveSessionSheetProps) {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ["88%"], []);
  const { muted, primary } = useIconColors();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LiveCategory>("other");
  const [coverMode, setCoverMode] = useState<"color" | "image">("color");
  const [coverColor, setCoverColor] = useState<LiveCoverColor>("blue");
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  const [createSession, { isLoading: creating }] = useCreateLiveSessionMutation();
  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();

  const resetForm = useCallback(() => {
    setTitle("");
    setCategory("other");
    setCoverMode("color");
    setCoverColor("blue");
    setCoverImageUri(null);
    setCoverImageUrl(null);
  }, []);

  useEffect(() => {
    if (open) {
      bottomSheetRef.current?.expand();
    } else {
      bottomSheetRef.current?.close();
      resetForm();
    }
  }, [open, resetForm]);

  const previewCover = resolveLiveCoverBackground({
    coverImageUrl: coverMode === "image" && coverImageUri ? coverImageUri : undefined,
    coverColor: coverMode === "color" ? coverColor : undefined,
    hostUserId: "preview",
  });

  const previewTitle = title.trim() || "Tên phiên phát sóng hiển thị ở đây";
  const isSubmitting = creating || uploading;

  const handlePickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Cần quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setCoverMode("image");
    setCoverImageUri(asset.uri);
    setCoverImageUrl(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    try {
      let uploadedUrl = coverImageUrl;
      if (coverMode === "image" && coverImageUri && !uploadedUrl) {
        const name = coverImageUri.split("/").pop() ?? "cover.jpg";
        const uploaded = await uploadMedia({
          file: { uri: coverImageUri, name, type: "image/jpeg" },
          mediaType: "image",
          deliveryScope: "general",
        }).unwrap();
        uploadedUrl = uploaded.url;
        setCoverImageUrl(uploaded.url);
      }

      const body = {
        title: title.trim() || undefined,
        category,
        ...(coverMode === "image" && uploadedUrl ? { coverImageUrl: uploadedUrl } : { coverColor }),
      };

      const session = await createSession(body).unwrap();
      onClose();
      router.replace(`/(main)/(live)/${session.sessionId}/host`);
    } catch {
      toast.error("Không thể tạo phiên live");
    }
  }, [
    category,
    coverColor,
    coverImageUri,
    coverImageUrl,
    coverMode,
    createSession,
    onClose,
    title,
    uploadMedia,
  ]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
        pressBehavior="close"
        onPress={onClose}
      />
    ),
    [onClose],
  );

  if (!open) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: muted, width: 40 }}
    >
      <BottomSheetScrollView className="px-4 pb-8" keyboardShouldPersistTaps="handled">
        <View className="mb-4 flex-row items-center gap-2">
          <Radio size={20} color={primary} />
          <Text className="text-lg font-semibold text-foreground">Tạo phiên live</Text>
        </View>

        <Text className="mb-1 text-sm text-muted-foreground">Tiêu đề</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Nhập tiêu đề phiên..."
          className="mb-4 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-foreground"
          maxLength={120}
        />

        <Text className="mb-1 text-sm text-muted-foreground">Danh mục</Text>
        <View className="mb-4 overflow-hidden rounded-xl border border-border">
          <Picker selectedValue={category} onValueChange={(v) => setCategory(v as LiveCategory)}>
            {LIVE_CATEGORIES.map((c) => (
              <Picker.Item key={c.value} label={c.label} value={c.value} />
            ))}
          </Picker>
        </View>

        <Text className="mb-2 text-sm text-muted-foreground">Ảnh bìa</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {COVER_COLOR_KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => {
                setCoverMode("color");
                setCoverColor(key);
                setCoverImageUri(null);
                setCoverImageUrl(null);
              }}
              className="size-11 items-center justify-center rounded-full border-2"
              style={{
                backgroundColor: LIVE_COVER_COLORS[key],
                borderColor: coverMode === "color" && coverColor === key ? primary : "transparent",
              }}
            >
              {coverMode === "color" && coverColor === key ? (
                <Check size={18} color="#fff" />
              ) : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => void handlePickImage()}
            className="h-11 flex-row items-center gap-1 rounded-full border border-border bg-muted/40 px-3"
          >
            <Upload size={16} color={primary} />
            <Text className="text-xs font-medium text-foreground">Tải ảnh</Text>
          </Pressable>
        </View>

        <Text className="mb-2 text-sm text-muted-foreground">Xem trước</Text>
        <View className="mb-5 overflow-hidden rounded-2xl border border-border">
          <View className="relative aspect-video w-full">
            {previewCover.type === "image" ? (
              <Image
                source={{ uri: previewCover.url }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full" style={{ backgroundColor: previewCover.color }} />
            )}
            <View className="absolute inset-0 justify-end bg-black/30 p-3">
              <Text className="text-[10px] font-semibold uppercase text-white/80">
                {getLiveCategoryLabel(category)}
              </Text>
              <Text className="text-base font-semibold text-white" numberOfLines={2}>
                {previewTitle}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={isSubmitting}
          className="mb-6 items-center rounded-xl bg-primary py-3 active:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-primary-foreground">Bắt đầu phát sóng</Text>
          )}
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}
