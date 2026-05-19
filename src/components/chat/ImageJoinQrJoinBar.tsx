import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { QrCode } from "lucide-react-native";

const PRIMARY = "#0068FF";

type Props = {
  onPress: () => void;
};

/** Nút tham gia nhóm từ QR trong ảnh — đồng bộ UI web (nền xanh nhạt, full width). */
export function ImageJoinQrJoinBar({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Quét mã QR tham gia nhóm"
      className="mt-2 w-full flex-row items-center justify-center gap-2 rounded-xl py-2.5 active:opacity-90"
      style={{ backgroundColor: "rgba(0, 104, 255, 0.1)" }}
    >
      <QrCode size={18} color={PRIMARY} strokeWidth={2} />
      <Text className="text-[14px] font-semibold" style={{ color: PRIMARY }}>
        Quét mã QR
      </Text>
    </Pressable>
  );
}

/** Wrapper để căn full width trong bubble ảnh. */
export function ImageJoinQrJoinBarWrap({ children }: { children: ReactNode }) {
  return <View className="w-full min-w-[200px] max-w-full self-stretch px-0.5">{children}</View>;
}
