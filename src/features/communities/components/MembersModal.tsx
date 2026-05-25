import { useState, useMemo } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Crown, MoreVertical, Search } from "lucide-react-native";
import { Avatar } from "@/components/common/Avatar";
import { type ICommunityMember, type ICommunity } from "@/types/community.types";
import { type FriendListItem } from "@/store/api/userApi";
import { ROLE_LABEL } from "../constants";

export interface MembersModalProps {
  open: boolean;
  onClose: () => void;
  members: ICommunityMember[];
  profilesMap: Record<string, FriendListItem>;
  community: ICommunity;
  manager: boolean;
  mutedColor: string;
  foregroundColor: string;
  onSelectMember: (member: ICommunityMember) => void;
}

export function MembersModal({
  open,
  onClose,
  members,
  profilesMap,
  community,
  manager,
  mutedColor,
  foregroundColor,
  onSelectMember,
}: MembersModalProps) {
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    if (!memberSearchQuery.trim()) return members;
    const query = memberSearchQuery.toLowerCase().trim();
    return members.filter((m) => {
      const profile = profilesMap[m.userId];
      const name = (profile?.displayName || m.userId).toLowerCase();
      return name.includes(query) || m.userId.toLowerCase().includes(query);
    });
  }, [members, memberSearchQuery, profilesMap]);

  const renderMember = ({ item }: { item: ICommunityMember }) => {
    const profile = profilesMap[item.userId];
    const name = profile?.displayName || item.userId;
    const avatarUri = profile?.avatar;
    const isSelf = item.userId === community.ownerId;
    const showManage = manager && item.role !== "owner" && !isSelf;

    return (
      <Pressable
        onPress={() => {
          if (showManage) {
            onSelectMember(item);
          }
        }}
        className="rounded-2xl border border-border bg-card p-4 active:bg-muted/30"
      >
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={name} size="md" />
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-card-foreground" numberOfLines={1}>
              {name}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {new Date(item.joinedAt).toLocaleDateString("vi-VN")}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            {item.role === "owner" && <Crown size={12} color={foregroundColor} />}
            <Text className="text-[11px] font-semibold text-foreground">
              {ROLE_LABEL[item.role]}
            </Text>
          </View>
          {showManage && (
            <View className="rounded-full bg-muted/40 p-1">
              <MoreVertical size={16} color={mutedColor} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-row items-center gap-3 border-b border-border/40 px-4 py-3">
          <Pressable
            onPress={() => {
              onClose();
              setMemberSearchQuery("");
            }}
            className="rounded-xl px-3 py-2 active:opacity-70"
          >
            <Text className="text-[15px] font-semibold text-foreground">Đóng</Text>
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-foreground">
            Thành viên ({members.length})
          </Text>
          <View style={{ width: 50 }} />
        </View>

        {/* Search bar */}
        <View className="px-4 py-2">
          <View className="flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-1">
            <Search size={18} color={mutedColor} />
            <TextInput
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
              placeholder="Tìm kiếm thành viên..."
              placeholderTextColor={mutedColor}
              className="flex-1 py-2 text-sm text-foreground"
            />
            {memberSearchQuery.length > 0 && (
              <Pressable
                onPress={() => setMemberSearchQuery("")}
                className="px-2 py-1 active:opacity-75"
              >
                <Text className="text-xs font-semibold text-primary">Xóa</Text>
              </Pressable>
            )}
          </View>
        </View>

        <FlatList
          data={filteredMembers}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={renderMember}
          ListEmptyComponent={
            <Text className="mt-8 text-center text-muted-foreground">
              {memberSearchQuery ? "Không tìm thấy thành viên nào." : "Chưa có thành viên."}
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
