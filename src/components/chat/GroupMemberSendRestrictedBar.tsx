import { Text, View } from "react-native";
import { Info } from "lucide-react-native";

type GroupMemberSendRestrictedBarProps = {
  onLearnMore?: () => void;
};

/** Thanh thông báo thay ô nhập khi member không được gửi tin (chỉ trưởng/phó nhóm). */
export function GroupMemberSendRestrictedBar({ onLearnMore }: GroupMemberSendRestrictedBarProps) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: "rgba(0,0,0,0.06)",
        backgroundColor: "#f0f2f5",
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Info size={18} color="#0068FF" strokeWidth={2.25} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: "#65676b" }}>
          Chỉ{" "}
          <Text onPress={onLearnMore} style={{ color: "#0068FF", fontWeight: "600" }}>
            trưởng nhóm và phó nhóm
          </Text>{" "}
          được gửi tin nhắn vào nhóm.{" "}
          <Text onPress={onLearnMore} style={{ color: "#0068FF", fontWeight: "600" }}>
            Tìm hiểu thêm
          </Text>
        </Text>
      </View>
    </View>
  );
}
