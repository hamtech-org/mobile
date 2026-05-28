import { useEffect, useState, useMemo, useRef } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  History,
  CheckCircle2,
  XCircle,
  UserMinus,
  Users,
  ShieldAlert,
  Crown,
  Trash2,
  Pin,
  PinOff,
  Settings,
  X,
  RefreshCw,
} from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useGetCommunityModerationLogsQuery } from "@/store/api/communityApi";
import { type FriendListItem, usePostMultipleUsersMutation } from "@/store/api/userApi";
import type { ICommunityModerationLog } from "@/types/community.types";
import { formatRelativeTime } from "@/utils/time";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";

function getTruncatedPostText(content: string | undefined | null, maxLen: number = 40): string {
  if (!content) return "";
  const plainText = extractTextFromTiptapJson(content);
  if (plainText.length > maxLen) {
    return plainText.substring(0, maxLen) + "...";
  }
  return plainText;
}

export interface ModerationLogsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  mutedColor: string;
  foregroundColor: string;
}

export function ModerationLogsModal({
  open,
  onClose,
  groupId,
  mutedColor,
  foregroundColor,
}: ModerationLogsModalProps) {
  const [cursor, setCursor] = useState<string | null>(null);
  const [accumulatedLogs, setAccumulatedLogs] = useState<ICommunityModerationLog[]>([]);

  const {
    data: logsRes,
    isLoading,
    isFetching,
    refetch,
  } = useGetCommunityModerationLogsQuery(
    {
      groupId,
      limit: 20,
      cursor: cursor || undefined,
    },
    { skip: !open },
  );

  // Reset local state when switching groupId or modal opens
  useEffect(() => {
    if (open) {
      setAccumulatedLogs([]);
      setCursor(null);
    }
  }, [groupId, open]);

  // Tích lũy log thô vào state và chống trùng lặp theo logId
  useEffect(() => {
    if (logsRes?.items) {
      setAccumulatedLogs((prev) => {
        const existingIds = new Set(prev.map((item: ICommunityModerationLog) => item.logId));
        const newItems = logsRes.items.filter(
          (item: ICommunityModerationLog) => !existingIds.has(item.logId),
        );
        return [...prev, ...newItems];
      });
    }
  }, [logsRes]);

  const [profilesMap, setProfilesMap] = useState<Record<string, FriendListItem>>({});
  const [postMultipleUsers] = usePostMultipleUsersMutation();
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // Lấy ra tất cả các actorId và targetId để batch fetch profile
  const neededUserIds = useMemo(() => {
    const ids = new Set<string>();
    accumulatedLogs.forEach((log) => {
      if (log.actorId) ids.add(log.actorId);
      if (log.targetType === "member" && log.targetId) ids.add(log.targetId);
    });
    return Array.from(ids);
  }, [accumulatedLogs]);

  useEffect(() => {
    const missingIds = neededUserIds.filter((id) => !fetchedIdsRef.current.has(id));
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
          console.error("Batch fetch log users error:", err);
          missingIds.forEach((id) => fetchedIdsRef.current.delete(id));
        });
    }
  }, [neededUserIds, postMultipleUsers]);

  const handleLoadMore = () => {
    if (logsRes?.hasMore && logsRes?.nextCursor && !isFetching) {
      setCursor(logsRes.nextCursor);
    }
  };

  const handleRefresh = () => {
    setAccumulatedLogs([]);
    setCursor(null);
    void refetch();
  };

  const roleLabels: Record<string, string> = {
    owner: "Chủ sở hữu",
    admin: "Quản trị viên",
    moderator: "Kiểm duyệt viên",
    member: "Thành viên",
  };

  const fieldLabels: Record<string, string> = {
    name: "Tên nhóm",
    slug: "Đường dẫn nhóm (Slug)",
    type: "Quyền riêng tư",
    joinPolicy: "Chế độ tham gia",
    isPostApprovalRequired: "Yêu cầu duyệt bài",
    description: "Mô tả nhóm",
    avatar: "Ảnh đại diện",
    coverUrl: "Ảnh bìa",
    category: "Danh mục nhóm",
    rules: "Quy định nhóm",
  };

  const formatVal = (field: string, v: any) => {
    if (v === null || v === undefined) return "Trống";
    if (typeof v === "boolean") return v ? "Bật" : "Tắt";
    if (field === "type") return v === "public" ? "Công khai" : "Riêng tư";
    if (field === "joinPolicy") return v === "open" ? "Tự do" : "Phê duyệt";
    if (field === "category") {
      const labels: Record<string, string> = {
        general: "Chung",
        tech: "Công nghệ",
        study: "Học tập",
        entertainment: "Giải trí",
        sports: "Thể thao",
        beauty: "Làm đẹp",
        gaming: "Trò chơi",
      };
      return labels[v] || String(v);
    }
    if (field === "rules" && Array.isArray(v)) {
      return v.map((r: any) => `"${r.title}"`).join(", ") || "Trống";
    }
    return String(v);
  };

  const renderLogItem = ({ item, index }: { item: ICommunityModerationLog; index: number }) => {
    const actorProfile = profilesMap[item.actorId];
    const actorName = actorProfile?.displayName || item.actorInfo?.displayName || "Ban quản trị";
    const actorAvatar = actorProfile?.avatar || item.actorInfo?.avatar;

    const targetProfile = item.targetType === "member" ? profilesMap[item.targetId] : null;
    const targetName =
      targetProfile?.displayName ||
      item.targetUserInfo?.displayName ||
      item.targetName ||
      "Thành viên";

    let IconComponent = Settings;
    let iconColor = "#64748b"; // slate
    let iconBg = "bg-slate-500/10 dark:bg-slate-500/20";
    let logText: any = "";

    switch (item.action) {
      case "approve_join":
        IconComponent = CheckCircle2;
        iconColor = "#10b981"; // emerald
        iconBg = "bg-emerald-500/10 dark:bg-emerald-500/20";
        logText = (
          <Text>
            đã duyệt yêu cầu gia nhập của{" "}
            <Text className="font-bold text-foreground">{targetName}</Text>
          </Text>
        );
        break;
      case "reject_join":
        IconComponent = XCircle;
        iconColor = "#f43f5e"; // rose
        iconBg = "bg-rose-500/10 dark:bg-rose-500/20";
        logText = (
          <Text>
            đã từ chối yêu cầu gia nhập của{" "}
            <Text className="font-bold text-foreground">{targetName}</Text>
          </Text>
        );
        break;
      case "ban_member":
        IconComponent = UserMinus;
        iconColor = "#f43f5e";
        iconBg = "bg-rose-500/10 dark:bg-rose-500/20";
        logText = (
          <Text>
            đã chặn thành viên <Text className="font-bold text-foreground">{targetName}</Text>
          </Text>
        );
        break;
      case "unban_member":
        IconComponent = Users;
        iconColor = "#3b82f6"; // blue
        iconBg = "bg-blue-500/10 dark:bg-blue-500/20";
        logText = (
          <Text>
            đã gỡ chặn thành viên <Text className="font-bold text-foreground">{targetName}</Text>
          </Text>
        );
        break;
      case "change_role":
        IconComponent = ShieldAlert;
        iconColor = "#f59e0b"; // amber
        iconBg = "bg-amber-500/10 dark:bg-amber-500/20";
        const oldRole = roleLabels[item.metadata?.oldRole] || item.metadata?.oldRole;
        const newRole = roleLabels[item.metadata?.newRole] || item.metadata?.newRole;
        logText = (
          <Text>
            đã thay đổi quyền của <Text className="font-bold text-foreground">{targetName}</Text> từ{" "}
            <Text className="font-bold text-foreground">{oldRole}</Text> thành{" "}
            <Text className="font-bold text-foreground">{newRole}</Text>
          </Text>
        );
        break;
      case "transfer_ownership":
        IconComponent = Crown;
        iconColor = "#f59e0b";
        iconBg = "bg-amber-500/10 dark:bg-amber-500/20";
        logText = (
          <Text>
            đã chuyển quyền sở hữu cộng đồng cho{" "}
            <Text className="font-bold text-foreground">{targetName}</Text>
          </Text>
        );
        break;
      case "approve_post":
        IconComponent = CheckCircle2;
        iconColor = "#10b981";
        iconBg = "bg-emerald-500/10 dark:bg-emerald-500/20";
        const approvedText = getTruncatedPostText(item.targetName, 40) || "Bài viết";
        logText = (
          <Text>
            đã phê duyệt bài viết{" "}
            <Text className="font-bold text-foreground">"{approvedText}"</Text>
          </Text>
        );
        break;
      case "reject_post":
        IconComponent = XCircle;
        iconColor = "#f43f5e";
        iconBg = "bg-rose-500/10 dark:bg-rose-500/20";
        const rejectedText = getTruncatedPostText(item.targetName, 40) || "Bài viết";
        logText = (
          <Text>
            đã từ chối bài viết <Text className="font-bold text-foreground">"{rejectedText}"</Text>
          </Text>
        );
        break;
      case "delete_post":
        IconComponent = Trash2;
        iconColor = "#f43f5e";
        iconBg = "bg-rose-500/10 dark:bg-rose-500/20";
        const deletedText = getTruncatedPostText(item.targetName, 40) || "Bài viết";
        logText = (
          <Text>
            đã xóa bài viết <Text className="font-bold text-foreground">"{deletedText}"</Text>
          </Text>
        );
        break;
      case "pin_post":
        IconComponent = Pin;
        iconColor = "#3b82f6";
        iconBg = "bg-blue-500/10 dark:bg-blue-500/20";
        logText = <Text>đã ghim bài viết lên đầu nhóm</Text>;
        break;
      case "unpin_post":
        IconComponent = PinOff;
        iconColor = "#64748b";
        iconBg = "bg-slate-500/10 dark:bg-slate-500/20";
        logText = <Text>đã bỏ ghim bài viết</Text>;
        break;
      case "update_settings":
        IconComponent = Settings;
        iconColor = "#64748b";
        iconBg = "bg-slate-500/10 dark:bg-slate-500/20";
        logText = <Text>đã cập nhật cài đặt của cộng đồng</Text>;
        break;
    }

    return (
      <View className="relative mb-6 flex-row pl-6">
        {/* Timeline Line Vertical */}
        {index < accumulatedLogs.length - 1 && (
          <View className="absolute bottom-[-24px] left-[15px] top-[30px] w-[1px] bg-border/60" />
        )}

        {/* Timeline Dot Indicator */}
        <View
          className={`absolute left-0 top-1 h-8 w-8 items-center justify-center rounded-full border border-card shadow-sm ${iconBg}`}
        >
          <IconComponent size={14} color={iconColor} />
        </View>

        {/* Log Content Card */}
        <View className="ml-5 flex-1 rounded-2xl border border-border/40 bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
          <View className="flex-row items-center gap-2.5">
            <Avatar uri={actorAvatar} name={actorName} size="sm" />
            <View className="flex-1">
              <Text className="text-xs font-semibold text-muted-foreground">{actorName}</Text>
              <Text className="mt-0.5 text-xs text-muted-foreground/75">
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          </View>

          <Text className="mt-2.5 text-sm font-medium leading-relaxed text-foreground">
            {logText}
          </Text>

          {/* Reason Box */}
          {!!item.reason && (
            <View className="mt-2.5 rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 dark:bg-rose-500/10">
              <Text className="text-xs font-semibold italic text-rose-500 dark:text-rose-400">
                Lý do: "{item.reason}"
              </Text>
            </View>
          )}

          {/* Settings Changed Diff */}
          {item.action === "update_settings" &&
            item.metadata?.changedFields &&
            (() => {
              const changedEntries = Object.entries(item.metadata.changedFields).filter(
                ([_, diff]: [string, any]) => {
                  if (!diff) return false;
                  return JSON.stringify(diff.old) !== JSON.stringify(diff.new);
                },
              );
              if (changedEntries.length === 0) return null;
              return (
                <View className="mt-2.5 rounded-xl border border-border/40 bg-muted/40 p-3">
                  <Text className="mb-1.5 text-xs font-bold text-muted-foreground">
                    Chi tiết thay đổi:
                  </Text>
                  {changedEntries.map(([field, diff]: [string, any]) => {
                    const label = fieldLabels[field] || field;
                    return (
                      <View key={field} className="mt-1 flex-row flex-wrap items-center">
                        <Text className="mr-1.5 text-xs font-semibold text-foreground">
                          {label}:
                        </Text>
                        <Text className="mr-1 text-xs font-semibold text-muted-foreground line-through">
                          {formatVal(field, diff.old)}
                        </Text>
                        <Text className="mr-1 text-xs font-bold text-primary">➔</Text>
                        <Text className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {formatVal(field, diff.new)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}
        </View>
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
          <Text className="text-lg font-bold text-foreground">Nhật ký kiểm duyệt</Text>
          <Pressable onPress={handleRefresh} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="text-[15px] font-semibold text-primary">Tải lại</Text>
          </Pressable>
        </View>

        {/* Timeline Log List */}
        {isLoading && accumulatedLogs.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-3 text-muted-foreground">Đang tải nhật ký kiểm duyệt...</Text>
          </View>
        ) : (
          <FlatList
            data={accumulatedLogs}
            keyExtractor={(item) => item.logId}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            renderItem={renderLogItem}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isFetching ? (
                <View className="items-center justify-center py-4">
                  <ActivityIndicator size="small" color="#3b82f6" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="mt-16 items-center gap-3 p-8">
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <History size={32} color="#3b82f6" />
                </View>
                <Text className="mt-2 text-center text-lg font-bold text-foreground">
                  Chưa có hoạt động nào
                </Text>
                <Text className="text-center text-sm text-muted-foreground">
                  Lịch sử kiểm duyệt của các thành viên Ban quản trị sẽ hiển thị tại đây.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
