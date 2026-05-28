import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, { BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { Crown, Shield, ShieldAlert, UserCheck, UserX } from "lucide-react-native";
import { Avatar } from "@/components/common/Avatar";
import { type ICommunityMember } from "@/types/community.types";
import { type FriendListItem } from "@/store/api/userApi";
import { ActionRow } from "./ActionRow";

export interface MemberManageSheetProps {
  sheetRef: React.RefObject<any>;
  selectedMember: ICommunityMember | null;
  profilesMap: Record<string, FriendListItem>;
  owner: boolean;
  mutedColor: string;
  foregroundColor: string;
  destructiveColor: string;
  onClose: () => void;
  handleUpdateRole: (role: any) => void;
  handleTransferOwner: () => void;
  handleKickMember: () => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
}

export function MemberManageSheet({
  sheetRef,
  selectedMember,
  profilesMap,
  owner,
  mutedColor,
  foregroundColor,
  destructiveColor,
  onClose,
  handleUpdateRole,
  handleTransferOwner,
  handleKickMember,
  renderBackdrop,
}: MemberManageSheetProps) {
  const memberSnapPoints = useMemo(() => ["50%"], []);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={memberSnapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "transparent" }}
      handleIndicatorStyle={{ backgroundColor: mutedColor, width: 44 }}
    >
      <BottomSheetView className="flex-1 rounded-t-3xl bg-card px-4 pb-8 pt-1">
        {selectedMember && (
          <>
            <View className="flex-row items-center gap-3 border-b border-border/40 pb-3">
              <Avatar
                uri={profilesMap[selectedMember.userId]?.avatar}
                name={profilesMap[selectedMember.userId]?.displayName || selectedMember.userId}
                size="md"
              />
              <View className="min-w-0 flex-1">
                <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quản lý thành viên
                </Text>
                <Text className="text-lg font-bold leading-tight text-foreground" numberOfLines={1}>
                  {profilesMap[selectedMember.userId]?.displayName || selectedMember.userId}
                </Text>
              </View>
            </View>

            <View className="mt-2 gap-1">
              {owner && selectedMember.role !== "admin" && (
                <ActionRow
                  icon={<Shield size={20} color={foregroundColor} />}
                  label="Thăng cấp thành Admin"
                  hint="Cho phép quản lý cài đặt nhóm và tất cả thành viên"
                  onPress={() => void handleUpdateRole("admin")}
                />
              )}
              {owner && selectedMember.role !== "moderator" && (
                <ActionRow
                  icon={<ShieldAlert size={20} color={foregroundColor} />}
                  label="Thăng cấp thành Moderator"
                  hint="Cho phép duyệt yêu cầu tham gia và xóa bài viết"
                  onPress={() => void handleUpdateRole("moderator")}
                />
              )}
              {owner && selectedMember.role !== "member" && (
                <ActionRow
                  icon={<UserCheck size={20} color={foregroundColor} />}
                  label="Hạ cấp xuống Thành viên"
                  hint="Tước bỏ quyền quản trị của tài khoản này"
                  onPress={() => void handleUpdateRole("member")}
                />
              )}
              {owner && (
                <ActionRow
                  icon={<Crown size={20} color={foregroundColor} />}
                  label="Chuyển quyền Chủ sở hữu"
                  hint="Nhượng toàn quyền tối cao của nhóm cho thành viên này"
                  onPress={handleTransferOwner}
                />
              )}
              <ActionRow
                icon={<UserX size={20} color={destructiveColor} />}
                label="Trục xuất khỏi cộng đồng"
                hint="Xóa tài khoản khỏi nhóm ngay lập tức"
                destructive
                onPress={handleKickMember}
              />
            </View>

            <Pressable
              onPress={() => sheetRef.current?.close()}
              className="mt-3 items-center rounded-xl border border-border/60 py-3.5 active:bg-muted/40"
            >
              <Text className="text-[15px] font-semibold text-muted-foreground">Đóng</Text>
            </Pressable>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}
