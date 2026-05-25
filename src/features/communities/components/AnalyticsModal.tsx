import { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Activity,
  Award,
  BarChart2,
  Calendar,
  FileText,
  MessageCircle,
  MessageSquare,
  ThumbsUp,
  Users,
  X,
} from "lucide-react-native";
import { useGetCommunityAnalyticsQuery } from "@/store/api/communityApi";
import { useIconColors } from "@/hooks/useIconColors";
import { extractTextFromTiptapJson } from "@/utils/tiptapText";

/**
 * Trích xuất văn bản sạch từ nội dung bài viết (Tiptap JSON) và rút gọn.
 */
const getCleanPostContent = (content: string, maxLength: number = 80): string => {
  if (!content) return "";
  const cleanText = extractTextFromTiptapJson(content);
  if (cleanText.length <= maxLength) return cleanText;
  return `${cleanText.slice(0, maxLength)}...`;
};

export interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  mutedColor: string;
  foregroundColor: string;
}

export function AnalyticsModal({
  open,
  onClose,
  groupId,
  mutedColor,
  foregroundColor,
}: AnalyticsModalProps) {
  const [days, setDays] = useState<number>(30);
  const [activeChart, setActiveChart] = useState<"members" | "interactions">("members");
  const { isDark } = useIconColors();

  const {
    data: analytics,
    isLoading,
    isFetching,
    refetch,
  } = useGetCommunityAnalyticsQuery({ groupId, days }, { skip: !open });

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setDays(30);
      setActiveChart("members");
    }
  }, [groupId, open]);

  const summary = analytics?.summary;
  const trend = analytics?.trend ?? [];
  const topPosts = analytics?.topPosts ?? [];

  // Member chart logic
  const maxMemberVal = useMemo(() => {
    if (trend.length === 0) return 1;
    return Math.max(...trend.map((p) => Math.max(p.newMembers, p.leftMembers, 1)));
  }, [trend]);

  // Interaction chart logic
  const maxInteractionVal = useMemo(() => {
    if (trend.length === 0) return 1;
    return Math.max(...trend.map((p) => Math.max(p.posts + p.comments + p.messages, 1)));
  }, [trend]);

  // Format date to DD/MM
  const formatDate = (dateStr: string) => {
    const parts = dateStr.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
  };

  const totalPeriodNewMembers = useMemo(() => {
    return trend.reduce((sum, p) => sum + p.newMembers, 0);
  }, [trend]);

  const totalPeriodLeftMembers = useMemo(() => {
    return trend.reduce((sum, p) => sum + p.leftMembers, 0);
  }, [trend]);

  return (
    <Modal visible={open} animationType="slide">
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-neutral-950" : "bg-neutral-50"}`}
        edges={["top", "bottom"]}
      >
        {/* Header Modal */}
        <View
          className={`flex-row items-center justify-between border-b px-4 py-3 ${isDark ? "border-neutral-900 bg-neutral-950" : "border-neutral-200 bg-white"}`}
        >
          <Pressable onPress={onClose} className="rounded-xl p-2 active:opacity-70">
            <X size={20} color={isDark ? foregroundColor : "#131722"} />
          </Pressable>
          <Text className={`text-lg font-bold ${isDark ? "text-white" : "text-neutral-900"}`}>
            Thống kê hoạt động
          </Text>
          <Pressable onPress={() => refetch()} className="rounded-xl px-3 py-2 active:opacity-70">
            <Text className="text-[14px] font-semibold text-primary">Tải lại</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View
            className={`flex-1 items-center justify-center ${isDark ? "bg-neutral-950" : "bg-neutral-50"}`}
          >
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className={`mt-3 text-sm ${isDark ? "text-neutral-400" : "text-neutral-500"}`}>
              Đang tải số liệu thống kê...
            </Text>
          </View>
        ) : (
          <ScrollView
            className={`flex-1 ${isDark ? "bg-neutral-950" : "bg-neutral-50"}`}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          >
            {/* Range Selector */}
            <View className="mb-6 flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <Calendar size={16} color={isDark ? "#94a3b8" : "#64748b"} />
                <Text
                  className={`text-sm font-semibold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  Thời gian:
                </Text>
              </View>
              <View
                className={`flex-row rounded-xl border p-1 ${isDark ? "border-neutral-800 bg-neutral-900/80" : "border-neutral-300 bg-neutral-200/50"}`}
              >
                {[
                  { label: "7 ngày", value: 7 },
                  { label: "30 ngày", value: 30 },
                  { label: "90 ngày", value: 90 },
                ].map((item) => (
                  <Pressable
                    key={item.value}
                    onPress={() => setDays(item.value)}
                    className={`rounded-lg px-3 py-1.5 ${
                      days === item.value ? "bg-primary" : "bg-transparent"
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        days === item.value
                          ? "text-white"
                          : isDark
                            ? "text-neutral-400"
                            : "text-neutral-600"
                      }`}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* KPI Cards Row */}
            <View className="mb-6 flex-row flex-wrap gap-3">
              {/* Card 1: Members */}
              <View
                className={`flex-[1_1_45%] rounded-2xl border p-4 ${isDark ? "border-neutral-900 bg-neutral-900/40" : "border-neutral-200 bg-white shadow-sm"}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-[12px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                  >
                    Thành viên
                  </Text>
                  <View className="rounded-lg bg-emerald-500/10 p-1.5">
                    <Users size={14} color="#10b981" />
                  </View>
                </View>
                <Text
                  className={`mt-2 text-xl font-extrabold ${isDark ? "text-white" : "text-neutral-900"}`}
                >
                  {summary?.totalMembers ?? 0}
                </Text>
                <Text
                  className={`mt-1 text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  Kỳ này:{" "}
                  <Text className="font-bold text-emerald-500">+{totalPeriodNewMembers}</Text> |{" "}
                  <Text className="font-bold text-rose-500">-{totalPeriodLeftMembers}</Text>
                </Text>
              </View>

              {/* Card 2: Interactive contents */}
              <View
                className={`flex-[1_1_45%] rounded-2xl border p-4 ${isDark ? "border-neutral-900 bg-neutral-900/40" : "border-neutral-200 bg-white shadow-sm"}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-[12px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                  >
                    Bài viết
                  </Text>
                  <View className="rounded-lg bg-indigo-500/10 p-1.5">
                    <FileText size={14} color="#6366f1" />
                  </View>
                </View>
                <Text
                  className={`mt-2 text-xl font-extrabold ${isDark ? "text-white" : "text-neutral-900"}`}
                >
                  {summary?.totalPosts ?? 0}
                </Text>
                <Text
                  className={`mt-1 text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  Bình luận mới:{" "}
                  <Text className="font-bold text-indigo-500">+{summary?.totalComments ?? 0}</Text>
                </Text>
              </View>

              {/* Card 3: Messages */}
              <View
                className={`flex-[1_1_45%] rounded-2xl border p-4 ${isDark ? "border-neutral-900 bg-neutral-900/40" : "border-neutral-200 bg-white shadow-sm"}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-[12px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                  >
                    Tin nhắn chat
                  </Text>
                  <View className="rounded-lg bg-sky-500/10 p-1.5">
                    <MessageSquare size={14} color="#0ea5e9" />
                  </View>
                </View>
                <Text
                  className={`mt-2 text-xl font-extrabold ${isDark ? "text-white" : "text-neutral-900"}`}
                >
                  {summary?.totalMessages ?? 0}
                </Text>
                <Text
                  className={`mt-1 text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  Trong phòng chat liên kết
                </Text>
              </View>

              {/* Card 4: Active Interactions */}
              <View
                className={`flex-[1_1_45%] rounded-2xl border p-4 ${isDark ? "border-neutral-900 bg-neutral-900/40" : "border-neutral-200 bg-white shadow-sm"}`}
              >
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-[12px] font-bold ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                  >
                    Tương tác
                  </Text>
                  <View className="rounded-lg bg-amber-500/10 p-1.5">
                    <Activity size={14} color="#f59e0b" />
                  </View>
                </View>
                <Text
                  className={`mt-2 text-xl font-extrabold ${isDark ? "text-white" : "text-neutral-900"}`}
                >
                  {summary?.activeInteractionsCount ?? 0}
                </Text>
                <Text
                  className={`mt-1 text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                >
                  Tổng tương tác kỳ này
                </Text>
              </View>
            </View>

            {/* Custom Bar Chart Block */}
            <View
              className={`mb-6 rounded-2xl border p-4 ${isDark ? "border-neutral-900 bg-neutral-900/20" : "border-neutral-200 bg-white shadow-sm"}`}
            >
              <View className="mb-4 flex-row items-center justify-between">
                <Text className={`text-sm font-bold ${isDark ? "text-white" : "text-neutral-900"}`}>
                  Biểu đồ xu hướng
                </Text>
                <View
                  className={`flex-row rounded-lg border p-0.5 ${isDark ? "border-neutral-800 bg-neutral-900" : "border-neutral-300 bg-neutral-200/50"}`}
                >
                  <Pressable
                    onPress={() => setActiveChart("members")}
                    className={`rounded-md px-2 py-1 ${
                      activeChart === "members"
                        ? isDark
                          ? "bg-neutral-800"
                          : "shadow-xs bg-white"
                        : ""
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${activeChart === "members" ? (isDark ? "text-white" : "text-neutral-900") : isDark ? "text-neutral-400" : "text-neutral-500"}`}
                    >
                      Thành viên
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActiveChart("interactions")}
                    className={`rounded-md px-2 py-1 ${
                      activeChart === "interactions"
                        ? isDark
                          ? "bg-neutral-800"
                          : "shadow-xs bg-white"
                        : ""
                    }`}
                  >
                    <Text
                      className={`text-[10px] font-bold ${activeChart === "interactions" ? (isDark ? "text-white" : "text-neutral-900") : isDark ? "text-neutral-400" : "text-neutral-500"}`}
                    >
                      Tương tác
                    </Text>
                  </Pressable>
                </View>
              </View>

              {trend.length === 0 ? (
                <View className="h-40 items-center justify-center">
                  <Text className={`text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    Không có dữ liệu xu hướng
                  </Text>
                </View>
              ) : (
                <View className="h-56">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row items-end px-2 pt-6">
                      {trend.map((point) => {
                        if (activeChart === "members") {
                          const newHeight = (point.newMembers / maxMemberVal) * 140;
                          const leftHeight = (point.leftMembers / maxMemberVal) * 140;
                          return (
                            <View key={point.date} className="mx-2 items-center justify-end">
                              <View className="flex-row items-end gap-1" style={{ height: 140 }}>
                                <View
                                  className="w-2.5 rounded-t-sm bg-emerald-500"
                                  style={{ height: Math.max(newHeight, 3) }}
                                />
                                <View
                                  className="w-2.5 rounded-t-sm bg-rose-500"
                                  style={{ height: Math.max(leftHeight, 3) }}
                                />
                              </View>
                              <Text
                                className={`mt-2 text-[9px] font-semibold ${isDark ? "text-neutral-500" : "text-neutral-400"}`}
                              >
                                {formatDate(point.date)}
                              </Text>
                            </View>
                          );
                        } else {
                          const val = point.posts + point.comments + point.messages;
                          const barHeight = (val / maxInteractionVal) * 140;
                          return (
                            <View key={point.date} className="mx-3 items-center justify-end">
                              <View className="justify-end" style={{ height: 140 }}>
                                <View
                                  className="w-4 rounded-t bg-indigo-500"
                                  style={{ height: Math.max(barHeight, 3) }}
                                />
                              </View>
                              <Text
                                className={`mt-2 text-[9px] font-semibold ${isDark ? "text-neutral-500" : "text-neutral-400"}`}
                              >
                                {formatDate(point.date)}
                              </Text>
                            </View>
                          );
                        }
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              {/* Chart Legend */}
              <View
                className={`mt-4 flex-row justify-center gap-4 border-t pt-3 ${isDark ? "border-neutral-900/60" : "border-neutral-200"}`}
              >
                {activeChart === "members" ? (
                  <>
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <Text
                        className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                      >
                        Gia nhập mới
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <View className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                      <Text
                        className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                      >
                        Rời/Chặn
                      </Text>
                    </View>
                  </>
                ) : (
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    <Text
                      className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                    >
                      Tổng tương tác (Post+Cmt+Chat)
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Top 5 Content Section */}
            <View
              className={`rounded-2xl border p-4 ${isDark ? "border-neutral-900 bg-neutral-900/10" : "border-neutral-200 bg-white shadow-sm"}`}
            >
              <View className="mb-4 flex-row items-center gap-2">
                <Award size={18} color="#eab308" />
                <Text className={`text-sm font-bold ${isDark ? "text-white" : "text-neutral-900"}`}>
                  Top bài viết nổi bật nhất
                </Text>
              </View>

              {topPosts.length === 0 ? (
                <View className="items-center justify-center py-6">
                  <Text className={`text-xs ${isDark ? "text-neutral-500" : "text-neutral-400"}`}>
                    Chưa có bài viết xếp hạng
                  </Text>
                </View>
              ) : (
                topPosts.map((post, index) => {
                  const reactionsCount =
                    typeof post.reactionsCount === "object" && post.reactionsCount !== null
                      ? Object.values(post.reactionsCount).reduce((a, b) => a + b, 0)
                      : Number(post.reactionsCount ?? 0);
                  const score = reactionsCount + (post.commentsCount ?? 0) * 2;
                  return (
                    <View
                      key={post.postId}
                      className={`mb-3 flex-row items-center justify-between rounded-xl border p-3 ${isDark ? "border-neutral-900 bg-neutral-900/40" : "shadow-xs border-neutral-100 bg-white"}`}
                    >
                      <View className="flex-1 flex-row items-center gap-3">
                        <View
                          className={`h-7 w-7 items-center justify-center rounded-lg ${
                            index === 0
                              ? "bg-amber-500/20"
                              : index === 1
                                ? "bg-zinc-400/20"
                                : index === 2
                                  ? "bg-amber-700/20"
                                  : isDark
                                    ? "bg-neutral-800"
                                    : "bg-neutral-200/60"
                          }`}
                        >
                          <Text
                            className={`text-xs font-black ${
                              index === 0
                                ? "text-amber-500"
                                : index === 1
                                  ? "text-zinc-400"
                                  : index === 2
                                    ? "text-amber-700"
                                    : isDark
                                      ? "text-neutral-400"
                                      : "text-neutral-500"
                            }`}
                          >
                            #{index + 1}
                          </Text>
                        </View>
                        <View className="flex-1 pr-2">
                          <Text
                            className={`text-xs font-semibold ${isDark ? "text-neutral-200" : "text-neutral-800"}`}
                            numberOfLines={1}
                          >
                            {getCleanPostContent(post.content) || "Bài viết đa phương tiện"}
                          </Text>
                          <Text
                            className={`mt-0.5 text-[10px] ${isDark ? "text-neutral-500" : "text-neutral-400"}`}
                          >
                            {post.authorInfo?.displayName || "Ban quản trị"}
                          </Text>
                        </View>
                      </View>

                      <View className="shrink-0 items-end gap-1">
                        <View className="flex-row items-center gap-2">
                          <View className="flex-row items-center gap-0.5">
                            <ThumbsUp size={10} color={isDark ? "#94a3b8" : "#64748b"} />
                            <Text
                              className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                            >
                              {reactionsCount}
                            </Text>
                          </View>
                          <View className="flex-row items-center gap-0.5">
                            <MessageCircle size={10} color={isDark ? "#94a3b8" : "#64748b"} />
                            <Text
                              className={`text-[10px] ${isDark ? "text-neutral-400" : "text-neutral-500"}`}
                            >
                              {post.commentsCount ?? 0}
                            </Text>
                          </View>
                        </View>
                        <Text className="text-[9px] font-bold text-primary">Điểm: {score}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
