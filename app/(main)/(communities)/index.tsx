import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import { BookOpen, Camera, Globe2, Lock, Plus, Search, Sparkles, Users } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import {
  useCreateCommunityMutation,
  useListCommunitiesQuery,
  useLazySearchGroupsQuery,
} from "@/store/api/communityApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type CommunityJoinPolicy,
  type CommunityType,
  type ICommunity,
  type ISearchGroupResult,
} from "@/types/community.types";
import { toast } from "@/utils/appToast";
const defaultAvatarGroup = require("../../../assets/images/avatar-group-default..jpg");
const defaultCoverGroup = require("../../../assets/images/cover-group-default..jpg");

const CATEGORY_LABEL: Record<CommunityCategory, string> = {
  general: "Chung",
  technology: "Công nghệ",
  sports: "Thể thao",
  music: "Nhạc",
  education: "Giáo dục",
  gaming: "Gaming",
  lifestyle: "Đời sống",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function CategoryChip({
  category,
  active,
  onPress,
}: {
  category: CommunityCategory;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-4 py-2 active:opacity-80 ${
        active ? "border-primary bg-primary" : "border-border bg-card"
      }`}
    >
      <Text
        className={
          active ? "font-semibold text-primary-foreground" : "font-semibold text-foreground"
        }
      >
        {CATEGORY_LABEL[category]}
      </Text>
    </Pressable>
  );
}

function CommunityCard({ item }: { item: ICommunity }) {
  const isSearchItem = !(item as any).isActive && !(item as any).ownerId;
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(communities)/${item.groupId}`)}
      className="overflow-hidden rounded-2xl border border-border bg-card active:opacity-85"
    >
      <Image
        source={item.coverUrl ? { uri: item.coverUrl } : defaultCoverGroup}
        className="h-20 w-full"
        resizeMode="cover"
      />
      <View className="gap-4 p-4">
        <View className="flex-row items-start gap-3">
          <Image
            source={item.avatar ? { uri: item.avatar } : defaultAvatarGroup}
            className="-mt-10 size-16 rounded-2xl border-4 border-card"
            resizeMode="cover"
          />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 text-lg font-bold text-card-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              <View className="rounded-full bg-muted px-3 py-1">
                <Text className="text-xs font-semibold text-muted-foreground">
                  {CATEGORY_LABEL[item.category] || "Chung"}
                </Text>
              </View>
            </View>
            <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={2}>
              {item.description || "Cộng đồng chưa có mô tả."}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          <View className="flex-1 rounded-xl bg-muted/60 px-3 py-2">
            <Text className="font-bold text-foreground">{item.memberCount ?? 0}</Text>
            <Text className="text-xs text-muted-foreground">thành viên</Text>
          </View>
          <View className="flex-1 rounded-xl bg-muted/60 px-3 py-2">
            <Text className="font-bold text-foreground">
              {isSearchItem ? "-" : (item.postCount ?? 0)}
            </Text>
            <Text className="text-xs text-muted-foreground">bài viết</Text>
          </View>
          <View className="flex-1 rounded-xl bg-muted/60 px-3 py-2">
            <Text className="font-bold text-foreground">
              {item.type === "private" ? "Riêng" : "Mở"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {item.joinPolicy === "approval" ? "cần duyệt" : "tham gia"}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function CommunitySkeleton() {
  const opacity = useMemo(() => new Animated.Value(0.3), []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={{ opacity }}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      <View className="h-20 bg-muted" />
      <View className="gap-4 p-4">
        <View className="flex-row items-start gap-3">
          <View className="-mt-10 size-16 rounded-2xl border-4 border-card bg-muted" />
          <View className="min-w-0 flex-1 gap-2">
            <View className="h-5 w-1/2 rounded bg-muted" />
            <View className="h-4 w-full rounded bg-muted" />
            <View className="h-4 w-3/4 rounded bg-muted" />
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="h-12 flex-1 rounded-xl bg-muted/60" />
          <View className="h-12 flex-1 rounded-xl bg-muted/60" />
          <View className="h-12 flex-1 rounded-xl bg-muted/60" />
        </View>
      </View>
    </Animated.View>
  );
}

export default function CommunitiesScreen() {
  const { primary, foreground, muted } = useIconColors();
  const [category, setCategory] = useState<CommunityCategory>("general");
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<CommunityType>("public");
  const [joinPolicy, setJoinPolicy] = useState<CommunityJoinPolicy>("open");
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleDescription, setRuleDescription] = useState("");

  // Avatar & Cover states
  const [avatar, setAvatar] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ISearchGroupResult[]>([]);
  const [searchTrigger, { isLoading: searchLoading }] = useLazySearchGroupsQuery();

  const { data, isLoading } = useListCommunitiesQuery({ category, limit: 30 });
  const { data: joined } = useListCommunitiesQuery({ scope: "joined", limit: 8 });
  const [createCommunity, { isLoading: creating }] = useCreateCommunityMutation();
  const [uploadMedia] = useUploadMediaMutation();

  const joinedItems = joined?.items ?? [];

  useEffect(() => {
    if (!modalOpen) {
      setName("");
      setDescription("");
      setRuleTitle("");
      setRuleDescription("");
      setAvatar("");
      setCoverUrl("");
    }
  }, [modalOpen]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchTrigger({ q: searchQuery.trim(), pageSize: 15 })
        .unwrap()
        .then((res) => {
          setSearchResults(res.items ?? []);
        })
        .catch((err) => {
          console.error("Search groups error:", err);
          setSearchResults([]);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchTrigger]);

  const isSearching = searchQuery.trim().length >= 2;
  const displayData = isSearching ? searchResults : (data?.items ?? []);
  const showSkeleton = isLoading || searchLoading;

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
      setModalOpen(false);
      toast.success("Đã tạo cộng đồng");
      router.push(`/(main)/(communities)/${community.groupId}`);
    } catch {
      toast.error("Không tạo được cộng đồng");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="gap-4 border-b border-border/40 px-4 py-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-foreground">Cộng đồng</Text>
            <Text className="text-sm text-muted-foreground">Không gian nội dung theo chủ đề</Text>
          </View>
          <Pressable
            onPress={() => setModalOpen(true)}
            className="size-11 items-center justify-center rounded-full border border-primary/20 bg-primary shadow-lg shadow-primary/30 active:scale-90"
            style={{
              elevation: 6,
              shadowColor: primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 6,
            }}
          >
            <Plus size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>
        </View>
        <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1">
          <Search size={18} color={muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Tìm kiếm nhóm..."
            placeholderTextColor={muted}
            className="flex-1 py-2 text-sm text-foreground"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} className="px-2 py-1 active:opacity-75">
              <Text className="text-xs font-semibold text-primary">Xóa</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={showSkeleton ? [1, 2, 3] : (displayData as any)}
        keyExtractor={(item, index) =>
          showSkeleton ? `skeleton-${index}` : (item as ICommunity).groupId
        }
        contentContainerStyle={{ padding: 16, gap: 14 }}
        ListHeaderComponent={
          !isSearching ? (
            <View className="mb-2 gap-5">
              <View className="rounded-3xl border border-border bg-card p-4">
                <View className="flex-row items-center gap-3">
                  <View className="size-10 items-center justify-center rounded-2xl bg-primary/10">
                    <Sparkles size={20} color={primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-card-foreground">Khám phá theo chủ đề</Text>
                    <Text className="text-sm text-muted-foreground">
                      Chọn một category để xem cộng đồng phù hợp.
                    </Text>
                  </View>
                </View>
              </View>

              <FlatList
                horizontal
                data={COMMUNITY_CATEGORIES}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <CategoryChip
                    category={item}
                    active={category === item}
                    onPress={() => setCategory(item)}
                  />
                )}
              />

              {!!joinedItems.length && (
                <View className="gap-3">
                  <Text className="font-bold text-foreground">Cộng đồng của tôi</Text>
                  <FlatList
                    horizontal
                    data={joinedItems}
                    keyExtractor={(item) => item.groupId}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10 }}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => router.push(`/(main)/(communities)/${item.groupId}`)}
                        className="w-56 overflow-hidden rounded-2xl border border-border bg-card p-4 active:opacity-85"
                      >
                        <View className="flex-row items-center gap-3">
                          <Image
                            source={item.avatar ? { uri: item.avatar } : defaultAvatarGroup}
                            className="size-11 rounded-2xl"
                            resizeMode="cover"
                          />
                          <View className="min-w-0 flex-1">
                            <Text className="font-bold text-card-foreground" numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text className="text-xs text-muted-foreground">
                              {item.memberCount} thành viên
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    )}
                  />
                </View>
              )}

              <Text className="font-bold text-foreground">{CATEGORY_LABEL[category]}</Text>
            </View>
          ) : (
            <View className="mb-2">
              <Text className="text-base font-bold text-foreground">
                Kết quả tìm kiếm cho "{searchQuery}"
              </Text>
            </View>
          )
        }
        ListEmptyComponent={
          <View className="items-center gap-3 rounded-2xl border border-dashed border-border p-8">
            <Users size={28} color={muted} />
            <Text className="text-center font-semibold text-foreground">
              {showSkeleton
                ? "Đang tải dữ liệu..."
                : isSearching
                  ? "Không tìm thấy cộng đồng nào phù hợp."
                  : "Chưa có cộng đồng trong chủ đề này."}
            </Text>
            {!showSkeleton && !isSearching && (
              <Text className="text-center text-sm text-muted-foreground">
                Bạn có thể tạo cộng đồng đầu tiên.
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) =>
          showSkeleton ? <CommunitySkeleton /> : <CommunityCard item={item as any} />
        }
      />

      <Modal visible={modalOpen} animationType="slide">
        <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
          <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
            <Pressable
              onPress={() => setModalOpen(false)}
              className="rounded-xl px-3 py-2 active:opacity-70"
            >
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
                <View className="gap-2">
                  <Text className="font-semibold text-foreground">Thông tin</Text>
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
                </View>

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
                        {coverUrl ? (
                          <Image
                            source={{ uri: coverUrl }}
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
                      className="absolute -bottom-8 left-4 size-20 overflow-hidden rounded-full border-4 border-background bg-card shadow-lg"
                      style={{
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
                      >
                        {avatar ? (
                          <Image
                            source={{ uri: avatar }}
                            className="size-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="size-full items-center justify-center bg-primary/10">
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

                <View className="gap-2">
                  <Text className="font-semibold text-foreground">Chủ đề</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {COMMUNITY_CATEGORIES.map((item) => (
                      <CategoryChip
                        key={item}
                        category={item}
                        active={category === item}
                        onPress={() => setCategory(item)}
                      />
                    ))}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="font-semibold text-foreground">Quyền riêng tư</Text>
                  <View className="flex-row gap-2">
                    {(["public", "private"] as const).map((item) => {
                      const active = type === item;
                      const Icon = item === "public" ? Globe2 : Lock;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => {
                            setType(item);
                            setJoinPolicy(item === "private" ? "approval" : "open");
                          }}
                          className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-4 py-3 active:opacity-80 ${
                            active ? "border-primary bg-primary" : "border-border bg-card"
                          }`}
                        >
                          <Icon size={17} color={active ? "#fff" : foreground} />
                          <Text
                            className={
                              active
                                ? "font-semibold text-primary-foreground"
                                : "font-semibold text-foreground"
                            }
                          >
                            {item === "public" ? "Công khai" : "Riêng tư"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="gap-2">
                  <Text className="font-semibold text-foreground">Cách tham gia</Text>
                  <View className="flex-row gap-2">
                    {(["open", "approval"] as const).map((item) => {
                      const active = joinPolicy === item;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => setJoinPolicy(item)}
                          className={`flex-1 rounded-2xl border px-4 py-3 active:opacity-80 ${
                            active ? "border-primary bg-primary" : "border-border bg-card"
                          }`}
                        >
                          <Text
                            className={
                              active
                                ? "text-center font-semibold text-primary-foreground"
                                : "text-center font-semibold text-foreground"
                            }
                          >
                            {item === "open" ? "Mở" : "Cần duyệt"}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View className="gap-2 rounded-3xl border border-border bg-card p-4">
                  <View className="flex-row items-center gap-2">
                    <BookOpen size={18} color={primary} />
                    <Text className="font-semibold text-card-foreground">Nội quy đầu tiên</Text>
                  </View>
                  <TextInput
                    value={ruleTitle}
                    onChangeText={setRuleTitle}
                    placeholder="Tiêu đề nội quy"
                    placeholderTextColor={muted}
                    className="rounded-2xl border border-border px-4 py-3 text-foreground"
                  />
                  <TextInput
                    value={ruleDescription}
                    onChangeText={setRuleDescription}
                    placeholder="Mô tả nội quy"
                    placeholderTextColor={muted}
                    className="rounded-2xl border border-border px-4 py-3 text-foreground"
                  />
                </View>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
