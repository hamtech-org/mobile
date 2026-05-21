import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import { useUpdateCommunityMutation } from "@/store/api/communityApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { normalizeMediaUrl } from "@/utils/url";
import { toast } from "@/utils/appToast";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type ICommunity,
} from "@/types/community.types";
import { CATEGORY_LABEL } from "../constants";

export interface EditCommunityModalProps {
  community: ICommunity;
  open: boolean;
  onClose: () => void;
}

export function EditCommunityModal({ community, open, onClose }: EditCommunityModalProps) {
  const { primary, muted } = useIconColors();
  const [updateCommunity, { isLoading }] = useUpdateCommunityMutation();
  const [uploadMedia] = useUploadMediaMutation();

  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description ?? "");
  const [category, setCategory] = useState<CommunityCategory>(community.category);

  const [avatar, setAvatar] = useState(community.avatar ?? "");
  const [coverUrl, setCoverUrl] = useState(community.coverUrl ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (open) {
      setName(community.name);
      setDescription(community.description ?? "");
      setCategory(community.category);
      setAvatar(community.avatar ?? "");
      setCoverUrl(community.coverUrl ?? "");
    }
  }, [community, open]);

  const pickImage = async (target: "avatar" | "cover") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Cần quyền thư viện ảnh");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];

    if (target === "avatar") setUploadingAvatar(true);
    else setUploadingCover(true);

    try {
      const file = await prepareLocalFileForUpload({
        uri: asset.uri,
        name: asset.fileName ?? `${target}.jpg`,
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      const up = await uploadMedia({
        file: { uri: file.uri, name: file.name, type: file.type },
        mediaType: "image",
      }).unwrap();
      const url = up.url?.trim();
      if (url) {
        if (target === "avatar") {
          setAvatar(url);
          toast.success("Đã tải ảnh đại diện lên");
        } else {
          setCoverUrl(url);
          toast.success("Đã tải ảnh bìa lên");
        }
      }
    } catch {
      toast.error("Không tải được ảnh");
    } finally {
      if (target === "avatar") setUploadingAvatar(false);
      else setUploadingCover(false);
    }
  };

  const submit = async (): Promise<void> => {
    if (!name.trim()) return;
    try {
      await updateCommunity({
        groupId: community.groupId,
        body: {
          name: name.trim(),
          description: description.trim() || null,
          avatar: avatar.trim() || null,
          coverUrl: coverUrl.trim() || null,
          category,
          type: community.type,
          joinPolicy: community.joinPolicy,
          rules: community.rules,
        },
      }).unwrap();
      toast.success("Đã cập nhật cộng đồng");
      onClose();
    } catch {
      toast.error("Không cập nhật được cộng đồng");
    }
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="font-semibold text-foreground">Hủy</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Chỉnh sửa</Text>
          <Pressable
            disabled={isLoading || !name.trim()}
            onPress={() => void submit()}
            className="rounded-xl bg-primary px-3 py-2 active:opacity-80 disabled:opacity-50"
          >
            <Text className="font-semibold text-primary-foreground">Lưu</Text>
          </Pressable>
        </View>
        <FlatList
          data={[0]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={{ padding: 16, gap: 16 }}
          renderItem={() => (
            <View className="gap-4">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Tên cộng đồng"
                placeholderTextColor={muted}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả"
                placeholderTextColor={muted}
                multiline
                className="min-h-28 rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
              />

              <View className="gap-2">
                <Text className="font-semibold text-foreground">Hình ảnh cộng đồng</Text>
                <View className="relative w-full" style={{ height: 160 }}>
                  {/* Cover Container */}
                  <View className="h-full w-full overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30">
                    <Pressable
                      onPress={() => void pickImage("cover")}
                      disabled={uploadingCover}
                      className="size-full items-center justify-center"
                    >
                      {normalizeMediaUrl(coverUrl) ? (
                        <Image
                          source={{ uri: normalizeMediaUrl(coverUrl) }}
                          className="size-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="items-center gap-1.5">
                          {uploadingCover ? (
                            <ActivityIndicator color={primary} size="small" />
                          ) : (
                            <>
                              <Camera size={22} color={muted} />
                              <Text className="text-xs font-semibold text-muted-foreground">
                                Tải lên ảnh bìa
                              </Text>
                            </>
                          )}
                        </View>
                      )}
                    </Pressable>
                  </View>

                  {/* Avatar Container */}
                  <View
                    className="absolute -bottom-8 left-4 size-20 border-4 border-background bg-card shadow-lg"
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      overflow: "hidden",
                      elevation: 5,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 3,
                    }}
                  >
                    <Pressable
                      onPress={() => void pickImage("avatar")}
                      disabled={uploadingAvatar}
                      className="size-full items-center justify-center"
                      style={{ borderRadius: 40, overflow: "hidden" }}
                    >
                      {normalizeMediaUrl(avatar) ? (
                        <Image
                          source={{ uri: normalizeMediaUrl(avatar) }}
                          className="size-full"
                          style={{ width: "100%", height: "100%", borderRadius: 40 }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          className="size-full items-center justify-center bg-primary/10"
                          style={{ borderRadius: 40 }}
                        >
                          {uploadingAvatar ? (
                            <ActivityIndicator color={primary} size="small" />
                          ) : (
                            <Camera size={18} color={primary} />
                          )}
                        </View>
                      )}
                    </Pressable>
                  </View>
                </View>
                <View style={{ height: 32 }} />
              </View>

              <Text className="font-semibold text-foreground">Chủ đề</Text>
              <View className="flex-row flex-wrap gap-2">
                {COMMUNITY_CATEGORIES.map((item) => {
                  const active = category === item;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCategory(item)}
                      className={`rounded-full border px-4 py-2 active:opacity-80 ${
                        active ? "border-primary bg-primary" : "border-border bg-card"
                      }`}
                    >
                      <Text
                        className={
                          active
                            ? "font-semibold text-primary-foreground"
                            : "font-semibold text-foreground"
                        }
                      >
                        {CATEGORY_LABEL[item]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
