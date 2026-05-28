import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserCheck } from "lucide-react-native";
import { Avatar } from "@/components/common/Avatar";
import { type ICommunityJoinRequest } from "@/types/community.types";
import { type FriendListItem } from "@/store/api/userApi";

export interface RequestsModalProps {
  open: boolean;
  onClose: () => void;
  requests: ICommunityJoinRequest[];
  profilesMap: Record<string, FriendListItem>;
  mutedColor: string;
  handleResolveRequest: (userId: string, action: "approve" | "reject") => void;
}

export function RequestsModal({
  open,
  onClose,
  requests,
  profilesMap,
  mutedColor,
  handleResolveRequest,
}: RequestsModalProps) {
  const renderRequest = ({ item }: { item: ICommunityJoinRequest }) => {
    const profile = profilesMap[item.userId];
    const name = profile?.displayName || item.userId;
    const avatarUri = profile?.avatar;

    return (
      <View className="rounded-2xl border border-border bg-card p-4">
        <View className="flex-row items-center gap-3">
          <Avatar uri={avatarUri} name={name} size="md" />
          <View className="min-w-0 flex-1">
            <Text className="font-semibold text-card-foreground" numberOfLines={1}>
              {name}
            </Text>
            {profile && (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                @{item.userId}
              </Text>
            )}
          </View>
        </View>
        <Text className="mt-2 text-sm text-muted-foreground">
          {item.message || "Không có lời nhắn"}
        </Text>
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => handleResolveRequest(item.userId, "approve")}
            className="rounded-full bg-primary px-4 py-2 active:opacity-80"
          >
            <Text className="font-semibold text-primary-foreground">Duyệt</Text>
          </Pressable>
          <Pressable
            onPress={() => handleResolveRequest(item.userId, "reject")}
            className="rounded-full bg-muted px-4 py-2 active:opacity-80"
          >
            <Text className="font-semibold text-foreground">Từ chối</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <View className="flex-row items-center gap-3 border-b border-border/40 px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="text-[15px] font-semibold text-foreground">Đóng</Text>
          </Pressable>
          <Text className="flex-1 text-center text-lg font-bold text-foreground">
            Yêu cầu duyệt ({requests.length})
          </Text>
          <View style={{ width: 50 }} />
        </View>

        <FlatList
          data={requests}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={renderRequest}
          ListEmptyComponent={
            <View className="mt-12 items-center gap-3 p-8">
              <UserCheck size={32} color={mutedColor} />
              <Text className="text-center font-semibold text-foreground">
                Không có yêu cầu nào
              </Text>
              <Text className="text-center text-sm text-muted-foreground">
                Tất cả các yêu cầu gia nhập đã được xử lý.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}
