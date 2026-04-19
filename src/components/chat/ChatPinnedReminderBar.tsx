import { useCallback, useMemo, useState, type ReactElement } from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarClock, ChevronDown, ChevronUp, Pin, Pencil } from "lucide-react-native";

import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatChatPreviewLine, truncatePreview } from "@/utils/messageDisplay";
import { formatConversationListActivityTime } from "@/utils/time";
import { normalizeMediaUrl } from "@/utils/url";

function isHttpUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export interface GroupTaskRow {
  taskId: string;
  title: string;
  dueDate?: string;
  status: string;
}

function parseGroupTasks(raw: unknown[]): GroupTaskRow[] {
  return raw
    .map((t) => {
      const o = t as Record<string, unknown>;
      return {
        taskId: String(o.taskId ?? "").trim(),
        title: String(o.title ?? "Công việc").trim() || "Công việc",
        dueDate: o.dueDate ? String(o.dueDate) : undefined,
        status: String(o.status ?? "todo"),
      };
    })
    .filter((x) => x.taskId);
}

function upcomingTasksSorted(tasks: GroupTaskRow[]): GroupTaskRow[] {
  const open = tasks.filter((t) => t.status !== "done");
  return open.sort((a, b) => {
    const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}

function formatDueVi(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function parseTasksEnvelope(raw: unknown[] | undefined): GroupTaskRow[] {
  if (!raw || !Array.isArray(raw)) return [];
  return parseGroupTasks(raw);
}

/** Dòng chính + phụ cho một tin ghim (gần với Zalo). */
export function pinnedMessageDisplay(
  msg: IMessage,
  viewerId: string,
): { primary: string; subtitle: string; thumbUri?: string } {
  const sender = msg.senderDisplayName?.trim() || "Người dùng";
  const subtitle = `Tin nhắn của ${sender}`;

  if (msg.isRecalled) {
    return { primary: "Tin nhắn đã được thu hồi", subtitle };
  }
  if (msg.type === "image") {
    const thumb = normalizeMediaUrl(msg.thumbnailUrl ?? msg.mediaUrl);
    return { primary: "[Hình ảnh]", subtitle, thumbUri: thumb };
  }
  if (msg.type === "video") {
    const thumb = normalizeMediaUrl(msg.thumbnailUrl ?? msg.mediaUrl);
    return { primary: "[Video]", subtitle, thumbUri: thumb };
  }
  if (msg.type === "file") {
    const name = msg.mediaOriginalName?.trim() || formatChatPreviewLine(msg, viewerId);
    return { primary: `[File] ${truncatePreview(name, 56)}`, subtitle };
  }
  const raw = (msg.content ?? "").trim();
  if (isHttpUrl(raw)) {
    return { primary: `[Link] ${truncatePreview(raw, 52)}`, subtitle };
  }
  return { primary: formatChatPreviewLine(msg, viewerId), subtitle };
}

export interface ChatPinnedReminderBarProps {
  pinnedMessages: IMessage[];
  /** Dữ liệu thô từ GET /groups/:id/tasks (chỉ nhóm). */
  tasksRaw?: unknown[];
  isGroup: boolean;
  currentUserId: string;
  onJumpToMessage: (messageId: string) => void;
  /** Mở quản lý tin ghim (vd. modal nhóm → tab ghim). */
  onManagePins?: () => void;
}

/**
 * Thanh ghim + mở rộng: nhắc hẹn / task nhóm + danh sách ghim (layout tham chiếu Zalo).
 */
export function ChatPinnedReminderBar({
  pinnedMessages,
  tasksRaw,
  isGroup,
  currentUserId,
  onJumpToMessage,
  onManagePins,
}: ChatPinnedReminderBarProps): ReactElement | null {
  const insets = useSafeAreaInsets();
  const { primary, muted } = useIconColors();
  const calendarNow = useCalendarNow();
  const [expanded, setExpanded] = useState(false);

  const tasks = useMemo(() => (isGroup ? upcomingTasksSorted(parseTasksEnvelope(tasksRaw)) : []), [isGroup, tasksRaw]);

  /** Nhóm: luôn có thanh vào panel; chat đôi: chỉ khi có ghim/task. */
  const showBar = isGroup || pinnedMessages.length > 0 || tasks.length > 0;
  const latestPin = pinnedMessages[0];
  const extraPinCount = Math.max(0, pinnedMessages.length - 1);

  const collapse = useCallback(() => setExpanded(false), []);

  const openManage = useCallback(() => {
    setExpanded(false);
    onManagePins?.();
  }, [onManagePins]);

  if (!showBar) return null;

  const emptyGroupStrip = isGroup && !latestPin && tasks.length === 0;
  const collapsedPrimary = emptyGroupStrip
    ? "Nhắc hẹn & tin ghim"
    : latestPin
      ? pinnedMessageDisplay(latestPin, currentUserId).primary
      : tasks[0]
        ? tasks[0].title
        : "";
  const collapsedSecondary = emptyGroupStrip
    ? "Chạm để xem công việc và tin đã ghim"
    : latestPin
      ? pinnedMessageDisplay(latestPin, currentUserId).subtitle
      : tasks[0]
        ? formatDueVi(tasks[0].dueDate)
          ? `Hạn: ${formatDueVi(tasks[0].dueDate)}`
          : "Công việc nhóm"
        : "";

  const pinTimeLine =
    latestPin && !emptyGroupStrip ? formatConversationListActivityTime(latestPin.createdAt, calendarNow) : null;

  const winH = Dimensions.get("window").height;
  const sheetTop = insets.top + 52;
  const sheetMaxH = winH * 0.88 - sheetTop;

  const collapsedIcon =
    latestPin && !emptyGroupStrip ? (
      <Pin size={18} color={primary} strokeWidth={2.2} />
    ) : tasks[0] && !latestPin ? (
      <CalendarClock size={18} color={primary} strokeWidth={2.2} />
    ) : (
      <Pin size={18} color={primary} strokeWidth={2.2} />
    );

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        className="flex-row items-center gap-2.5 border-b border-border bg-muted/90 px-3 py-2.5 active:bg-muted"
        android_ripple={{ color: "rgba(0,0,0,0.06)" }}
      >
        {collapsedIcon}
        <View className="min-w-0 flex-1">
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            {collapsedPrimary}
          </Text>
          {collapsedSecondary ? (
            <View className="mt-0.5">
              <Text className="text-[12px] text-muted-foreground" numberOfLines={1}>
                {collapsedSecondary}
              </Text>
              {pinTimeLine ? (
                <Text className="mt-0.5 text-[11px] font-medium text-muted-foreground/90" numberOfLines={1}>
                  {pinTimeLine}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        {extraPinCount > 0 ? (
          <View className="rounded-lg border border-border bg-card px-2 py-0.5">
            <Text className="text-[12px] font-bold text-primary">+{extraPinCount}</Text>
          </View>
        ) : null}
        <ChevronDown size={20} color={muted} strokeWidth={2} />
      </Pressable>

      <Modal visible={expanded} animationType="fade" transparent statusBarTranslucent onRequestClose={collapse}>
        <View className="flex-1 justify-start">
          <Pressable className="absolute inset-0" onPress={collapse}>
            <View className="absolute inset-0 bg-black/45" />
          </Pressable>

          <View
            className="absolute left-0 right-0 overflow-hidden rounded-b-2xl border-b border-border bg-card px-4"
            style={{ top: sheetTop, maxHeight: sheetMaxH, paddingTop: 12 }}
          >
            <View style={{ flex: 1, minHeight: 200 }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <Text className="mb-2.5 mt-1 text-base font-bold text-foreground">Nhắc hẹn sắp tới</Text>
                {tasks.length === 0 ? (
                  <Text className="py-4 text-center text-sm text-muted-foreground">Chưa có nhắc hẹn nào</Text>
                ) : (
                  tasks.map((t) => {
                    const due = formatDueVi(t.dueDate);
                    return (
                      <View key={t.taskId} className="flex-row items-start border-b border-border py-2.5">
                        <CalendarClock size={18} color={primary} strokeWidth={2} />
                        <View className="ml-2.5 min-w-0 flex-1">
                          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
                            {t.title}
                          </Text>
                          {due ? (
                            <Text className="mt-1 text-[12px] text-muted-foreground" numberOfLines={1}>
                              Hạn: {due}
                            </Text>
                          ) : (
                            <Text className="mt-1 text-[12px] text-muted-foreground" numberOfLines={1}>
                              {t.status === "in_progress" ? "Đang thực hiện" : "Chưa hoàn thành"}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}

                <Text className="mb-2.5 mt-5 text-base font-bold text-foreground">Danh sách ghim</Text>
                {pinnedMessages.length === 0 ? (
                  <Text className="py-4 text-center text-sm text-muted-foreground">Chưa có tin nhắn ghim</Text>
                ) : (
                  pinnedMessages.map((m) => {
                    const row = pinnedMessageDisplay(m, currentUserId);
                    const thumb = row.thumbUri ? normalizeMediaUrl(row.thumbUri) : undefined;
                    const sentAt = formatConversationListActivityTime(m.createdAt, calendarNow);
                    return (
                      <Pressable
                        key={m.messageId}
                        className="flex-row items-center border-b border-border py-2.5 active:bg-muted/60"
                        onPress={() => {
                          collapse();
                          onJumpToMessage(m.messageId);
                        }}
                      >
                        <Pin size={18} color={primary} strokeWidth={2} />
                        <View className="ml-2.5 min-w-0 flex-1">
                          <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
                            {row.primary}
                          </Text>
                          <Text className="mt-1 text-[12px] text-muted-foreground" numberOfLines={1}>
                            {row.subtitle}
                            {sentAt ? ` · ${sentAt}` : ""}
                          </Text>
                        </View>
                        {thumb ? (
                          <Image source={{ uri: thumb }} className="h-12 w-12 rounded-lg bg-muted" resizeMode="cover" />
                        ) : (
                          <View className="h-12 w-12" />
                        )}
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>

            <View
              className="mt-1 flex-row items-center border-t border-border pt-3"
              style={{
                paddingBottom: Math.max(insets.bottom, 10),
                justifyContent: onManagePins ? "space-between" : "flex-end",
              }}
            >
              {onManagePins ? (
                <Pressable className="flex-row items-center gap-2 px-1 py-1.5 active:opacity-80" onPress={openManage} hitSlop={6}>
                  <Pencil size={18} color={primary} strokeWidth={2} />
                  <Text className="text-[15px] font-semibold text-primary">Chỉnh sửa</Text>
                </Pressable>
              ) : null}
              <Pressable className="flex-row items-center gap-2 px-1 py-1.5 active:opacity-80" onPress={collapse} hitSlop={6}>
                <ChevronUp size={20} color={primary} strokeWidth={2} />
                <Text className="text-[15px] font-semibold text-primary">Thu gọn</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
