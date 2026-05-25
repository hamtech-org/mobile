import { useState, useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Vibration,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldCheck, X, AlertCircle, Plus, Eye } from "lucide-react-native";

import {
  useGetCommunityAutoModQuery,
  useUpdateCommunityAutoModMutation,
} from "@/store/api/communityApi";
import { toast } from "@/utils/appToast";

export interface CommunityAutoModModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  mutedColor: string;
  foregroundColor: string;
}

export function CommunityAutoModModal({
  open,
  onClose,
  groupId,
  mutedColor,
  foregroundColor,
}: CommunityAutoModModalProps) {
  const {
    data: autoModData,
    isLoading,
    refetch,
  } = useGetCommunityAutoModQuery(groupId, { skip: !open });

  const [updateAutoMod, { isLoading: isUpdating }] = useUpdateCommunityAutoModMutation();

  const [enabled, setEnabled] = useState(false);
  const [action, setAction] = useState<"censor" | "block">("censor");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Realtime Preview State
  const [testSentence, setTestSentence] = useState("");
  const [testResult, setTestResult] = useState("");

  // Sync data from query
  useEffect(() => {
    if (autoModData) {
      setEnabled(autoModData.autoModerateEnabled);
      setAction(autoModData.autoModerateAction);
      setKeywords(autoModData.blacklistedKeywords || []);
    }
  }, [autoModData]);

  // Realtime Preview matching logic runs completely client-side
  useEffect(() => {
    if (!testSentence.trim()) {
      setTestResult("");
      return;
    }

    if (!enabled || keywords.length === 0) {
      setTestResult(testSentence);
      return;
    }

    try {
      const escapedKws = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      // Unicode-aware boundaries in JavaScript RegExp
      const regex = new RegExp(
        `(?<![\\p{L}\\p{N}])(${escapedKws.join("|")})(?![\\p{L}\\p{N}])`,
        "giu",
      );

      if (action === "block") {
        const hasViolation = regex.test(testSentence);
        setTestResult(hasViolation ? "❌ [Tin nhắn vi phạm - Bị chặn]" : testSentence);
      } else {
        const censored = testSentence.replace(regex, (match) => "*".repeat(match.length));
        setTestResult(censored);
      }
    } catch (err) {
      setTestResult(testSentence);
    }
  }, [testSentence, enabled, keywords, action]);

  const handleAddKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw) return;

    if (keywords.includes(kw)) {
      setErrorMsg("Từ khóa này đã tồn tại.");
      Vibration.vibrate(100);
      return;
    }

    if (keywords.length >= 100) {
      setErrorMsg("Cho phép tối đa 100 từ khóa cấm.");
      Vibration.vibrate(100);
      return;
    }

    if (kw.length > 50) {
      setErrorMsg("Độ dài tối đa 50 ký tự.");
      Vibration.vibrate(100);
      return;
    }

    if (/[\r\n\t]/.test(kw)) {
      setErrorMsg("Từ khóa chứa ký tự không hợp lệ.");
      Vibration.vibrate(100);
      return;
    }

    setKeywords([...keywords, kw]);
    setNewKeyword("");
    setErrorMsg("");
    Vibration.vibrate(50);
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, idx) => idx !== index));
    Vibration.vibrate(40);
  };

  const handleSave = async () => {
    try {
      await updateAutoMod({
        groupId,
        body: {
          autoModerateEnabled: enabled,
          autoModerateAction: action,
          blacklistedKeywords: keywords,
        },
      }).unwrap();
      toast.success("Lưu cấu hình Auto-Mod thành công!");
      void refetch();
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể lưu cấu hình");
    }
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        {/* Header Modal */}
        <View className="flex-row items-center justify-between border-b border-border/40 bg-card px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="text-[15px] font-semibold text-foreground">Hủy</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Bộ lọc từ khóa</Text>
          <Pressable
            disabled={isUpdating}
            onPress={handleSave}
            className="rounded-xl bg-primary px-3.5 py-2 active:opacity-80 disabled:opacity-50"
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-[15px] font-bold text-white">Lưu</Text>
            )}
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-3 text-muted-foreground">Đang tải cấu hình Auto-Mod...</Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Toggle Switch */}
            <View className="mb-6 flex-row items-center justify-between rounded-3xl border border-border/40 bg-card p-4">
              <View className="flex-1 pr-4">
                <Text className="text-[15px] font-bold text-foreground">Kích hoạt Auto-Mod</Text>
                <Text className="mt-0.5 text-xs leading-normal text-muted-foreground">
                  Tự động kiểm duyệt, quét và lọc bỏ tin nhắn vi phạm trong phòng chat cộng đồng.
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: "#767577", true: "#3b82f6" }}
                thumbColor={Platform.OS === "android" ? "#fff" : undefined}
              />
            </View>

            {enabled && (
              <View className="gap-6">
                {/* Moderate Action Mode */}
                <View className="gap-2.5">
                  <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Chế độ kiểm duyệt
                  </Text>
                  <View className="gap-3">
                    {/* Censor Action */}
                    <Pressable
                      onPress={() => setAction("censor")}
                      className={`rounded-3xl border p-4 ${
                        action === "censor"
                          ? "border-primary bg-primary/5"
                          : "border-border/40 bg-card"
                      } active:opacity-90`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-bold text-foreground">
                          Censor (Che dấu từ cấm)
                        </Text>
                        {action === "censor" && (
                          <View className="rounded bg-primary/10 px-2 py-0.5">
                            <Text className="text-[9px] font-bold text-primary">Khuyên dùng</Text>
                          </View>
                        )}
                      </View>
                      <Text className="mt-1.5 text-xs leading-normal text-muted-foreground">
                        Từ cấm sẽ được che bằng ký tự ***. Tin nhắn vẫn được gửi đi và lưu trữ bình
                        thường.
                      </Text>
                    </Pressable>

                    {/* Block Action */}
                    <Pressable
                      onPress={() => setAction("block")}
                      className={`rounded-3xl border p-4 ${
                        action === "block"
                          ? "border-red-500 bg-red-500/5"
                          : "border-border/40 bg-card"
                      } active:opacity-90`}
                    >
                      <Text className="text-sm font-bold text-foreground">
                        Block (Chặn hoàn toàn)
                      </Text>
                      <Text className="mt-1.5 text-xs leading-normal text-muted-foreground">
                        Tin nhắn chứa từ cấm sẽ bị chặn ngay lập tức. Người dùng sẽ nhận được thông
                        báo lỗi.
                      </Text>
                    </Pressable>
                  </View>

                  {action === "block" && (
                    <View className="flex-row items-center gap-2 rounded-2xl bg-red-500/10 p-3.5">
                      <AlertCircle size={16} color="#ef4444" />
                      <Text className="flex-1 text-xs font-semibold leading-normal text-red-500">
                        ⚠️ Lưu ý: Tin nhắn chứa từ cấm sẽ bị chặn và không thể gửi đi trong phòng
                        chat.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Keyword list section */}
                <View className="gap-2.5">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Từ khóa cấm ({keywords.length} / 100)
                    </Text>
                    <Text className="text-[10px] text-muted-foreground">Nhấn dấu + để thêm</Text>
                  </View>

                  {/* Input form */}
                  <View className="flex-row gap-2">
                    <View className="flex-1 justify-center">
                      <TextInput
                        placeholder="Thêm từ khóa cấm mới..."
                        placeholderTextColor={mutedColor}
                        value={newKeyword}
                        onChangeText={(text) => {
                          setNewKeyword(text);
                          if (errorMsg) setErrorMsg("");
                        }}
                        onSubmitEditing={handleAddKeyword}
                        className="rounded-2xl border border-border/40 bg-card px-4 py-3 text-sm font-medium text-foreground"
                      />
                      {!!errorMsg && (
                        <Text className="mt-1 pl-1 text-[10px] font-bold text-red-500">
                          {errorMsg}
                        </Text>
                      )}
                    </View>
                    <Pressable
                      onPress={handleAddKeyword}
                      className="size-12 items-center justify-center rounded-2xl bg-primary shadow-sm shadow-primary/20 active:scale-95"
                    >
                      <Plus size={20} color="#fff" />
                    </Pressable>
                  </View>

                  {/* Keywords Tag Grid */}
                  <View className="mt-2 min-h-[120px] flex-row flex-wrap gap-2 rounded-3xl border border-border/40 bg-card/50 p-4">
                    {keywords.length > 0 ? (
                      keywords.map((kw, idx) => (
                        <View
                          key={`${kw}-${idx}`}
                          className="flex-row items-center gap-1 rounded-full border border-border/60 bg-card py-1.5 pl-3.5 pr-2 shadow-sm"
                        >
                          <Text className="text-xs font-bold text-foreground">{kw}</Text>
                          <Pressable
                            onPress={() => handleRemoveKeyword(idx)}
                            className="rounded-full p-0.5 active:bg-muted"
                          >
                            <X size={13} color={foregroundColor} />
                          </Pressable>
                        </View>
                      ))
                    ) : (
                      <View className="flex-1 items-center justify-center py-6">
                        <ShieldCheck size={28} color={mutedColor} />
                        <Text className="mt-2 text-center text-xs font-semibold text-muted-foreground">
                          Chưa thiết lập từ khóa cấm. Cộng đồng đang mở tự do.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Premium Realtime Tester */}
                <View className="gap-2.5 rounded-3xl border border-border bg-card p-4">
                  <View className="flex-row items-center gap-2 border-b border-border/40 pb-2.5">
                    <Eye size={16} color="#3b82f6" />
                    <Text className="text-[14px] font-bold text-foreground">
                      Realtime Testing Tool (Quản trị viên)
                    </Text>
                  </View>
                  <Text className="text-xs leading-normal text-muted-foreground">
                    Gõ thử nghiệm một câu mẫu để xem kết quả kiểm duyệt chạy realtime như thế nào.
                  </Text>

                  <TextInput
                    placeholder="Gõ thử câu có từ cấm ở đây..."
                    placeholderTextColor={mutedColor}
                    value={testSentence}
                    onChangeText={setTestSentence}
                    className="mt-1 rounded-2xl border border-border bg-muted/40 p-3 text-sm text-foreground"
                    multiline
                  />

                  {!!testSentence.trim() && (
                    <View className="mt-2.5 rounded-2xl border border-border/10 bg-muted/50 p-3.5">
                      <Text className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        Kết quả hiển thị:
                      </Text>
                      <Text
                        className={`mt-1.5 text-sm font-semibold leading-relaxed ${
                          testResult.startsWith("❌") ? "text-red-500" : "text-foreground"
                        }`}
                      >
                        {testResult}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
