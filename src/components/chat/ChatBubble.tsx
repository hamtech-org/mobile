import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AlarmClock,
  AlarmClockOff,
  Ban,
  AlertCircle,
  BarChart2,
  Check,
  CheckCheck,
  ClipboardList,
  MapPin,
  Pencil,
  Pin,
  PinOff,
  Phone,
  Trash2,
  Users,
  Video,
} from "lucide-react-native";

import { useCalendarNow } from "@/contexts/CalendarClockContext";
import {
  ChatJumpHighlightWrap,
  useChatJumpHighlightPulse,
} from "@/components/chat/ChatJumpHighlight";
import { CHAT_JUMP_HIGHLIGHT_BORDER } from "@/components/chat/chatMediaShell";
import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatFileSize } from "@/utils/file";
import {
  formatChatPreviewLine,
  getMessageTypeLabel,
  mapsUrlForLatLng,
  parseLocationPayload,
} from "@/utils/messageDisplay";
import {
  buildSystemBubbleView,
  isCenterPositionMessage,
  type SystemTextRowIcon,
} from "@/utils/systemMessage";
import {
  chatMessagesSameLocalDay,
  chatSystemPillShowDateLine,
  formatChatSystemPillDateLabel,
  formatChatSystemPillTime,
  formatTimestamp,
  isSameCalendarMinute,
} from "@/utils/time";
import { toast } from "@/utils/appToast";
import { TaskDeadlineChipMobile } from "@/utils/taskDeadlineDisplay";
import { resolveTaskAssigneeDisplayLabel } from "@/utils/taskAssigneeLabel";
import { isTaskJoinDeadlinePassed } from "@/utils/taskJoin";
import { mergePollWithGroupList, parsePollPayloadFromMessageContent } from "@/utils/groupPollMerge";
import { resolveGroupJoinLinkFromMessageContent } from "@/utils/groupJoinLinkMessage";
import { ChatFileMessageBubble } from "@/components/chat/ChatFileMessageBubble";
import { ChatImageMessageWithJoinQr } from "@/components/chat/ChatImageMessageWithJoinQr";
import type { ChatMediaLightboxState } from "@/components/chat/ChatMediaLightbox";
import { ChatVideoMessageCard } from "@/components/chat/ChatVideoMessageCard";
import { chatMediaCaptionStyle, getChatMediaLayout } from "@/components/chat/chatMediaShell";
import {
  chatFilePreviewUrl,
  chatImageDisplayUrl,
  chatMediaDownloadFilename,
  chatMediaDownloadUrl,
  chatVideoPlayUrl,
  resolveChatFileBubbleMeta,
} from "@/utils/chatMediaDisplay";
import {
  downloadChatFileToDevice,
  openDownloadsFolderHint,
  openOrShareChatFile,
  saveChatMediaToLibrary,
} from "@/utils/chatMediaDownload";

import { GroupJoinLinkCard } from "./GroupJoinLinkCard";
import type { PollVoteModalPoll } from "./PollVoteModal";
import { VoiceMessagePlayer } from "./VoiceMessagePlayer";
import { router } from "expo-router";
import { parseMentionTokens } from "@/utils/mentionHelper";

const CHAT_URL_REGEX = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const TRAILING_URL_PUNCTUATION_REGEX = /[),.!?;:]+$/;

function splitTrailingUrlPunctuation(raw: string): { url: string; suffix: string } {
  const match = raw.match(TRAILING_URL_PUNCTUATION_REGEX);
  if (!match?.[0]) return { url: raw, suffix: "" };
  const suffix = match[0];
  return { url: raw.slice(0, -suffix.length), suffix };
}

function hrefFromChatUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function LinkifiedChatTextInline({
  text,
  linkClassName,
}: {
  text: string;
  linkClassName: string;
}): ReactNode {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  CHAT_URL_REGEX.lastIndex = 0;

  while ((match = CHAT_URL_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const start = match.index;
    if (start > cursor) nodes.push(text.slice(cursor, start));

    const { url, suffix } = splitTrailingUrlPunctuation(raw);
    if (url) {
      const href = hrefFromChatUrl(url);
      nodes.push(
        <Text
          key={`${start}-${url}`}
          className={linkClassName}
          onPress={(event) => {
            event.stopPropagation?.();
            void Linking.openURL(href);
          }}
        >
          {url}
        </Text>,
      );
    }
    if (suffix) nodes.push(suffix);
    cursor = start + raw.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes.length > 0 ? nodes : text}</>;
}

function LinkifiedChatText({
  text,
  className,
  linkClassName,
}: {
  text: string;
  className: string;
  linkClassName: string;
}): ReactElement {
  return (
    <Text className={className}>
      <LinkifiedChatTextInline text={text} linkClassName={linkClassName} />
    </Text>
  );
}

function MentionifiedChatText({
  text,
  className,
  linkClassName,
  isOwn,
  isVisualMedia,
  style,
}: {
  text: string;
  className?: string;
  linkClassName?: string;
  isOwn: boolean;
  isVisualMedia: boolean;
  style?: any;
}): ReactElement {
  const tokens = parseMentionTokens(text);

  if (tokens.length === 0) {
    return <Text className={className} style={style} />;
  }

  return (
    <Text className={className} style={style}>
      {tokens.map((token, index) => {
        if (token.type === "text") {
          return (
            <LinkifiedChatTextInline
              key={index}
              text={token.value}
              linkClassName={linkClassName ?? ""}
            />
          );
        }
        if (token.userId === "all") {
          return (
            <Text
              key={index}
              style={{
                fontWeight: "bold",
                color: isOwn && !isVisualMedia ? "#fed7aa" : "#ea580c",
                backgroundColor:
                  isOwn && !isVisualMedia ? "rgba(255,255,255,0.2)" : "rgba(249,115,22,0.1)",
                paddingHorizontal: 4,
                borderRadius: 2,
              }}
            >
              @{token.value}
            </Text>
          );
        }
        return (
          <Text
            key={index}
            style={{
              fontWeight: "bold",
              textDecorationLine: "underline",
              color: isOwn && !isVisualMedia ? "#dbeafe" : "#0284c7",
            }}
            onPress={(event) => {
              event.stopPropagation?.();
              if (token.userId) {
                router.push(`/(main)/(newsfeed)/user/${token.userId}`);
              }
            }}
          >
            @{token.value}
          </Text>
        );
      })}
    </Text>
  );
}

/** Dữ liệu nhóm để card giao việc / nút bình chọn (chỉ khi `isGroup`). */
export interface ChatBubbleGroupExtras {
  conversationId: string;
  currentUserId: string;
  /** Map tên hiển thị — giống web `groupMembers` + `byId`. */
  groupMembers?: { userId: string; displayName: string }[];
  groupTasks: {
    taskId?: string;
    creatorId?: string;
    participants?: string[];
    assignees?: string[];
    assignToAll?: boolean;
    broadcast?: boolean;
    dueDate?: string;
    subtasks?: { assigneeId?: string; content?: string; done?: boolean }[];
  }[];
  /** Optional backend call. For local-only demo, this can be a no-op. */
  joinTask?: (taskId: string) => Promise<void>;
  onTaskJoined?: (taskId: string) => void;
  onOpenPollVote: (pollId: string) => void;
  /** Danh sách poll nhóm (API) — preview trong bubble `type: "poll"` + meta tin `poll_created`. */
  groupPolls?: PollVoteModalPoll[];
  /** Tin system `task_updated` — nhảy tới thẻ giao việc trong luồng (giống web «Xem»). */
  onJumpToTaskCard?: (taskId: string) => void;
  /** Tin system `task_due` — mở modal nhóm tab công việc (giống web «Mở công việc»). */
  onOpenGroupTaskSheet?: (taskId: string) => void;
  /** Chỉ người tạo task — mở modal nhóm + editor (giống web). */
  onEditGroupTask?: (taskId: string) => void;
  onDeleteGroupTask?: (taskId: string) => void;
}

interface ChatBubbleProps {
  message: IMessage;
  isOwn: boolean;
  /** User đang xem — dùng cho system JSON (ai là "Bạn"). */
  viewerUserId?: string | null;
  /** Có phải tin nhắn trong group không — để hiện sender name */
  isGroup?: boolean;
  /** Tin nhắn trước đó (để quyết định hiện sender name / date separator) */
  prevMessage?: IMessage;
  /** Tin nhắn sau (để quyết định hiện timestamp) */
  nextMessage?: IMessage;
  /** Callback khi long-press để mở action sheet */
  onLongPress?: (message: IMessage) => void;
  /** Callback khi nhấn vào reply-to để scroll đến tin gốc */
  onPressReplyTo?: (messageId: string) => void;
  /** Viền nhấp nháy khi nhảy tới tin (ghim / trích dẫn) — giống web `jumpHighlightMessageId`. */
  isJumpHighlighted?: boolean;
  /** Thông tin nhóm: join task, mở poll (tuỳ chọn) */
  groupExtras?: ChatBubbleGroupExtras;
  /** Xem ảnh/video toàn màn hình (lightbox ở màn chat). */
  onMediaLightbox?: (state: ChatMediaLightboxState) => void;
}

// ── Call Log Message ────────────────────────────────────────────────────

function CallLogMessage({
  message,
  isOwn,
  showTimestampFooter,
}: {
  message: IMessage;
  isOwn: boolean;
  showTimestampFooter?: boolean;
}) {
  const { primary } = useIconColors();
  let kind = "completed";
  let callType = "audio";
  let durationSec = 0;

  try {
    const obj = JSON.parse(message.content) as Record<string, unknown>;
    kind = String(obj?.kind ?? "completed");
    callType = String(obj?.callType ?? "audio");
    durationSec = Number(obj?.durationSec ?? 0);
  } catch {
    // ignore
  }

  const title =
    kind === "missed"
      ? "Cuộc gọi nhỡ"
      : kind === "rejected"
        ? "Cuộc gọi bị từ chối"
        : kind === "cancelled" && isOwn
          ? callType === "video"
            ? "Bạn đã hủy cuộc gọi video"
            : "Bạn đã hủy cuộc gọi thoại"
          : kind === "cancelled" && !isOwn
            ? "Cuộc gọi nhỡ"
            : callType === "video"
              ? "Cuộc gọi video"
              : "Cuộc gọi thoại";

  const durationLabel =
    kind === "missed" || kind === "rejected" || kind === "cancelled"
      ? ""
      : durationSec > 0
        ? `${Math.floor(durationSec / 60)} phút ${durationSec % 60} giây`
        : "";

  const IconComponent = callType === "video" ? Video : Phone;
  const iconColor = kind === "missed" || (kind === "cancelled" && !isOwn) ? "#ef4444" : primary;

  const footerTime =
    showTimestampFooter && message.createdAt ? formatTimestamp(message.createdAt) : "";

  return (
    <View className={`my-3 px-4 ${isOwn ? "items-end" : "items-start"}`}>
      <View
        className={`min-w-[220px] max-w-[85%] items-center rounded-2xl border border-border/30 bg-muted/40 px-5 py-3 ${
          isOwn ? "self-end" : "self-start"
        }`}
      >
        <View className="mb-1 flex-row items-center gap-2">
          <IconComponent size={16} color={iconColor} strokeWidth={1.5} />
          <Text className="text-sm font-bold text-foreground">{title}</Text>
        </View>
        {durationLabel ? (
          <Text className="text-xs text-muted-foreground">{durationLabel}</Text>
        ) : null}
      </View>
      {footerTime ? (
        <View className={`mt-0.5 px-1 ${isOwn ? "self-end" : "self-start"}`}>
          <Text className="text-[11px] text-muted-foreground">{footerTime}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Pill giờ phía trên thẻ system — giờ trước mốc: «7:00 Hôm nay», «10:00 Hôm qua», «10:00 13/05/2026». */
function SystemNotifyTimePill({
  createdAt,
  prevMessage,
  calendarNow,
  isGroup,
}: {
  createdAt?: string | null;
  prevMessage?: IMessage;
  calendarNow: Date;
  /** Nhóm: chip mốc ngày giữa luồng + pill chỉ giờ — đồng bộ web `daySepAboveSystem`. */
  isGroup?: boolean;
}) {
  const iso = createdAt?.trim();
  if (!iso) return null;
  const showDate = chatSystemPillShowDateLine(prevMessage?.createdAt, iso);
  const daySepAboveSystem = Boolean(isGroup) && showDate;
  const timeLabel = formatChatSystemPillTime(iso);
  const datePart = showDate ? formatChatSystemPillDateLabel(iso, calendarNow) : "";
  const pillText = (
    daySepAboveSystem ? timeLabel : showDate && datePart ? `${timeLabel} ${datePart}` : timeLabel
  ).trim();
  if (!pillText) return null;
  return (
    <Fragment>
      {daySepAboveSystem && datePart ? (
        <View className="min-h-[28px] w-full shrink-0 items-center justify-center py-2">
          <View className="rounded-full bg-muted/60 px-3 py-1 shadow-sm dark:bg-white/15">
            <Text className="text-[11px] font-semibold text-foreground/80 dark:text-white/85">
              {datePart}
            </Text>
          </View>
        </View>
      ) : null}
      <View className="mb-2 self-center rounded-full bg-black/10 px-3 py-1 dark:bg-white/10">
        <Text className="text-[11px] font-semibold text-muted-foreground" numberOfLines={1}>
          {pillText}
        </Text>
      </View>
    </Fragment>
  );
}

function SystemRowLeadingIcon({ kind }: { kind: SystemTextRowIcon }) {
  switch (kind) {
    case "pencil":
      return <Pencil size={16} color="#60a5fa" strokeWidth={2} />;
    case "pin":
      return <Pin size={16} color="#3b82f6" strokeWidth={2} />;
    case "pinOff":
      return <PinOff size={16} color="#3b82f6" strokeWidth={2} />;
    case "checkCheck":
      return <CheckCheck size={16} color="#16a34a" strokeWidth={2} />;
    case "alarmClock":
      return <AlarmClock size={16} color="#f97316" strokeWidth={2} />;
    case "alarmOff":
      return <AlarmClockOff size={16} color="#737373" strokeWidth={1.75} />;
    case "barChartBlue":
      return <BarChart2 size={16} color="#2563eb" strokeWidth={2} />;
    case "barChartOrange":
      return <BarChart2 size={16} color="#f97316" strokeWidth={2} />;
    case "barChartMuted":
      return <BarChart2 size={16} color="#737373" strokeWidth={2} />;
    default:
      return <Pencil size={16} color="#60a5fa" strokeWidth={2} />;
  }
}

// ── System center (JSON + card) ───────────────────────────────────────────

const SYSTEM_CENTER_SURFACE = "bg-card dark:bg-zinc-800/95";
/** Shell thẻ system — luôn `border-2` để không nhảy layout khi bấm «Xem» (khớp web). */
const SYSTEM_CENTER_SHELL_CLASS =
  "w-full max-w-[92%] self-center overflow-hidden rounded-2xl border-2 shadow-sm";
const SYSTEM_CENTER_BORDER_IDLE = "border-black/[0.06] dark:border-white/10";

/**
 * Viền nhảy tới tin (task / poll / cập nhật CV) — một lớp `border-2 border-blue-500` trên shell,
 * không overlay absolute (tránh vỡ flex hàng «Xem»).
 */
function SystemCenterCardChrome({
  isJumpHighlighted,
  innerClassName,
  children,
}: {
  isJumpHighlighted: boolean;
  innerClassName: string;
  children: ReactNode;
}) {
  const { borderColor, shadowOpacity } = useChatJumpHighlightPulse(isJumpHighlighted);
  const inner = <View className={innerClassName.trim()}>{children}</View>;

  if (!isJumpHighlighted) {
    return (
      <View
        className={`${SYSTEM_CENTER_SHELL_CLASS} ${SYSTEM_CENTER_BORDER_IDLE} ${SYSTEM_CENTER_SURFACE}`}
      >
        {inner}
      </View>
    );
  }

  return (
    <Animated.View
      className={`${SYSTEM_CENTER_SHELL_CLASS} ${SYSTEM_CENTER_SURFACE}`}
      style={{
        borderColor,
        shadowColor: CHAT_JUMP_HIGHLIGHT_BORDER,
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 14,
        shadowOpacity,
        elevation: 4,
      }}
    >
      {inner}
    </Animated.View>
  );
}

function SystemCenterBlock({
  message,
  isOwn,
  viewerUserId,
  groupExtras,
  calendarNow,
  prevMessage,
  isGroupChat,
  isJumpHighlighted = false,
}: {
  message: IMessage;
  isOwn: boolean;
  viewerUserId?: string | null;
  groupExtras?: ChatBubbleGroupExtras;
  calendarNow: Date;
  prevMessage?: IMessage;
  isGroupChat: boolean;
  /** Nhảy từ danh sách ghim / tìm tin — viền quanh thẻ (poll_created, task, …). */
  isJumpHighlighted?: boolean;
}) {
  const { muted } = useIconColors();
  // Re-render periodically so deadline highlight updates in realtime.
  const [, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (taskId?: string | null) => {
    const id = String(taskId ?? "").trim();
    if (!id) return;
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const view = useMemo(
    () =>
      buildSystemBubbleView(message, {
        isOwn,
        currentUserId: viewerUserId ?? groupExtras?.currentUserId,
        isGroupChat,
      }),
    [message, isOwn, viewerUserId, groupExtras?.currentUserId, isGroupChat],
  );

  const [joinBusy, setJoinBusy] = useState(false);

  if (view.variant === "task_assigned_card") {
    const isLocalCard = message.messageId.startsWith("local-task-card:");
    const tid = String(view.taskId ?? "").trim();
    const onBoard = (groupExtras?.groupTasks ?? []).some((x) => String(x.taskId ?? "") === tid);
    if (isLocalCard && tid && !tid.startsWith("tmp-") && !onBoard) {
      return null;
    }
  }

  if (view.variant === "text") {
    const rowIcon: SystemTextRowIcon = view.rowIcon ?? "pencil";
    return (
      <View className="my-3 w-full items-center px-4">
        <SystemNotifyTimePill
          createdAt={message.createdAt}
          prevMessage={prevMessage}
          calendarNow={calendarNow}
          isGroup={Boolean(groupExtras)}
        />
        <SystemCenterCardChrome
          isJumpHighlighted={isJumpHighlighted}
          innerClassName="flex-row flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2.5"
        >
          <View className="shrink-0 pt-0.5">
            <SystemRowLeadingIcon kind={rowIcon} />
          </View>
          <Text className="max-w-[90%] text-center text-[12px] font-medium leading-[18px] text-[#666666] dark:text-zinc-300">
            {view.text}
          </Text>
        </SystemCenterCardChrome>
      </View>
    );
  }

  if (view.variant === "poll_created_row") {
    const showVoteCta = Boolean(view.pollId && groupExtras?.onOpenPollVote);
    const line =
      `${view.actorLabel} đã tạo một bình chọn` + (view.question ? `: ${view.question}` : "");
    return (
      <View className="my-3 w-full items-center px-4">
        <SystemNotifyTimePill
          createdAt={message.createdAt}
          prevMessage={prevMessage}
          calendarNow={calendarNow}
          isGroup={Boolean(groupExtras)}
        />
        <SystemCenterCardChrome
          isJumpHighlighted={isJumpHighlighted}
          innerClassName="overflow-hidden rounded-2xl px-3 py-2.5"
        >
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <BarChart2 size={16} color="#f97316" strokeWidth={2} />
            <Text
              className="max-w-[88%] shrink text-center text-[12px] font-medium leading-[18px] text-[#666666] dark:text-zinc-300"
              numberOfLines={4}
            >
              {line}
            </Text>
            {showVoteCta ? (
              <Pressable
                onPress={() => groupExtras!.onOpenPollVote(view.pollId)}
                className="ml-1 shrink-0 rounded-full bg-orange-500 px-2 py-1"
                android_ripple={{ color: "rgba(255,255,255,0.25)" }}
              >
                <Text className="text-[11px] font-bold text-white">Bình chọn</Text>
              </Pressable>
            ) : null}
          </View>
        </SystemCenterCardChrome>
      </View>
    );
  }

  if (view.variant === "task_updated_row") {
    const tid = String(view.taskId ?? "").trim();
    const showXem = Boolean(tid && groupExtras?.onJumpToTaskCard);
    return (
      <View className="my-3 w-full items-center px-4">
        <SystemNotifyTimePill
          createdAt={message.createdAt}
          prevMessage={prevMessage}
          calendarNow={calendarNow}
          isGroup={Boolean(groupExtras)}
        />
        <SystemCenterCardChrome
          isJumpHighlighted={isJumpHighlighted}
          innerClassName="w-full min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5"
        >
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <Pencil size={16} color="#60a5fa" strokeWidth={2} />
            <Text
              className="min-w-0 flex-1 text-left text-[12px] font-medium leading-[18px] text-[#666666] dark:text-zinc-300"
              numberOfLines={2}
            >
              {view.actorLabel} đã cập nhật công việc
              {view.title ? ` "${view.title}"` : ""}
            </Text>
          </View>
          {showXem ? (
            <Pressable
              onPress={() => groupExtras!.onJumpToTaskCard!(tid)}
              className="h-7 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 px-3"
              android_ripple={{ color: "rgba(59,130,246,0.22)", foreground: true }}
            >
              <Text className="text-[11px] font-bold text-blue-600 dark:text-blue-400">Xem</Text>
            </Pressable>
          ) : null}
        </SystemCenterCardChrome>
      </View>
    );
  }

  if (view.variant === "task_due_row") {
    const tid = String(view.taskId ?? "").trim();
    const showOpen = Boolean(tid && groupExtras?.onOpenGroupTaskSheet);
    const line = view.title ? `Đến hạn: "${view.title}"` : "Đến hạn công việc";
    return (
      <View className="my-3 w-full items-center px-4">
        <SystemNotifyTimePill
          createdAt={message.createdAt}
          prevMessage={prevMessage}
          calendarNow={calendarNow}
          isGroup={Boolean(groupExtras)}
        />
        <SystemCenterCardChrome
          isJumpHighlighted={isJumpHighlighted}
          innerClassName="w-full min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5"
        >
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            <AlarmClock size={16} color="#f97316" strokeWidth={2} />
            <Text
              className="min-w-0 flex-1 text-left text-[12px] font-medium leading-[18px] text-[#666666] dark:text-zinc-300"
              numberOfLines={2}
            >
              {line}
            </Text>
          </View>
          {showOpen ? (
            <Pressable
              onPress={() => groupExtras!.onOpenGroupTaskSheet!(tid)}
              className="h-7 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/[0.03] px-3 dark:border-white/10 dark:bg-white/[0.06]"
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <Text className="text-[11px] font-bold text-foreground/80 dark:text-white/80">
                Mở công việc
              </Text>
            </Pressable>
          ) : null}
        </SystemCenterCardChrome>
      </View>
    );
  }

  const t = (groupExtras?.groupTasks ?? []).find((x) => String(x.taskId ?? "") === view.taskId);
  const tx = t as Record<string, unknown> | undefined;
  const cardTitle =
    tx?.title != null && String(tx.title).trim() !== ""
      ? String(tx.title)
      : String(view.title ?? "");
  const byId = new Map<string, string>();
  for (const row of groupExtras?.groupMembers ?? []) {
    byId.set(String(row.userId), String(row.displayName ?? row.userId).trim());
  }

  const boardAssignees = Array.isArray(tx?.assignees) ? (tx.assignees as string[]) : [];
  const boardSubs = Array.isArray(tx?.subtasks)
    ? (tx.subtasks as { assigneeId?: string; done?: boolean }[])
    : [];
  const subAssigneeIds = Array.from(
    new Set(boardSubs.map((s) => String(s?.assigneeId ?? "").trim()).filter(Boolean)),
  );
  const fallbackAssigneeIds = Array.isArray(view.assigneeUserIds)
    ? view.assigneeUserIds.map(String).filter(Boolean)
    : [];
  const topIds = boardAssignees.length > 0 ? boardAssignees.map(String) : fallbackAssigneeIds;

  const participants = Array.isArray(t?.participants) ? (t.participants as string[]) : [];
  const joined = groupExtras ? participants.includes(groupExtras.currentUserId) : false;
  const uid = groupExtras?.currentUserId ?? "";
  const isSubtaskAssignee = uid ? subAssigneeIds.includes(String(uid)) : false;
  const isTopLevelAssignee = uid ? topIds.map(String).includes(String(uid)) : false;
  const explicitAssignToAll =
    Boolean((t as any)?.assignToAll) ||
    Boolean((t as any)?.broadcast) ||
    Boolean(view.assignToAll) ||
    Boolean(view.broadcast);
  const hasSubtasksAssignees = subAssigneeIds.length > 0;
  const canJoinThisTask = Boolean(groupExtras)
    ? hasSubtasksAssignees
      ? isSubtaskAssignee
      : explicitAssignToAll || isTopLevelAssignee
    : false;

  const dueForJoin =
    tx?.dueDate != null && String(tx.dueDate).trim() !== ""
      ? String(tx.dueDate)
      : (view.dueDate ?? "");
  const joinDeadlinePassed = isTaskJoinDeadlinePassed(dueForJoin || undefined);

  const assigneeDisplay = resolveTaskAssigneeDisplayLabel({
    assignToAll: explicitAssignToAll,
    broadcast: Boolean((t as { broadcast?: boolean })?.broadcast),
    assigneeIds: hasSubtasksAssignees ? subAssigneeIds : topIds,
    memberCount: groupExtras?.groupMembers?.length ?? 0,
    nameById: byId,
    fallbackLabel: view.assigneeLabel,
    currentUserId: uid || undefined,
  });

  const subtaskProgress =
    boardSubs.length === 0
      ? null
      : {
          done: boardSubs.filter((s) => s?.done).length,
          total: boardSubs.length,
          pct: Math.round((boardSubs.filter((s) => s?.done).length / boardSubs.length) * 100),
        };

  const creatorId =
    tx?.creatorId != null && String(tx.creatorId).trim() !== "" ? String(tx.creatorId).trim() : "";
  const isTaskCreator = Boolean(
    groupExtras && creatorId && creatorId === groupExtras.currentUserId,
  );
  const showTaskCreatorActions =
    isTaskCreator && Boolean(groupExtras?.onEditGroupTask || groupExtras?.onDeleteGroupTask);

  const onJoin = async (): Promise<void> => {
    if (!groupExtras) return;
    // Local-first UX: update immediately, backend is optional.
    groupExtras.onTaskJoined?.(view.taskId);
    setJoinBusy(true);
    try {
      await groupExtras.joinTask?.(view.taskId);
      toast.success("Bạn đã tham gia công việc");
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { status?: number } };
      const status = err?.status ?? err?.data?.status;
      if (status === 403) toast.error("Bạn không được giao công việc này");
      else toast.error("Không thể tham gia công việc");
    } finally {
      setJoinBusy(false);
    }
  };

  const showJoin = !joined && canJoinThisTask && !joinDeadlinePassed;

  return (
    <View className="my-3 w-full items-center px-4">
      <SystemNotifyTimePill
        createdAt={message.createdAt}
        prevMessage={prevMessage}
        calendarNow={calendarNow}
        isGroup={Boolean(groupExtras)}
      />
      <SystemCenterCardChrome isJumpHighlighted={isJumpHighlighted} innerClassName="w-full min-w-0">
        <View className="px-3 py-3">
          <View className="mb-2 flex-row flex-wrap items-center gap-1.5">
            <ClipboardList size={14} color="#4F46E5" strokeWidth={2} />
            <Text className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {view.actorLabel} đã giao việc
            </Text>
          </View>

          {(() => {
            const expanded = expandedTaskIds.has(String(view.taskId ?? ""));
            const long = cardTitle.length > 60;
            return (
              <>
                <Pressable onPress={() => long && toggleExpanded(view.taskId)}>
                  <Text
                    className="mb-3 pr-1 text-center text-[16px] font-black leading-snug text-foreground"
                    numberOfLines={expanded || !long ? undefined : 3}
                  >
                    {cardTitle}
                  </Text>
                </Pressable>
                {long ? (
                  <Pressable
                    onPress={() => toggleExpanded(view.taskId)}
                    className="mb-2 self-center rounded-full bg-primary/10 px-3 py-1"
                  >
                    <Text className="text-[11px] font-bold text-primary">
                      {expanded ? "Thu gọn tiêu đề" : "Xem thêm tiêu đề"}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            );
          })()}

          <View className="gap-2.5">
            <View className="flex-row items-start gap-2.5">
              <View className="pt-0.5">
                <Users size={16} color={muted} strokeWidth={2} />
              </View>
              <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1">
                <Text className="text-[13px] font-semibold text-muted-foreground">Giao cho: </Text>
                <Text className="text-[13px] font-bold text-foreground" numberOfLines={3}>
                  {assigneeDisplay}
                </Text>
              </View>
            </View>
            {dueForJoin.trim() ? (
              <View className="flex-row items-start gap-2.5">
                <View className="pt-0.5">
                  <AlarmClock size={16} color={muted} strokeWidth={2} />
                </View>
                <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-1.5">
                  <Text className="text-[13px] font-semibold text-muted-foreground">
                    Hạn chót:{" "}
                  </Text>
                  <TaskDeadlineChipMobile dateIso={dueForJoin} compact />
                </View>
              </View>
            ) : null}
          </View>

          {subtaskProgress ? (
            <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-border/60 bg-muted/25 p-2.5">
              <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${subtaskProgress.pct}%`,
                    backgroundColor: subtaskProgress.pct === 100 ? "#10B981" : "#6366F1",
                  }}
                />
              </View>
              <Text className="text-[12px] font-bold text-muted-foreground">
                {subtaskProgress.done}/{subtaskProgress.total} mục
              </Text>
            </View>
          ) : null}

          {view.note
            ? (() => {
                const expanded = expandedTaskIds.has(String(view.taskId ?? ""));
                const long = (view.note?.length ?? 0) > 90;
                return (
                  <View className="mt-2 px-1">
                    <Pressable onPress={() => long && toggleExpanded(view.taskId)}>
                      <Text
                        className="text-center text-[12px] text-muted-foreground"
                        numberOfLines={expanded || !long ? undefined : 2}
                      >
                        <Text className="font-semibold">Ghi chú:</Text> {view.note}
                      </Text>
                    </Pressable>
                    {long ? (
                      <Pressable
                        onPress={() => toggleExpanded(view.taskId)}
                        className="mt-1 self-center rounded-full bg-primary/10 px-3 py-1"
                      >
                        <Text className="text-[11px] font-bold text-primary">
                          {expanded ? "Thu gọn ghi chú" : "Xem thêm ghi chú"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })()
            : null}
        </View>

        {groupExtras ? (
          <View className="min-w-0 flex-row flex-wrap items-center justify-between gap-3 border-t border-black/5 px-3 py-3 dark:border-white/10">
            <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-2">
              <View className="flex-row items-center gap-1.5 rounded-full border border-black/5 bg-white px-2.5 py-1.5 dark:border-white/10 dark:bg-zinc-800">
                <Text className="text-[11px] font-bold text-muted-foreground">
                  {participants.length > 0 ? `${participants.length} đã tham gia` : "Chưa có ai"}
                </Text>
              </View>
              {joined ? (
                <View className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Đã tham gia
                  </Text>
                </View>
              ) : canJoinThisTask && joinDeadlinePassed ? (
                <View className="rounded-full border border-black/5 bg-black/5 px-3 py-1.5 dark:border-white/10 dark:bg-white/10">
                  <Text className="text-[11px] font-bold text-muted-foreground">Chưa tham gia</Text>
                </View>
              ) : showJoin ? (
                <Pressable
                  onPress={() => void onJoin()}
                  disabled={!canJoinThisTask || joinBusy}
                  className={
                    !canJoinThisTask
                      ? "rounded-full bg-black/5 px-3 py-1.5 dark:bg-white/10"
                      : "rounded-full bg-emerald-500 px-3 py-1.5"
                  }
                >
                  {joinBusy ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text
                      className={`text-[11px] font-bold ${!canJoinThisTask ? "text-muted-foreground" : "text-white"}`}
                    >
                      Xác nhận tham gia
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            {showTaskCreatorActions ? (
              <View className="flex-row flex-wrap items-center justify-end gap-2">
                {groupExtras.onEditGroupTask ? (
                  <Pressable
                    onPress={() => groupExtras.onEditGroupTask?.(view.taskId)}
                    className="flex-row items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-1.5 dark:border-white/15 dark:bg-zinc-800"
                  >
                    <Pencil size={13} color={muted} strokeWidth={2} />
                    <Text className="text-[11px] font-bold text-foreground">Sửa</Text>
                  </Pressable>
                ) : null}
                {groupExtras.onDeleteGroupTask ? (
                  <Pressable
                    onPress={() => groupExtras.onDeleteGroupTask?.(view.taskId)}
                    className="flex-row items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-500/30 dark:bg-red-500/15"
                  >
                    <Trash2 size={13} color="#DC2626" strokeWidth={2} />
                    <Text className="text-[11px] font-bold text-red-600 dark:text-red-400">
                      Hủy
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </SystemCenterCardChrome>
    </View>
  );
}

/** Thẻ bình chọn trong luồng chat — đồng bộ web PollVoteModal (preview + CTA). */
function PollMessageInlineCard({
  poll,
  isOwn,
  onOpen,
  isJumpHighlighted = false,
}: {
  poll: PollVoteModalPoll;
  isOwn: boolean;
  onOpen: () => void;
  isJumpHighlighted?: boolean;
}) {
  const pollBlue = "#2563eb";
  const total = poll.options.reduce((sum, o) => sum + (o.voters?.length ?? 0), 0);
  const cardShell = isOwn
    ? "overflow-hidden rounded-2xl border border-white/25 bg-white/12"
    : "overflow-hidden rounded-2xl border border-border bg-card";
  return (
    <ChatJumpHighlightWrap active={isJumpHighlighted} borderRadius={16}>
      <Pressable onPress={onOpen} className={cardShell}>
        <View className="flex-row items-center gap-2 border-b border-black/[0.06] px-3 py-2.5 dark:border-white/10">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15 dark:bg-orange-900/30">
            <BarChart2 size={16} color="#ea580c" strokeWidth={2} />
          </View>
          <Text className={`text-[12px] font-bold ${isOwn ? "text-white" : "text-foreground"}`}>
            Bình chọn
          </Text>
          {poll.isClosed ? (
            <Text className="text-[10px] font-semibold text-muted-foreground">Đã đóng</Text>
          ) : null}
        </View>
        <View className="px-3 py-2.5">
          <View
            className={`rounded-xl p-3 ${isOwn ? "bg-white/10" : "bg-black/[0.05] dark:bg-white/[0.06]"}`}
          >
            <Text
              className={`text-[14px] font-extrabold ${isOwn ? "text-white" : "text-foreground"}`}
            >
              {poll.question}
            </Text>
            <Text
              className={`mt-1 text-[12px] ${isOwn ? "text-white/75" : "text-muted-foreground"}`}
            >
              {poll.isMultipleChoice ? "Chọn nhiều đáp án" : "Chọn một đáp án"} • {total} lượt bình
              chọn
            </Text>
          </View>
          {poll.options.map((opt, idx) => {
            const votes = opt.voters?.length ?? 0;
            const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
            return (
              <View key={`${poll.pollId}-opt-${idx}`} className="mt-2.5">
                <Text
                  className={`text-[13px] font-semibold ${isOwn ? "text-white" : "text-foreground"}`}
                  numberOfLines={3}
                >
                  {opt.text}
                </Text>
                <Text
                  className={`mt-1 text-[11px] ${isOwn ? "text-white/70" : "text-muted-foreground"}`}
                >
                  {votes} lượt ({pct}%)
                </Text>
                <View
                  className={`mt-2 h-2 overflow-hidden rounded-full ${isOwn ? "bg-white/15" : "bg-black/5 dark:bg-white/10"}`}
                >
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: pollBlue }}
                  />
                </View>
              </View>
            );
          })}
          <View className="mt-3 items-end">
            <View className="rounded-full bg-orange-500 px-3 py-1.5">
              <Text className="text-[11px] font-bold text-white">Mở bình chọn</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </ChatJumpHighlightWrap>
  );
}

// ── Reply-To Preview ────────────────────────────────────────────────────

function ReplyToPreview({
  message,
  isOwn,
  viewerUserId,
  onPress,
}: {
  message: IMessage;
  isOwn: boolean;
  viewerUserId?: string | null;
  onPress?: () => void;
}) {
  if (!message.replyToDetails) return null;

  const reply = message.replyToDetails;
  const previewContent = formatChatPreviewLine(
    {
      type: reply.type,
      content: reply.content ?? "",
      senderId: reply.senderId,
      senderDisplayName: reply.senderDisplayName,
      isRecalled: false,
    },
    viewerUserId ?? "",
  );

  return (
    <Pressable
      onPress={onPress}
      className={`mb-1.5 rounded-lg border-l-[3px] px-2.5 py-1.5 ${isOwn ? "border-white/40 bg-white/15" : "border-primary/50 bg-black/5"}`}
    >
      <Text
        className={`mb-0.5 text-[10px] font-bold ${isOwn ? "text-white/80" : "text-primary"}`}
        numberOfLines={1}
      >
        {reply.senderDisplayName ?? reply.senderId}
      </Text>
      <Text
        className={`text-[11px] ${isOwn ? "text-white/60" : "text-muted-foreground"}`}
        numberOfLines={1}
      >
        {previewContent}
      </Text>
    </Pressable>
  );
}

// ── Reactions Row ───────────────────────────────────────────────────────

function ReactionsRow({
  reactions,
  isOwn,
}: {
  reactions: Record<string, string[]>;
  isOwn: boolean;
}) {
  const entries = Object.entries(reactions);
  if (entries.length === 0) return null;

  return (
    <View className={`mt-0.5 flex-row flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, userIds]) => (
        <View
          key={emoji}
          className="flex-row items-center gap-0.5 rounded-full border border-border/30 bg-card px-1.5 py-0.5"
        >
          <Text className="text-[13px]">{emoji}</Text>
          {userIds.length > 1 && (
            <Text className="text-[10px] font-semibold text-muted-foreground">
              {userIds.length}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function parseTitleBodyJson(content: string): { title: string; body?: string } | null {
  const t = content.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t) as Record<string, unknown>;
    const title = String(o.title ?? o.question ?? o.name ?? "").trim();
    if (!title) return null;
    const body = [o.description, o.note, o.location]
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .find(Boolean);
    return { title, body: body || undefined };
  } catch {
    return null;
  }
}

// ── Main ChatBubble ─────────────────────────────────────────────────────

export const ChatBubble = ({
  message,
  isOwn,
  viewerUserId,
  isGroup = false,
  prevMessage,
  nextMessage,
  onLongPress,
  onPressReplyTo,
  isJumpHighlighted = false,
  groupExtras,
  onMediaLightbox,
}: ChatBubbleProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const { muted, primary, isDark } = useIconColors();
  const calendarNow = useCalendarNow();
  const isRecalled = Boolean(message.isRecalled);
  const isDeleted = Boolean(message.isDeleted);
  const mediaLayout = useMemo(() => getChatMediaLayout(windowWidth), [windowWidth]);
  const [mediaSavedOnDevice, setMediaSavedOnDevice] = useState(false);

  const showMediaLightbox = useCallback(
    (state: ChatMediaLightboxState) => {
      if (state) onMediaLightbox?.(state);
    },
    [onMediaLightbox],
  );

  /** Luôn qua format preview — không render JSON thô trong bubble chữ. */
  const captionPlainText = useMemo(
    () =>
      formatChatPreviewLine(
        {
          type: message.type,
          content: message.content ?? "",
          senderId: message.senderId,
          senderDisplayName: message.senderDisplayName,
          isRecalled: Boolean(message.isRecalled),
        },
        viewerUserId ?? "",
      ),
    [
      message.type,
      message.content,
      message.senderId,
      message.senderDisplayName,
      message.isRecalled,
      viewerUserId,
    ],
  );

  const isSystemCenter = message.type === "system" || isCenterPositionMessage(message);
  const dayChangedFromPrev = chatSystemPillShowDateLine(prevMessage?.createdAt, message.createdAt);
  /** Nhóm: tin system đã có pill giờ+ngày — không lặp chip `DateSeparator` (dễ dính sát ô nhập khi FlatList inverted). */
  const showDateSeparator = dayChangedFromPrev && !(isGroup && isSystemCenter);

  if (isSystemCenter) {
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} now={calendarNow} />}
        <View className="w-full">
          <SystemCenterBlock
            message={message}
            isOwn={isOwn}
            viewerUserId={viewerUserId}
            groupExtras={isGroup ? groupExtras : undefined}
            calendarNow={calendarNow}
            prevMessage={prevMessage}
            isGroupChat={Boolean(isGroup)}
            isJumpHighlighted={isJumpHighlighted}
          />
        </View>
      </>
    );
  }

  if (message.type === "call") {
    const isSameSenderAsNextCall =
      !!nextMessage &&
      nextMessage.senderId === message.senderId &&
      chatMessagesSameLocalDay(nextMessage.createdAt, message.createdAt);
    const showCallTimestampFooter = !isSameSenderAsNextCall;
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} now={calendarNow} />}
        <ChatJumpHighlightWrap
          active={isJumpHighlighted}
          borderRadius={16}
          style={{ width: "100%" }}
        >
          <CallLogMessage
            message={message}
            isOwn={isOwn}
            showTimestampFooter={showCallTimestampFooter}
          />
        </ChatJumpHighlightWrap>
      </>
    );
  }

  const isSameSenderAsPrev =
    !!prevMessage &&
    prevMessage.senderId === message.senderId &&
    chatMessagesSameLocalDay(prevMessage.createdAt, message.createdAt);
  const isSameSenderAsNext =
    !!nextMessage &&
    nextMessage.senderId === message.senderId &&
    chatMessagesSameLocalDay(nextMessage.createdAt, message.createdAt);
  const showSenderName = !isOwn && isGroup && !isSameSenderAsPrev;
  const isSameMinuteAsNext =
    !!nextMessage && isSameCalendarMinute(message.createdAt, nextMessage.createdAt);
  /** Nhóm: một dòng giờ/ngày cho cả phút — chỉ tin cuối trong cùng phút lịch; 1-1: tin cuối chuỗi cùng người gửi (cùng ngày). */
  const showTimestamp = isGroup ? !isSameMinuteAsNext : !isSameSenderAsNext;

  const rawMedia = message.mediaUrl?.trim();
  const hasImage = message.type === "image" && Boolean(rawMedia || message.thumbnailUrl?.trim());
  const hasSticker =
    message.type === "sticker" && Boolean(rawMedia || message.thumbnailUrl?.trim());
  /** Video: cần `mediaUrl` (hoặc URI local lúc gửi) — RN `Image` không hiển thị MP4. */
  const hasVideo = message.type === "video" && Boolean((rawMedia ?? "").trim());
  const hasFile = message.type === "file" && Boolean((rawMedia ?? "").trim());
  const hasCaption = (message.content ?? "").trim().length > 0;
  const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;

  const fileSizeLabel =
    message.mediaSize != null && message.mediaSize > 0 ? formatFileSize(message.mediaSize) : null;
  const imageUri = hasImage ? chatImageDisplayUrl(message) : null;
  const stickerUri = hasSticker ? chatImageDisplayUrl(message) : null;
  const videoUri = hasVideo ? chatVideoPlayUrl(message) : null;
  const filePreviewUri = hasFile ? chatFilePreviewUrl(message) : null;
  const downloadFilename = chatMediaDownloadFilename(
    message,
    hasVideo ? "video" : hasImage ? "image" : "file",
  );
  const fileBubbleMeta = message.type === "file" ? resolveChatFileBubbleMeta(message) : null;
  const fileName =
    fileBubbleMeta?.fileName ?? (message.mediaOriginalName?.trim() || "Tệp đính kèm");
  const fileMimeType = fileBubbleMeta?.mimeType ?? message.mediaType;
  const videoTitle = message.mediaOriginalName?.trim() || "Video";

  const isVisualMedia = Boolean(hasImage || hasVideo || hasSticker);
  const hasMediaCard = Boolean(hasImage || hasVideo || hasFile);
  const parsedLocation =
    message.type === "location" ? parseLocationPayload(message.content ?? "") : null;
  const hasLocationBlock = message.type === "location" && (parsedLocation !== null || hasCaption);
  const structuredPollSchedule =
    message.type === "poll" || message.type === "schedule"
      ? parseTitleBodyJson(message.content ?? "")
      : null;

  const mergedThreadPoll = (() => {
    if (message.type !== "poll" || !isGroup || !groupExtras?.groupPolls) return null;
    const partial = parsePollPayloadFromMessageContent(message.content ?? "");
    if (!partial?.pollId) return null;
    return mergePollWithGroupList(partial, groupExtras.groupPolls);
  })();

  const joinLinkPayload =
    message.type === "text" ? resolveGroupJoinLinkFromMessageContent(message.content ?? "") : null;
  const isJoinLinkMsg = Boolean(joinLinkPayload);

  const jumpHighlightOnPollInline =
    Boolean(isJumpHighlighted) && message.type === "poll" && mergedThreadPoll != null;
  const jumpHighlightOnMedia =
    Boolean(isJumpHighlighted) && (hasImage || hasVideo || hasFile || hasSticker);
  const jumpHighlightOnTextBubble =
    Boolean(isJumpHighlighted) &&
    !jumpHighlightOnPollInline &&
    !jumpHighlightOnMedia &&
    !isSystemCenter;

  const hasPollScheduleBlock =
    (message.type === "poll" || message.type === "schedule") &&
    (mergedThreadPoll != null || structuredPollSchedule !== null || hasCaption);

  const isEmojiMessage = message.type === "emoji";
  const fallbackLabel = getMessageTypeLabel(message.type);

  const hasRenderableSpecial =
    isVisualMedia ||
    isJoinLinkMsg ||
    hasFile ||
    hasLocationBlock ||
    hasPollScheduleBlock ||
    (isEmojiMessage && (hasCaption || Boolean(fallbackLabel)));

  const plainTextFallback = !hasRenderableSpecial && !hasCaption ? fallbackLabel || "Tin nhắn" : "";

  const widenMediaBubble = Boolean(hasImage || hasVideo || hasFile);
  const mediaBubbleMaxWidth = hasFile ? mediaLayout.fileMaxWidth : mediaLayout.visualMaxWidth;
  const pressableMediaStyle: ViewStyle | undefined =
    widenMediaBubble && !hasFile
      ? {
          maxWidth: mediaBubbleMaxWidth,
          alignSelf: isOwn ? "flex-end" : "flex-start",
          ...(hasVideo && !hasImage ? { width: "100%" as const } : {}),
        }
      : undefined;

  const handleOpenVideo = () => {
    if (!videoUri) return;
    showMediaLightbox({ kind: "video", uri: videoUri, filename: downloadFilename });
  };

  const handleDownloadVideo = async () => {
    const downloadUrl = chatMediaDownloadUrl(message);
    if (!downloadUrl) {
      toast.error("Không có video để lưu.");
      return;
    }
    try {
      const ok = await saveChatMediaToLibrary(downloadUrl, downloadFilename, "video");
      if (ok) {
        setMediaSavedOnDevice(true);
        toast.success("Đã lưu video");
      } else {
        toast.error("Không lưu được video.");
      }
    } catch {
      toast.error("Không lưu được video. Thử lại sau.");
    }
  };

  const handleOpenFile = async () => {
    const downloadUrl = chatMediaDownloadUrl(message);
    if (!downloadUrl) {
      toast.error("Không có file để mở.");
      return;
    }
    try {
      const ok = await openOrShareChatFile(downloadUrl, fileName, message.mediaType);
      if (!ok) toast.error("Không mở được file.");
    } catch {
      toast.error("Không mở được file. Thử lại sau.");
    }
  };

  const openActionSheet = () => onLongPress?.(message);

  const handleDownloadFile = async () => {
    const downloadUrl = chatMediaDownloadUrl(message);
    if (!downloadUrl) {
      toast.error("Không có file để tải.");
      return;
    }
    try {
      const ok = await downloadChatFileToDevice(downloadUrl, fileName, message.mediaType);
      if (ok) {
        setMediaSavedOnDevice(true);
        toast.success("Đã lưu file vào Tài liệu.");
      } else {
        toast.error("Không tải được file.");
      }
    } catch {
      toast.error("Không tải được file. Thử lại sau.");
    }
  };

  return (
    <>
      {showDateSeparator && <DateSeparator date={message.createdAt} now={calendarNow} />}

      <View
        className={`w-full ${isSameSenderAsPrev ? "mt-0.5" : "mt-2"} ${isOwn ? "items-end" : "items-start"}`}
      >
        {showSenderName && message.senderDisplayName ? (
          <Text className="mb-1 ml-2 text-[11px] font-semibold text-primary">
            {message.senderDisplayName}
          </Text>
        ) : null}

        {hasFile && !isDeleted && !isRecalled ? (
          <ChatFileMessageBubble
            layout={mediaLayout}
            fileName={fileName}
            fileSizeLabel={fileSizeLabel}
            mimeType={fileMimeType}
            previewUri={filePreviewUri}
            caption={hasCaption ? captionPlainText : null}
            mediaSavedOnDevice={mediaSavedOnDevice}
            isOwn={isOwn}
            isDark={isDark}
            isJumpHighlighted={isJumpHighlighted}
            header={
              message.replyToDetails ? (
                <ReplyToPreview
                  message={message}
                  isOwn={false}
                  viewerUserId={viewerUserId}
                  onPress={() => onPressReplyTo?.(message.replyToDetails!.messageId)}
                />
              ) : undefined
            }
            onShowActions={openActionSheet}
            onDownload={() => void handleDownloadFile()}
            onFolderHint={openDownloadsFolderHint}
            renderCaption={(text) => (
              <MentionifiedChatText
                text={text}
                isOwn={isOwn}
                isVisualMedia={true}
                style={{
                  color: isDark ? "#E4E6EB" : "#1C1E21",
                  fontSize: 13,
                  lineHeight: 18,
                }}
              />
            )}
          />
        ) : message.type === "voice" && !isDeleted && !isRecalled ? (
          <VoiceMessagePlayer message={message} isOwn={isOwn} onShowActions={openActionSheet} />
        ) : (
          <Pressable
            onLongPress={openActionSheet}
            delayLongPress={300}
            style={pressableMediaStyle}
            className={
              widenMediaBubble
                ? hasImage && !hasVideo
                  ? "min-w-0"
                  : "w-full min-w-0"
                : isOwn
                  ? "min-w-0 max-w-[78%] self-end"
                  : "min-w-0 max-w-[78%] self-start"
            }
          >
            {isDeleted || isRecalled ? (
              <View className="flex-row items-center gap-1.5 rounded-[20px] border border-dashed border-border/40 px-4 py-2.5 opacity-60">
                <Ban size={13} color={muted} strokeWidth={1.5} />
                <Text className="text-sm italic text-muted-foreground">
                  {isDeleted ? "Tin nhắn đã bị xóa" : "Tin nhắn đã được thu hồi"}
                </Text>
              </View>
            ) : (
              <View className="max-w-full">
                <ChatJumpHighlightWrap
                  active={jumpHighlightOnTextBubble}
                  borderRadius={20}
                  style={{ maxWidth: "100%", alignSelf: isOwn ? "flex-end" : "flex-start" }}
                >
                  <View
                    className={[
                      "max-w-full",
                      hasMediaCard || isVisualMedia
                        ? ""
                        : isJoinLinkMsg
                          ? ""
                          : `px-4 py-2.5 ${isOwn ? "rounded-[20px] rounded-br-[5px] bg-primary" : "rounded-[20px] rounded-bl-[5px] bg-card"}`,
                      !hasMediaCard && isVisualMedia ? "overflow-hidden rounded-2xl" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <ReplyToPreview
                      message={message}
                      isOwn={isOwn && !isVisualMedia}
                      viewerUserId={viewerUserId}
                      onPress={() => onPressReplyTo?.(message.replyToDetails!.messageId)}
                    />

                    {hasImage && imageUri ? (
                      <ChatImageMessageWithJoinQr
                        messageId={message.messageId}
                        scanEnabled={!isDeleted && !isRecalled}
                        uri={imageUri}
                        layout={mediaLayout}
                        isDark={isDark}
                        hasCaptionBelow={hasCaption}
                        isJumpHighlighted={isJumpHighlighted}
                        onPress={openActionSheet}
                      />
                    ) : null}

                    {hasSticker && stickerUri ? (
                      <Pressable
                        onPress={openActionSheet}
                        onLongPress={openActionSheet}
                        delayLongPress={300}
                        accessibilityLabel="Tùy chọn tin nhắn sticker"
                        className="self-center rounded-2xl active:opacity-90"
                      >
                        <Image
                          source={{ uri: stickerUri }}
                          className="h-[168px] w-[168px] rounded-2xl"
                          resizeMode="contain"
                        />
                      </Pressable>
                    ) : null}

                    {hasVideo && videoUri ? (
                      <ChatVideoMessageCard
                        layout={mediaLayout}
                        isDark={isDark}
                        hasCaptionBelow={hasCaption}
                        isJumpHighlighted={isJumpHighlighted}
                        title={videoTitle}
                        metaLine={fileSizeLabel}
                        mediaSavedOnDevice={mediaSavedOnDevice}
                        videoPlayer={
                          <ChatBubbleVideo
                            key={`${message.messageId}-${videoUri}`}
                            playUri={videoUri}
                          />
                        }
                        onPress={openActionSheet}
                        onFullscreen={handleOpenVideo}
                        onFolderHint={openDownloadsFolderHint}
                        onDownload={() => void handleDownloadVideo()}
                      />
                    ) : null}

                    {(hasImage || hasVideo) && hasCaption ? (
                      <View
                        style={chatMediaCaptionStyle(isOwn, isDark, mediaLayout.visualMaxWidth)}
                      >
                        <MentionifiedChatText
                          text={captionPlainText}
                          isOwn={isOwn}
                          isVisualMedia={true}
                          style={{
                            color: isDark ? "#E4E6EB" : "#1C1E21",
                            fontSize: 13,
                            lineHeight: 18,
                          }}
                        />
                      </View>
                    ) : null}

                    {message.type === "location" && parsedLocation ? (
                      <Pressable
                        onPress={() =>
                          void Linking.openURL(
                            mapsUrlForLatLng(parsedLocation.lat, parsedLocation.lng),
                          )
                        }
                        className={`flex-row items-center gap-2 rounded-xl px-3 py-2 ${isOwn ? "bg-white/15" : "bg-muted/50"}`}
                      >
                        <MapPin
                          size={20}
                          color={isOwn ? "rgba(255,255,255,0.85)" : primary}
                          strokeWidth={2}
                        />
                        <View className="min-w-0 flex-1">
                          <Text
                            className={`text-[13px] font-semibold ${isOwn ? "text-white" : "text-foreground"}`}
                            numberOfLines={2}
                          >
                            {parsedLocation.title}
                          </Text>
                          <Text
                            className={`mt-0.5 text-[11px] ${isOwn ? "text-white/70" : "text-primary"}`}
                          >
                            Mở bản đồ
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}

                    {message.type === "poll" && mergedThreadPoll && groupExtras ? (
                      <View className="mt-1 w-full min-w-[260px] max-w-full self-stretch">
                        <PollMessageInlineCard
                          poll={mergedThreadPoll}
                          isOwn={isOwn}
                          isJumpHighlighted={isJumpHighlighted}
                          onOpen={() => groupExtras.onOpenPollVote(mergedThreadPoll.pollId)}
                        />
                      </View>
                    ) : (message.type === "poll" || message.type === "schedule") &&
                      structuredPollSchedule ? (
                      <ChatJumpHighlightWrap active={isJumpHighlighted} borderRadius={16}>
                        <View
                          className={
                            isOwn
                              ? "rounded-lg bg-white/10 px-2 py-1"
                              : "rounded-lg bg-muted/40 px-2 py-1"
                          }
                        >
                          <Text
                            className={`text-[13px] font-bold ${isOwn ? "text-white" : "text-foreground"}`}
                          >
                            {structuredPollSchedule.title}
                          </Text>
                          {structuredPollSchedule.body ? (
                            <Text
                              className={`mt-1 text-[12px] ${isOwn ? "text-white/80" : "text-muted-foreground"}`}
                            >
                              {structuredPollSchedule.body}
                            </Text>
                          ) : null}
                        </View>
                      </ChatJumpHighlightWrap>
                    ) : null}

                    {isEmojiMessage && hasCaption ? (
                      <View className={isVisualMedia ? "px-3 py-2" : ""}>
                        <Text
                          className={`text-[34px] leading-[42px] ${isOwn ? "text-white" : "text-foreground"}`}
                        >
                          {captionPlainText}
                        </Text>
                      </View>
                    ) : null}

                    {joinLinkPayload ? (
                      <View className="py-0.5">
                        <GroupJoinLinkCard payload={joinLinkPayload} />
                      </View>
                    ) : null}

                    {!isEmojiMessage &&
                      hasCaption &&
                      !joinLinkPayload &&
                      !hasImage &&
                      !hasVideo &&
                      !hasFile && (
                        <View className={isVisualMedia || hasFile ? "px-3 py-2" : ""}>
                          <MentionifiedChatText
                            text={captionPlainText}
                            className={`text-[15px] leading-[22px] ${isOwn && !isVisualMedia ? "text-white" : "text-foreground"}`}
                            linkClassName={`font-bold underline ${isOwn && !isVisualMedia ? "text-white" : "text-primary"}`}
                            isOwn={isOwn}
                            isVisualMedia={isVisualMedia}
                          />
                        </View>
                      )}

                    {plainTextFallback ? (
                      <Text
                        className={`text-[14px] ${isOwn ? "text-white/90" : "text-muted-foreground"}`}
                      >
                        {plainTextFallback}
                      </Text>
                    ) : null}

                    {isEmojiMessage && !hasCaption && fallbackLabel ? (
                      <Text
                        className={`text-[15px] ${isOwn ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        {fallbackLabel}
                      </Text>
                    ) : null}

                    {message.isEdited && (
                      <Text
                        className={`mt-0.5 text-[10px] ${isOwn && !isVisualMedia && !hasFile ? "text-white/50" : "text-muted-foreground/60"}`}
                      >
                        (đã sửa)
                      </Text>
                    )}
                  </View>
                </ChatJumpHighlightWrap>

                {hasReactions && <ReactionsRow reactions={message.reactions} isOwn={isOwn} />}
              </View>
            )}
          </Pressable>
        )}

        {showTimestamp && (
          <View
            className={`mt-0.5 flex-row items-center gap-1 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
          >
            <Text className="text-[11px] text-muted-foreground">
              {formatTimestamp(message.createdAt)}
            </Text>
            {isOwn && !isRecalled && !isDeleted && (
              <StatusIcon status={message.status} primary={primary} muted={muted} />
            )}
          </View>
        )}
      </View>
    </>
  );
};

/** Phát MP4/HLS trong bubble — `Image` không hiển thị được khung hình từ URL video. */
function ChatBubbleVideo({ playUri }: { playUri: string }) {
  if (!playUri) {
    return (
      <View className="aspect-video w-full items-center justify-center bg-muted px-4">
        <Text className="text-center text-sm text-muted-foreground">Không có đường dẫn video</Text>
      </View>
    );
  }
  return <ChatBubbleVideoPlayer playUri={playUri} />;
}
function ChatBubbleVideoPlayer({ playUri }: { playUri: string }) {
  const player = useVideoPlayer(playUri, (p) => {
    p.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="contain"
      nativeControls={false}
      accessibilityLabel="Video trong tin nhắn"
    />
  );
}

function DateSeparator({ date, now }: { date: string; now: Date }) {
  const iso = (date ?? "").trim();
  if (!iso) return null;
  const label = formatChatSystemPillDateLabel(iso, now);
  if (!label) return null;
  return (
    <View className="my-3 items-center">
      <View className="rounded-full bg-muted/50 px-3 py-1">
        <Text className="text-[11px] font-medium text-muted-foreground">{label}</Text>
      </View>
    </View>
  );
}

function StatusIcon({
  status,
  primary,
  muted,
}: {
  status: string;
  primary: string;
  muted: string;
}) {
  if (status === "sending") {
    return <ActivityIndicator size={10} color={muted} />;
  }
  if (status === "failed") {
    return <AlertCircle size={12} color="#ef4444" strokeWidth={2} />;
  }
  if (status === "read") {
    return <CheckCheck size={12} color={primary} strokeWidth={2} />;
  }
  if (status === "delivered") {
    return <CheckCheck size={12} color={muted} strokeWidth={2} />;
  }
  return <Check size={12} color={muted} strokeWidth={2} />;
}
