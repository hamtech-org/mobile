import React, { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import BottomSheet, { BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { UserMinus, Trash2, Flag, MessageSquare } from "lucide-react-native";
import { type ICommunity } from "@/types/community.types";
import { ActionRow } from "./ActionRow";

export interface GroupMenuSheetProps {
  sheetRef: React.RefObject<any>;
  community: ICommunity;
  isMember: boolean;
  owner: boolean;
  mutedColor: string;
  destructiveColor: string;
  confirmLeave: () => void;
  confirmArchive: () => void;
  onReportPress: () => void;
  renderBackdrop: (props: BottomSheetBackdropProps) => React.ReactElement;
  onLinkChatPress?: () => void;
  onUnlinkChatPress?: () => void;
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
  onLinkChatPress,
  onUnlinkChatPress,
}: GroupMenuSheetProps) {
  // Dynamically compute snap points based on the number of action rows.
  // 1 row -> 25% (very compact)
  // 2 rows -> 32%
  const menuSnapPoints = useMemo(() => {
    let itemCount = 0;
    if (isMember && !owner) itemCount++;
    if (!owner) itemCount++;
    if (owner) {
      itemCount++; // archive
      itemCount++; // link/unlink chat
    }
    return itemCount > 1 ? ["38%"] : ["25%"];
  }, [isMember, owner]);

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
          {[
            isMember && !owner && (
              <ActionRow
                key="leave"
                icon={<UserMinus size={20} color={destructiveColor} />}
                label="Rời cộng đồng"
                hint="Bạn sẽ không thể đăng bài và xem nội dung riêng tư"
                destructive
                onPress={() => {
                  sheetRef.current?.close();
                  confirmLeave();
                }}
              />
            ),
            !owner && (
              <ActionRow
                key="report"
                icon={<Flag size={20} color={destructiveColor} />}
                label="Báo cáo cộng đồng"
                hint="Báo cáo nội dung hoặc hoạt động vi phạm chính sách"
                destructive
                onPress={() => {
                  sheetRef.current?.close();
                  onReportPress();
                }}
              />
            ),
            owner &&
              (community.conversationId ? (
                <ActionRow
                  key="unlink-chat"
                  icon={<MessageSquare size={20} color={destructiveColor} />}
                  label="Hủy liên kết phòng chat"
                  hint="Gỡ bỏ phòng chat liên kết hiện tại của cộng đồng"
                  destructive
                  onPress={() => {
                    sheetRef.current?.close();
                    onUnlinkChatPress?.();
                  }}
                />
              ) : (
                <ActionRow
                  key="link-chat"
                  icon={<MessageSquare size={20} color="#71717a" />}
                  label="Liên kết phòng chat"
                  hint="Chọn một phòng chat nhóm để liên kết với cộng đồng"
                  onPress={() => {
                    sheetRef.current?.close();
                    onLinkChatPress?.();
                  }}
                />
              )),
            owner && (
              <ActionRow
                key="archive"
                icon={<Trash2 size={20} color={destructiveColor} />}
                label="Lưu trữ cộng đồng"
                hint="Cộng đồng sẽ bị ẩn khỏi công cộng và không hiển thị nữa"
                destructive
                onPress={() => {
                  sheetRef.current?.close();
                  confirmArchive();
                }}
              />
            ),
          ].filter(Boolean)}
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
