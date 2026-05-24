import React, { useMemo, useState, useEffect } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Search, UserPlus, X, Check, Link, Copy, RefreshCw } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { Avatar } from "@/components/common/Avatar";
import { toast } from "@/utils/appToast";
import { useGetFriendsQuery } from "@/store/api/userApi";
import {
  useGetCommunityMembersQuery,
  useInviteFriendsMutation,
  useGetCommunityQuery,
  useGetInviteLinkMutation,
  useDisableInviteLinkMutation,
} from "@/store/api/communityApi";

export interface InviteFriendsSheetProps {
  sheetRef: React.RefObject<any>;
  groupId: string;
  mutedColor: string;
  foregroundColor: string;
  onClose: () => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
}

export function InviteFriendsSheet({
  sheetRef,
  groupId,
  mutedColor,
  foregroundColor,
  onClose,
  renderBackdrop,
}: InviteFriendsSheetProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: friends = [], isLoading: isFriendsLoading } = useGetFriendsQuery();
  const { data: members = [], isLoading: isMembersLoading } = useGetCommunityMembersQuery(groupId);
  const [inviteFriends, { isLoading: isSubmitting }] = useInviteFriendsMutation();

  const { data: community } = useGetCommunityQuery(groupId);
  const isManager =
    community?.viewerRole === "owner" ||
    community?.viewerRole === "admin" ||
    community?.viewerRole === "moderator";

  const [getInviteLink, { isLoading: isLinkLoading }] = useGetInviteLinkMutation();
  const [disableInviteLink, { isLoading: isDisabling }] = useDisableInviteLinkMutation();

  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteEnabled, setInviteEnabled] = useState(false);

  useEffect(() => {
    if (groupId && isManager) {
      getInviteLink(groupId)
        .unwrap()
        .then((res) => {
          setInviteCode(res.inviteCode);
          setInviteEnabled(res.inviteCodeEnabled);
        })
        .catch(() => {});
    }
  }, [groupId, isManager, getInviteLink]);

  const handleDisableLink = async () => {
    try {
      await disableInviteLink(groupId).unwrap();
      setInviteCode(null);
      setInviteEnabled(false);
      toast.success("Đã vô hiệu hóa liên kết mời!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể vô hiệu hóa đường liên kết");
    }
  };

  const handleResetLink = async () => {
    try {
      await disableInviteLink(groupId).unwrap();
      const res = await getInviteLink(groupId).unwrap();
      setInviteCode(res.inviteCode);
      setInviteEnabled(res.inviteCodeEnabled);
      toast.success("Đã tạo lại liên kết mới!");
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể cấp lại đường liên kết");
    }
  };

  const inviteUrl = inviteCode ? `https://hamtech.app/c/join/${inviteCode}` : "";

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    await Clipboard.setStringAsync(inviteUrl);
    setCopied(true);
    toast.success("Đã sao chép liên kết mời!");
    setTimeout(() => setCopied(false), 2000);
  };

  const snapPoints = useMemo(() => ["75%", "90%"], []);

  const existingMemberIds = useMemo(() => {
    return new Set(members.map((m) => m.userId));
  }, [members]);

  const filteredFriends = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends.filter((friend) => {
      // filter out existing members
      if (existingMemberIds.has(friend.userId)) return false;

      if (!q) return true;
      return (
        (friend.displayName && friend.displayName.toLowerCase().includes(q)) ||
        (friend.email && friend.email.toLowerCase().includes(q)) ||
        (friend.phone && friend.phone.toLowerCase().includes(q))
      );
    });
  }, [friends, existingMemberIds, query]);

  const handleToggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      await inviteFriends({ groupId, userIds: selectedIds }).unwrap();
      toast.success("Đã gửi lời mời tham gia cộng đồng!");
      setSelectedIds([]);
      sheetRef.current?.close();
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể gửi lời mời tham gia");
    }
  };

  const isLoading = isFriendsLoading || isMembersLoading;

  const renderItem = ({ item }: { item: (typeof friends)[number] }) => {
    const isSelected = selectedIds.includes(item.userId);
    return (
      <Pressable
        onPress={() => handleToggleSelect(item.userId)}
        className="flex-row items-center gap-3 rounded-2xl px-4 py-3 active:bg-muted/40"
      >
        <View
          className={`size-6 items-center justify-center rounded-full border ${
            isSelected ? "border-primary bg-primary" : "border-border bg-card"
          }`}
        >
          {isSelected && <Check size={14} color="#FFF" strokeWidth={3} />}
        </View>

        <Avatar uri={item.avatar} name={item.displayName} size="md" />

        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {item.displayName || item.userId}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {item.email || item.phone || "Zalogram User"}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "transparent" }}
      handleIndicatorStyle={{ backgroundColor: mutedColor, width: 44 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView className="flex-1 rounded-t-3xl bg-card pb-4">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 pb-3 pt-1">
          <View className="min-w-0 flex-1">
            <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mời tham gia
            </Text>
            <Text className="text-lg font-bold leading-tight text-foreground" numberOfLines={1}>
              Mời bạn bè vào cộng đồng
            </Text>
          </View>
          <Pressable
            onPress={() => sheetRef.current?.close()}
            className="size-8 items-center justify-center rounded-full bg-muted/65 active:bg-muted"
          >
            <X size={18} color={foregroundColor} />
          </Pressable>
        </View>

        {isManager && (
          <View className="space-y-2 border-b border-border/40 bg-primary/5 px-4 py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Link size={14} color="#3B82F6" />
                <Text className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Đường liên kết mời cộng đồng
                </Text>
              </View>
              {inviteEnabled && inviteCode && (
                <Pressable onPress={handleDisableLink} disabled={isDisabling}>
                  <Text className="text-xs font-semibold text-destructive">Vô hiệu hóa</Text>
                </Pressable>
              )}
            </View>

            {isLinkLoading ? (
              <View className="flex-row items-center gap-2 py-1">
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text className="text-xs font-semibold text-muted-foreground">
                  Đang tạo liên kết mời...
                </Text>
              </View>
            ) : !inviteEnabled || !inviteCode ? (
              <View className="flex-row items-center justify-between gap-3 py-1">
                <Text className="flex-1 text-xs text-muted-foreground">
                  Chưa bật liên kết mời cho cộng đồng này.
                </Text>
                <Pressable
                  onPress={handleResetLink}
                  className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 active:bg-primary/20"
                >
                  <Text className="text-xs font-bold text-primary">Kích hoạt</Text>
                </Pressable>
              </View>
            ) : (
              <View className="space-y-1.5">
                <View className="flex-row items-center gap-2">
                  <View className="flex-1 flex-row items-center overflow-hidden rounded-xl border border-border/40 bg-muted/65 px-3 py-2">
                    <Text
                      className="flex-1 text-xs font-semibold text-foreground"
                      numberOfLines={1}
                    >
                      {inviteUrl}
                    </Text>
                    <Pressable
                      onPress={handleCopyLink}
                      className="ml-2 rounded-lg bg-muted/40 p-1 active:bg-muted"
                    >
                      {copied ? (
                        <Check size={14} color="#10B981" strokeWidth={3} />
                      ) : (
                        <Copy size={14} color={foregroundColor} opacity={0.7} />
                      )}
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={handleResetLink}
                    disabled={isLinkLoading || isDisabling}
                    className="h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-muted/50 active:bg-muted"
                  >
                    <RefreshCw size={16} color={foregroundColor} opacity={0.7} />
                  </Pressable>
                </View>
                <Text className="text-[10px] font-medium text-muted-foreground">
                  Bất kỳ ai có liên kết này đều có thể trực tiếp gia nhập cộng đồng này mà không cần
                  phê duyệt.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Search */}
        <View className="border-b border-border/40 px-4 py-3">
          <View className="relative flex-row items-center rounded-full bg-muted/60 px-3 py-2.5">
            <Search size={16} color={foregroundColor} opacity={0.6} className="mr-2" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm kiếm bạn bè..."
              placeholderTextColor={foregroundColor}
              className="flex-1 p-0 text-sm font-medium text-foreground"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-10">
            <ActivityIndicator size="small" color={foregroundColor} />
            <Text className="mt-2 text-xs font-medium text-muted-foreground">
              Đang tải danh sách bạn bè...
            </Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={filteredFriends}
            keyExtractor={(item) => item.userId}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 8 }}
            ListEmptyComponent={
              <View className="items-center justify-center px-4 py-12">
                <Text className="text-center text-sm font-semibold text-muted-foreground">
                  {friends.length === 0
                    ? "Bạn chưa có người bạn nào để mời"
                    : "Không tìm thấy bạn bè hoặc họ đã tham gia nhóm"}
                </Text>
              </View>
            }
          />
        )}

        {/* Footer */}
        <View className="flex-row items-center justify-between border-t border-border/40 px-4 pt-3">
          <Text className="text-xs font-semibold text-muted-foreground">
            Đã chọn {selectedIds.length} người
          </Text>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => sheetRef.current?.close()}
              disabled={isSubmitting}
              className="rounded-xl bg-muted/30 px-4 py-2.5 active:bg-muted/60"
            >
              <Text className="text-sm font-bold text-foreground">Hủy</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={selectedIds.length === 0 || isSubmitting}
              className={`flex-row items-center gap-1.5 rounded-xl px-5 py-2.5 ${
                selectedIds.length === 0 || isSubmitting ? "bg-primary/50" : "bg-primary"
              }`}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <UserPlus size={16} color="#FFF" />
                  <Text className="text-sm font-bold text-primary-foreground">Mời</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
