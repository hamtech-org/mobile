import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { Camera, Plus, BookOpen, Globe2, Lock, Users, ShieldCheck, X } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import { useUpdateCommunityMutation } from "@/store/api/communityApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { normalizeMediaUrl } from "@/utils/url";
import { toast } from "@/utils/appToast";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type CommunityType,
  type CommunityJoinPolicy,
  type ICommunity,
  type ICommunityRule,
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
  const [type, setType] = useState<CommunityType>(community.type);
  const [joinPolicy, setJoinPolicy] = useState<CommunityJoinPolicy>(community.joinPolicy);
  const [rules, setRules] = useState<ICommunityRule[]>(community.rules ?? []);

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
      setType(community.type);
      setJoinPolicy(community.joinPolicy);
      setRules(community.rules ?? []);
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
    const validRules = rules
      .map((r) => ({ id: r.id, title: r.title.trim(), description: r.description.trim() }))
      .filter((r) => r.title && r.description);

    try {
      await updateCommunity({
        groupId: community.groupId,
        body: {
          name: name.trim(),
          description: description.trim() || null,
          avatar: avatar.trim() || null,
          coverUrl: coverUrl.trim() || null,
          category,
          type,
          joinPolicy,
          rules: validRules.length ? validRules : undefined,
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
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
        >
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
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
              </ScrollView>

              <Text className="font-semibold text-foreground">Chế độ hiển thị</Text>
              <View className="gap-3">
                <Pressable
                  onPress={() => setType("public")}
                  className={`flex-row items-start gap-3 rounded-2xl border p-4 active:opacity-90 ${
                    type === "public" ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <View
                    className={`rounded-lg p-2 ${type === "public" ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <Globe2 size={18} color={type === "public" ? primary : muted} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text
                      className={`text-sm font-bold ${type === "public" ? "text-primary" : "text-foreground"}`}
                    >
                      Công khai
                    </Text>
                    <Text className="text-xs leading-normal text-muted-foreground">
                      Ai cũng có thể tìm thấy và xem các bài viết thảo luận trong nhóm.
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setType("private")}
                  className={`flex-row items-start gap-3 rounded-2xl border p-4 active:opacity-90 ${
                    type === "private" ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <View
                    className={`rounded-lg p-2 ${type === "private" ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <Lock size={18} color={type === "private" ? primary : muted} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text
                      className={`text-sm font-bold ${type === "private" ? "text-primary" : "text-foreground"}`}
                    >
                      Riêng tư
                    </Text>
                    <Text className="text-xs leading-normal text-muted-foreground">
                      Chỉ thành viên được duyệt mới có thể xem nội dung và danh sách thành viên.
                    </Text>
                  </View>
                </Pressable>
              </View>

              <Text className="font-semibold text-foreground">Chính sách tham gia</Text>
              <View className="gap-3">
                <Pressable
                  onPress={() => setJoinPolicy("open")}
                  className={`flex-row items-start gap-3 rounded-2xl border p-4 active:opacity-90 ${
                    joinPolicy === "open" ? "border-primary bg-primary/5" : "border-border bg-card"
                  }`}
                >
                  <View
                    className={`rounded-lg p-2 ${joinPolicy === "open" ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <Users size={18} color={joinPolicy === "open" ? primary : muted} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text
                      className={`text-sm font-bold ${joinPolicy === "open" ? "text-primary" : "text-foreground"}`}
                    >
                      Tự do tham gia
                    </Text>
                    <Text className="text-xs leading-normal text-muted-foreground">
                      Người dùng có thể gia nhập ngay lập tức mà không cần quản trị viên đồng ý.
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setJoinPolicy("approval")}
                  className={`flex-row items-start gap-3 rounded-2xl border p-4 active:opacity-90 ${
                    joinPolicy === "approval"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <View
                    className={`rounded-lg p-2 ${joinPolicy === "approval" ? "bg-primary/10" : "bg-muted"}`}
                  >
                    <ShieldCheck size={18} color={joinPolicy === "approval" ? primary : muted} />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text
                      className={`text-sm font-bold ${joinPolicy === "approval" ? "text-primary" : "text-foreground"}`}
                    >
                      Phê duyệt yêu cầu
                    </Text>
                    <Text className="text-xs leading-normal text-muted-foreground">
                      Người dùng gửi yêu cầu tham gia và cần quản trị viên duyệt để vào nhóm.
                    </Text>
                  </View>
                </Pressable>
              </View>

              <View className="gap-3 rounded-2xl border border-l-4 border-border/60 border-l-primary bg-muted/20 p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-1.5">
                    <BookOpen size={16} color={primary} />
                    <Text className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Nội quy cộng đồng ({rules.length})
                    </Text>
                  </View>
                  <Pressable
                    onPress={() =>
                      setRules([...rules, { id: `rule-${Date.now()}`, title: "", description: "" }])
                    }
                    className="flex-row items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 active:opacity-75"
                  >
                    <Plus size={14} color={primary} />
                    <Text className="text-xs font-semibold text-primary">Thêm nội quy</Text>
                  </Pressable>
                </View>

                {rules.length === 0 ? (
                  <Text className="py-2 text-center text-xs italic text-muted-foreground">
                    Chưa có nội quy nào. Hãy thêm nội quy để thành viên tuân thủ.
                  </Text>
                ) : (
                  <View className="gap-3">
                    {rules.map((rule, index) => (
                      <View
                        key={rule.id}
                        className="gap-3 rounded-xl border border-border/40 bg-background p-3"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text className="text-[11px] font-bold uppercase text-primary">
                            Nội quy #{index + 1}
                          </Text>
                          <Pressable
                            onPress={() => setRules(rules.filter((r) => r.id !== rule.id))}
                            className="rounded-lg p-1 active:bg-destructive/10"
                          >
                            <X size={16} color="#ef4444" />
                          </Pressable>
                        </View>

                        <View className="gap-1.5">
                          <Text className="text-[11px] font-semibold text-muted-foreground">
                            Tiêu đề nội quy
                          </Text>
                          <TextInput
                            value={rule.title}
                            onChangeText={(text) => {
                              const newRules = [...rules];
                              newRules[index] = { ...newRules[index], title: text };
                              setRules(newRules);
                            }}
                            placeholder="Ví dụ: Tôn trọng lẫn nhau"
                            placeholderTextColor={muted}
                            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </View>

                        <View className="gap-1.5">
                          <Text className="text-[11px] font-semibold text-muted-foreground">
                            Mô tả nội quy
                          </Text>
                          <TextInput
                            value={rule.description}
                            onChangeText={(text) => {
                              const newRules = [...rules];
                              newRules[index] = { ...newRules[index], description: text };
                              setRules(newRules);
                            }}
                            placeholder="Ví dụ: Không dùng từ ngữ xúc phạm..."
                            placeholderTextColor={muted}
                            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
