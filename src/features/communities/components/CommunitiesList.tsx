import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Plus, Search, Users } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import { useListCommunitiesQuery, useLazySearchGroupsQuery } from "@/store/api/communityApi";
import {
  COMMUNITY_CATEGORIES,
  type CommunityCategory,
  type ICommunity,
  type ISearchGroupResult,
} from "@/types/community.types";
import { normalizeMediaUrl } from "@/utils/url";
import { CATEGORY_LABEL } from "../constants";
import { CategoryChip } from "./CategoryChip";
import { CommunityCard } from "./CommunityCard";
import { CommunitySkeleton } from "./CommunitySkeleton";
import { CreateCommunityModal } from "./CreateCommunityModal";

const defaultAvatarGroup = require("../../../../assets/images/avatar-group-default.jpg");

export function CommunitiesList() {
  const { primary, foreground, muted } = useIconColors();
  const [category, setCategory] = useState<CommunityCategory | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  // Search states
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ISearchGroupResult[]>([]);
  const [searchTrigger, { isLoading: searchLoading }] = useLazySearchGroupsQuery();

  const { data, isLoading } = useListCommunitiesQuery({ category, limit: 30 });
  const { data: joined } = useListCommunitiesQuery({ scope: "joined", limit: 8 });

  const joinedItems = joined?.items ?? [];

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

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="border-b border-border/40 bg-background px-4 py-3.5">
        {showSearchInput ? (
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => {
                setShowSearchInput(false);
                setSearchQuery("");
              }}
              className="rounded-full p-1 active:opacity-70"
            >
              <ArrowLeft size={22} color={foreground} />
            </Pressable>
            <View className="flex-1 flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-0.5">
              <Search size={18} color={muted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm kiếm nhóm..."
                placeholderTextColor={muted}
                autoFocus
                className="flex-1 py-2 text-sm text-foreground"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  className="px-2 py-1 active:opacity-75"
                >
                  <Text className="text-xs font-semibold text-primary">Xóa</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-2xl font-bold text-foreground">Cộng đồng</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => setShowSearchInput(true)}
                className="size-10 items-center justify-center rounded-full border border-border bg-card active:scale-95"
              >
                <Search size={19} color={foreground} />
              </Pressable>
              <Pressable
                onPress={() => setModalOpen(true)}
                className="size-10 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 active:scale-95"
                style={{
                  elevation: 6,
                  shadowColor: primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 6,
                }}
              >
                <Plus size={20} color="#fff" strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>
        )}
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
              <FlatList
                horizontal
                data={["all", ...COMMUNITY_CATEGORIES] as (CommunityCategory | "all")[]}
                keyExtractor={(item) => item}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <CategoryChip
                    category={item}
                    active={(item === "all" ? undefined : item) === category}
                    onPress={() => setCategory(item === "all" ? undefined : item)}
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
                          <View
                            style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden" }}
                          >
                            <Image
                              source={
                                normalizeMediaUrl(item.avatar)
                                  ? { uri: normalizeMediaUrl(item.avatar) }
                                  : defaultAvatarGroup
                              }
                              className="size-full"
                              style={{ width: "100%", height: "100%", borderRadius: 22 }}
                              resizeMode="cover"
                            />
                          </View>
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

              <Text className="font-bold text-foreground">
                {category ? CATEGORY_LABEL[category] || category : "Tất cả chủ đề"}
              </Text>
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

      <CreateCommunityModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </SafeAreaView>
  );
}
