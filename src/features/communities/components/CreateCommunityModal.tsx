import { useEffect, useState, useMemo } from "react";
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
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus, BookOpen, Globe2, Lock } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import { useCreateCommunityMutation } from "@/store/api/communityApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { normalizeMediaUrl } from "@/utils/url";
import { toast } from "@/utils/appToast";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type CommunityJoinPolicy,
  type CommunityType,
} from "@/types/community.types";
import { CATEGORY_LABEL } from "../constants";

export function CreateCommunityModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { primary, muted } = useIconColors();
  const [createCommunity, { isLoading: creating }] = useCreateCommunityMutation();
  const [uploadMedia] = useUploadMediaMutation();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("general");
  const [type, setType] = useState<CommunityType>("public");
  const [joinPolicy, setJoinPolicy] = useState<CommunityJoinPolicy>("open");
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");

  const [avatar, setAvatar] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setCategory("general");
      setType("public");
      setJoinPolicy("open");
      setRuleTitle("");
      setRuleDescription("");
      setAvatar("");
      setCoverUrl("");
    }
  }, [open]);

  const rules = useMemo(() => {
    if (!ruleTitle.trim() || !ruleDescription.trim()) return undefined;
    return [{ id: "rule-1", title: ruleTitle.trim(), description: ruleDescription.trim() }];
  }, [ruleDescription, ruleTitle]);

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
      const community = await createCommunity({
        name: name.trim(),
        description: description.trim() || null,
        avatar: avatar.trim() || null,
        coverUrl: coverUrl.trim() || null,
        category,
        type,
        joinPolicy,
        rules,
      }).unwrap();
      toast.success("Đã tạo cộng đồng");
      onClose();
      router.push(`/(main)/(communities)/${community.groupId}`);
    } catch {
      toast.error("Không tạo được cộng đồng");
    }
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="font-semibold text-foreground">Hủy</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Tạo cộng đồng</Text>
          <Pressable
            disabled={creating || !name.trim()}
            onPress={() => void submit()}
            className="rounded-xl bg-primary px-3 py-2 active:opacity-80 disabled:opacity-50"
          >
            <Text className="font-semibold text-primary-foreground">Tạo</Text>
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
                placeholder="Tên cộng đồng..."
                placeholderTextColor={muted}
                className="rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả cộng đồng..."
                placeholderTextColor={muted}
                multiline
                className="min-h-24 rounded-2xl border border-border bg-card px-4 py-3 text-foreground"
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

              <Text className="font-semibold text-foreground">Chế độ hiển thị</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setType("public")}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl border p-3.5 active:opacity-80 ${
                    type === "public" ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <Globe2 size={16} color={type === "public" ? primary : muted} />
                  <Text
                    className={`font-semibold ${type === "public" ? "text-primary" : "text-foreground"}`}
                  >
                    Công khai
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setType("private")}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl border p-3.5 active:opacity-80 ${
                    type === "private" ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <Lock size={16} color={type === "private" ? primary : muted} />
                  <Text
                    className={`font-semibold ${type === "private" ? "text-primary" : "text-foreground"}`}
                  >
                    Riêng tư
                  </Text>
                </Pressable>
              </View>

              <Text className="font-semibold text-foreground">Chính sách phê duyệt</Text>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setJoinPolicy("open")}
                  className={`flex-1 rounded-2xl border p-3.5 active:opacity-80 ${
                    joinPolicy === "open" ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${joinPolicy === "open" ? "text-primary" : "text-foreground"}`}
                  >
                    Tự do (Mở)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setJoinPolicy("approval")}
                  className={`flex-1 rounded-2xl border p-3.5 active:opacity-80 ${
                    joinPolicy === "approval"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <Text
                    className={`text-center font-semibold ${joinPolicy === "approval" ? "text-primary" : "text-foreground"}`}
                  >
                    Duyệt từ Admin
                  </Text>
                </Pressable>
              </View>

              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-1.5">
                  <BookOpen size={16} color={primary} />
                  <Text className="text-[14px] font-bold text-foreground">Nội quy đầu tiên</Text>
                </View>
                <TextInput
                  value={ruleTitle}
                  onChangeText={setRuleTitle}
                  placeholder="Tiêu đề nội quy (ví dụ: Tôn trọng lẫn nhau)"
                  placeholderTextColor={muted}
                  className="px-4.5 rounded-xl border border-border bg-background py-2.5 text-sm text-foreground"
                />
                <TextInput
                  value={ruleDescription}
                  onChangeText={setRuleDescription}
                  placeholder="Mô tả nội quy (ví dụ: Không dùng từ ngữ xúc phạm...)"
                  placeholderTextColor={muted}
                  className="px-4.5 rounded-xl border border-border bg-background py-2.5 text-sm text-foreground"
                />
              </View>
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}
