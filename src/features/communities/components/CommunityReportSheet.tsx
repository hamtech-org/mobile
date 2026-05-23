import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useReportEntityMutation } from "@/store/api/communityApi";

interface Props {
  groupId: string;
  entityType?: "POST" | "CMT" | "GROUP";
  entityId: string;
  postId?: string;
  createdAt?: string;
  visible: boolean;
  onClose: () => void;
}

type CommunityReportReason =
  | "spam"
  | "harassment"
  | "hate_speech"
  | "inappropriate"
  | "rules_violation"
  | "other";

const REPORT_OPTIONS: { value: CommunityReportReason; label: string }[] = [
  { value: "spam", label: "Spam hoặc lừa đảo" },
  { value: "harassment", label: "Quấy rối hoặc quấy nhiễu" },
  { value: "hate_speech", label: "Ngôn từ thù hận" },
  { value: "inappropriate", label: "Nội dung không thích hợp" },
  { value: "rules_violation", label: "Vi phạm quy tắc cộng đồng" },
  { value: "other", label: "Lý do khác" },
];

export const CommunityReportSheet = ({
  groupId,
  entityType = "GROUP",
  entityId,
  postId,
  createdAt,
  visible,
  onClose,
}: Props) => {
  const [reason, setReason] = useState<CommunityReportReason>("spam");
  const [details, setDetails] = useState("");
  const [reportEntity, { isLoading }] = useReportEntityMutation();
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!reason) return;

    try {
      await reportEntity({
        groupId,
        entityType,
        entityId,
        reason,
        details: details.trim() || undefined,
        postId,
        createdAt,
      }).unwrap();
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason("spam");
        setDetails("");
      }, 1500);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.data?.message || "Không thể gửi báo cáo. Vui lòng thử lại.");
    }
  }, [reason, details, groupId, entityType, entityId, postId, createdAt, reportEntity, onClose]);

  const handleClose = useCallback(() => {
    onClose();
    setReason("spam");
    setDetails("");
    setSuccess(false);
  }, [onClose]);

  const getTitle = () => {
    if (entityType === "POST") return "Báo cáo bài viết";
    if (entityType === "CMT") return "Báo cáo bình luận";
    return "Báo cáo cộng đồng";
  };

  const getSubTitle = () => {
    if (entityType === "POST") return "Báo cáo bài viết nếu vi phạm tiêu chuẩn hoặc quy tắc.";
    if (entityType === "CMT") return "Báo cáo bình luận nếu vi phạm tiêu chuẩn hoặc quy tắc.";
    return "Báo cáo nếu cộng đồng này vi phạm tiêu chuẩn hoặc quy tắc.";
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="w-full"
        >
          <Pressable
            className="rounded-t-2xl bg-neutral-900 px-4 pb-10 pt-4"
            onPress={(e) => e.stopPropagation()}
          >
            {/* Handle bar */}
            <View className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/30" />

            {/* Header */}
            <View className="mb-4 flex-row items-center gap-2.5">
              <View className="size-8 items-center justify-center rounded-lg bg-red-500/20">
                <Ionicons name="flag" size={16} color="#EF4444" />
              </View>
              <Text className="text-lg font-bold text-white">{getTitle()}</Text>
            </View>

            {success ? (
              <View className="items-center py-8">
                <Text className="text-sm text-white/60">✅ Đã gửi báo cáo. Cảm ơn bạn!</Text>
              </View>
            ) : (
              <>
                <Text className="mb-3 text-sm text-white/60">{getSubTitle()}</Text>

                {/* Radio options */}
                <View className="gap-2">
                  {REPORT_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      onPress={() => setReason(opt.value)}
                      className={`flex-row items-center gap-3 rounded-xl px-3 py-3 ${
                        reason === opt.value
                          ? "border border-red-500/40 bg-red-500/10"
                          : "border border-transparent bg-white/5"
                      }`}
                    >
                      <View
                        className={`size-5 items-center justify-center rounded-full border-2 ${
                          reason === opt.value ? "border-red-500 bg-red-500" : "border-white/30"
                        }`}
                      >
                        {reason === opt.value && <View className="size-2 rounded-full bg-white" />}
                      </View>
                      <Text className="text-[15px] font-medium text-white">{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Details input */}
                <View className="mt-3">
                  <Text className="mb-1 text-xs text-white/40">Chi tiết bổ sung (tùy chọn)</Text>
                  <TextInput
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Cung cấp thêm thông tin giúp ban quản trị hiểu rõ..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    maxLength={500}
                    multiline
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white"
                    style={{ minHeight: 60 }}
                  />
                  <Text className="mt-1 text-right text-[10px] text-white/40">
                    {details.length}/500 ký tự
                  </Text>
                </View>

                {/* Action buttons */}
                <View className="mt-5 flex-row gap-3">
                  <Pressable
                    onPress={handleClose}
                    className="flex-1 items-center rounded-xl bg-white/10 py-3"
                  >
                    <Text className="text-[15px] font-semibold text-white">Hủy</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleSubmit()}
                    disabled={!reason || isLoading}
                    className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
                      !reason || isLoading ? "bg-red-500/30" : "bg-red-500"
                    }`}
                  >
                    {isLoading && <ActivityIndicator size="small" color="#fff" />}
                    <Text
                      className={`text-[15px] font-semibold ${
                        !reason || isLoading ? "text-white/50" : "text-white"
                      }`}
                    >
                      Gửi báo cáo
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};
