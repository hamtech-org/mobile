import { useState, useMemo, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Flag, Check, Trash2, X, AlertTriangle, ShieldAlert } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import {
  useGetCommunityReportsQuery,
  useResolveCommunityReportMutation,
} from "@/store/api/communityApi";
import { type FriendListItem, usePostMultipleUsersMutation } from "@/store/api/userApi";
import { type ICommunityReport } from "@/types/community.types";
import { toast } from "@/utils/appToast";
import { formatRelativeTime } from "@/utils/time";

export interface ReportsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  mutedColor: string;
  foregroundColor: string;
}

const REASON_LABEL: Record<string, string> = {
  spam: "Spam hoặc lừa đảo",
  harassment: "Quấy rối hoặc quấy nhiễu",
  hate_speech: "Ngôn từ thù hận",
  inappropriate: "Nội dung không thích hợp",
  rules_violation: "Vi phạm quy tắc",
  other: "Lý do khác",
};

export function ReportsModal({
  open,
  onClose,
  groupId,
  mutedColor,
  foregroundColor,
}: ReportsModalProps) {
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved">("pending");

  const {
    data: reportsPage,
    isLoading,
    refetch,
  } = useGetCommunityReportsQuery({ groupId, status: statusFilter }, { skip: !open });

  const reports = reportsPage?.items || [];

  const [resolveReport, { isLoading: isResolving }] = useResolveCommunityReportMutation();

  const [warningReport, setWarningReport] = useState<ICommunityReport | null>(null);
  const [warningNotes, setWarningNotes] = useState("");

  const [profilesMap, setProfilesMap] = useState<Record<string, FriendListItem>>({});
  const [postMultipleUsers] = usePostMultipleUsersMutation();
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // Collect user profiles needed
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    reports.forEach((r) => {
      if (r.reporterId) ids.add(r.reporterId);
      if (r.targetAuthorId) ids.add(r.targetAuthorId);
    });
    return Array.from(ids);
  }, [reports]);

  useEffect(() => {
    const missingIds = userIds.filter((id) => !fetchedIdsRef.current.has(id));
    if (missingIds.length > 0) {
      missingIds.forEach((id) => fetchedIdsRef.current.add(id));
      postMultipleUsers({ userIds: missingIds })
        .unwrap()
        .then((users) => {
          if (users && users.length > 0) {
            setProfilesMap((prev) => {
              const next = { ...prev };
              users.forEach((u) => {
                next[u.userId] = u;
              });
              return next;
            });
          }
        })
        .catch((err) => {
          console.error("Batch fetch report users error:", err);
          missingIds.forEach((id) => fetchedIdsRef.current.delete(id));
        });
    }
  }, [userIds, postMultipleUsers]);

  const handleResolve = async (
    report: ICommunityReport,
    action: "dismiss" | "delete_content" | "warn_user" | "ban_user",
    notes?: string,
  ) => {
    try {
      await resolveReport({
        groupId,
        entityType: report.entityType,
        entityId: report.entityId,
        createdAt: report.createdAt,
        reporterId: report.reporterId,
        action,
        notes,
      }).unwrap();

      toast.success("Đã xử lý báo cáo thành công");
      if (action === "warn_user") {
        setWarningReport(null);
        setWarningNotes("");
      }
      void refetch();
    } catch (err: any) {
      toast.error(err?.data?.message || "Không thể xử lý báo cáo");
    }
  };

  const renderReport = ({ item }: { item: ICommunityReport }) => {
    const reporterProfile = profilesMap[item.reporterId];
    const targetProfile = profilesMap[item.targetAuthorId];

    const reporterName = reporterProfile?.displayName || item.reporterId;
    const targetName = targetProfile?.displayName || item.targetAuthorId;

    return (
      <View className="mb-4 rounded-3xl border border-border/40 bg-card p-4">
        {/* Header: Entity type and reason */}
        <View className="mb-3 flex-row items-center justify-between border-b border-border/20 pb-2">
          <View className="flex-row items-center gap-1.5">
            <Text className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-500">
              {item.entityType === "POST"
                ? "Bài viết"
                : item.entityType === "CMT"
                  ? "Bình luận"
                  : "Nhóm"}
            </Text>
            <Text className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-500">
              {REASON_LABEL[item.reason] || item.reason}
            </Text>
          </View>
          <Text className="text-[10px] text-muted-foreground">
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>

        {/* Reporter vs Target */}
        <View className="mb-2 gap-1">
          <Text className="text-xs text-muted-foreground">
            Người báo cáo: <Text className="font-bold text-foreground">{reporterName}</Text>
          </Text>
          <Text className="text-xs text-muted-foreground">
            Tác giả vi phạm: <Text className="font-bold text-foreground">{targetName}</Text>
          </Text>
        </View>

        {/* Details message */}
        {!!item.details && (
          <View className="mb-2 rounded-xl border border-border/10 bg-muted/40 p-2.5">
            <Text className="text-xs italic text-muted-foreground">
              Ghi chú thêm: "{item.details}"
            </Text>
          </View>
        )}

        {/* Content Preview */}
        {item.contentPreview && item.contentPreview.text && (
          <View className="my-1 rounded-xl border border-dashed border-border/40 bg-muted/20 p-3">
            <Text className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
              Nội dung báo cáo:
            </Text>
            <Text className="text-xs leading-relaxed text-foreground">
              {item.contentPreview.text}
            </Text>
          </View>
        )}

        {/* Resolve actions */}
        {item.status === "pending" ? (
          <View className="mt-4 flex-row flex-wrap justify-end gap-2 border-t border-border/20 pt-3">
            <Pressable
              disabled={isResolving}
              onPress={() => void handleResolve(item, "dismiss")}
              className="rounded-xl bg-muted/50 px-3 py-2 active:opacity-80"
            >
              <Text className="text-xs font-semibold text-foreground">Bỏ qua</Text>
            </Pressable>
            <Pressable
              disabled={isResolving}
              onPress={() => void handleResolve(item, "delete_content")}
              className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 active:opacity-80"
            >
              <Text className="text-xs font-bold text-red-500">Xóa nội dung</Text>
            </Pressable>
            <Pressable
              disabled={isResolving}
              onPress={() => setWarningReport(item)}
              className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 active:opacity-80"
            >
              <Text className="text-xs font-bold text-amber-500">Cảnh cáo</Text>
            </Pressable>
            <Pressable
              disabled={isResolving}
              onPress={() =>
                Alert.alert("Trục xuất?", `Bạn có chắc chắn muốn kick và chặn ${targetName}?`, [
                  { text: "Hủy", style: "cancel" },
                  {
                    text: "Xác nhận",
                    style: "destructive",
                    onPress: () => void handleResolve(item, "ban_user"),
                  },
                ])
              }
              className="rounded-xl bg-red-500 px-3.5 py-2 active:opacity-85"
            >
              <Text className="text-xs font-bold text-white">Chặn</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-2 border-t border-border/10 pt-2.5">
            <Text className="text-xs font-bold text-emerald-500">
              ✓ Đã xử lý:{" "}
              {item.status === "resolved_dismissed"
                ? "Bỏ qua"
                : item.status === "resolved_deleted"
                  ? "Đã xóa nội dung / chặn"
                  : "Đã cảnh cáo"}
            </Text>
            {!!item.resolutionNotes && (
              <Text className="mt-0.5 text-[11px] italic text-muted-foreground">
                Lý do: "{item.resolutionNotes}"
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        {/* Header Modal */}
        <View className="flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <Pressable onPress={onClose} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="text-[15px] font-semibold text-foreground">Đóng</Text>
          </Pressable>
          <Text className="text-lg font-bold text-foreground">Báo cáo vi phạm</Text>
          <Pressable
            onPress={() => void refetch()}
            className="rounded-xl px-3 py-2 active:opacity-70"
          >
            <Text className="text-[15px] font-semibold text-primary">Tải lại</Text>
          </Pressable>
        </View>

        {/* Tab Filters */}
        <View className="flex-row border-b border-border/40 bg-card">
          <Pressable
            onPress={() => setStatusFilter("pending")}
            className="flex-1 items-center py-3"
            style={
              statusFilter === "pending"
                ? { borderBottomWidth: 2, borderBottomColor: "#3b82f6" }
                : undefined
            }
          >
            <Text
              className={`text-sm font-bold ${statusFilter === "pending" ? "text-primary" : "text-muted-foreground"}`}
            >
              Chờ xử lý
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setStatusFilter("resolved")}
            className="flex-1 items-center py-3"
            style={
              statusFilter === "resolved"
                ? { borderBottomWidth: 2, borderBottomColor: "#3b82f6" }
                : undefined
            }
          >
            <Text
              className={`text-sm font-bold ${statusFilter === "resolved" ? "text-primary" : "text-muted-foreground"}`}
            >
              Đã giải quyết
            </Text>
          </Pressable>
        </View>

        {/* List Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-3 text-muted-foreground">Đang tải danh sách báo cáo...</Text>
          </View>
        ) : (
          <FlatList
            data={reports}
            keyExtractor={(item) => item.reportId}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            renderItem={renderReport}
            ListEmptyComponent={
              <View className="mt-16 items-center gap-3 p-8">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Flag size={32} color="#3b82f6" />
                </View>
                <Text className="mt-2 text-center text-lg font-bold text-foreground">
                  {statusFilter === "pending"
                    ? "Không có báo cáo chờ duyệt"
                    : "Chưa xử lý báo cáo nào"}
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  {statusFilter === "pending"
                    ? "Cộng đồng của bạn đang hoạt động cực kỳ sạch sẽ và lành mạnh."
                    : "Lịch sử xử lý các báo cáo vi phạm sẽ hiển thị tại đây."}
                </Text>
              </View>
            }
          />
        )}

        {/* Warning user notes Modal */}
        <Modal
          visible={warningReport !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setWarningReport(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 items-center justify-center bg-black/60 p-6"
          >
            <View className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl">
              <View className="flex-row items-center justify-between border-b border-border/40 pb-3">
                <Text className="text-base font-bold text-foreground">Cảnh cáo vi phạm</Text>
                <Pressable
                  onPress={() => {
                    setWarningReport(null);
                    setWarningNotes("");
                  }}
                  className="rounded-full bg-muted p-1 active:opacity-75"
                >
                  <X size={16} color={foregroundColor} />
                </Pressable>
              </View>

              <Text className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Nhập ghi chú cảnh cáo. Hệ thống sẽ gửi cảnh báo chính thức đến tài khoản của tác
                giả.
              </Text>

              <TextInput
                multiline
                numberOfLines={3}
                placeholder="Nhập nội dung cảnh cáo vi phạm quy tắc cộng đồng..."
                placeholderTextColor={mutedColor}
                value={warningNotes}
                onChangeText={setWarningNotes}
                className="mt-4 min-h-[80px] rounded-2xl border border-border bg-muted/30 p-3 text-sm text-foreground"
                textAlignVertical="top"
              />

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setWarningReport(null);
                    setWarningNotes("");
                  }}
                  className="flex-1 items-center justify-center rounded-2xl bg-muted py-3 active:opacity-80"
                >
                  <Text className="text-sm font-bold text-foreground">Hủy</Text>
                </Pressable>
                <Pressable
                  disabled={isResolving || !warningNotes.trim()}
                  onPress={() => {
                    if (warningReport) {
                      void handleResolve(warningReport, "warn_user", warningNotes);
                    }
                  }}
                  className="flex-1 items-center justify-center rounded-2xl bg-amber-500 py-3 active:opacity-80 disabled:opacity-50"
                >
                  <Text className="text-sm font-bold text-white">Cảnh cáo</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}
