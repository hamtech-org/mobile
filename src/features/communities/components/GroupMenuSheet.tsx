import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, { BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { UserMinus, Trash2, Flag } from "lucide-react-native";
import { type ICommunity } from "@/types/community.types";
import { ActionRow } from "./ActionRow";

export interface GroupMenuSheetProps {
  sheetRef: React.RefObject<BottomSheet>;
  community: ICommunity;
  isMember: boolean;
  owner: boolean;
  mutedColor: string;
  destructiveColor: string;
  confirmLeave: () => void;
  confirmArchive: () => void;
  onReportPress: () => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
}

export function GroupMenuSheet({
  sheetRef,
  community,
  isMember,
  owner,
  mutedColor,
  destructiveColor,
  confirmLeave,
  confirmArchive,
  onReportPress,
  renderBackdrop,
}: GroupMenuSheetProps) {
  const menuSnapPoints = useMemo(() => ["35%"], []);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={menuSnapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "transparent" }}
      handleIndicatorStyle={{ backgroundColor: mutedColor, width: 44 }}
    >
      <BottomSheetView className="flex-1 rounded-t-3xl bg-card px-4 pb-8 pt-1">
        <View className="border-b border-border/40 pb-3">
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cộng đồng
          </Text>
          <Text className="mt-1 text-lg font-bold leading-tight text-foreground" numberOfLines={1}>
            {community.name}
          </Text>
        </View>

        <View className="mt-2 gap-1">
          {isMember && !owner && (
            <ActionRow
              icon={<UserMinus size={20} color={destructiveColor} />}
              label="Rời cộng đồng"
              hint="Bạn sẽ không thể đăng bài và xem nội dung riêng tư"
              destructive
              onPress={() => {
                sheetRef.current?.close();
                confirmLeave();
              }}
            />
          )}
          {!owner && (
            <ActionRow
              icon={<Flag size={20} color={destructiveColor} />}
              label="Báo cáo cộng đồng"
              hint="Báo cáo nội dung hoặc hoạt động vi phạm chính sách"
              destructive
              onPress={() => {
                sheetRef.current?.close();
                onReportPress();
              }}
            />
          )}
          {owner && (
            <ActionRow
              icon={<Trash2 size={20} color={destructiveColor} />}
              label="Lưu trữ cộng đồng"
              hint="Cộng đồng sẽ bị ẩn khỏi công cộng và không hiển thị nữa"
              destructive
              onPress={() => {
                sheetRef.current?.close();
                confirmArchive();
              }}
            />
          )}
        </View>

        <Pressable
          onPress={() => sheetRef.current?.close()}
          className="mt-3 items-center rounded-xl border border-border/60 py-3.5 active:bg-muted/40"
        >
          <Text className="text-[15px] font-semibold text-muted-foreground">Đóng</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheet>
  );
}
