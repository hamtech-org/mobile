import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Ban,
  AlertCircle,
  BarChart2,
  CalendarClock,
  Check,
  CheckCheck,
  ClipboardList,
  Download,
  FileText,
  MapPin,
  Phone,
  Play,
  Users,
  Video,
} from "lucide-react-native";

import { useCalendarNow } from "@/contexts/CalendarClockContext";
import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatFileSize } from "@/utils/file";
import {
  formatChatPreviewLine,
  getMessageTypeLabel,
  mapsUrlForLatLng,
  parseLocationPayload,
} from "@/utils/messageDisplay";
import { buildSystemBubbleView, isCenterPositionMessage } from "@/utils/systemMessage";
import {
  formatConversationListActivityTime,
  formatDateLabel,
  formatTimestamp,
  isSameDay,
} from "@/utils/time";
import { toast } from "@/utils/appToast";
import { normalizeMediaUrl } from "@/utils/url";

/** Dữ liệu nhóm để card giao việc / nút bình chọn (chỉ khi `isGroup`). */
export interface ChatBubbleGroupExtras {
  conversationId: string;
  currentUserId: string;
  groupTasks: { taskId?: string; participants?: string[]; assignees?: string[] }[];
  joinTask: (taskId: string) => Promise<void>;
  onTaskJoined?: (taskId: string) => void;
  onOpenPollVote: (pollId: string) => void;
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
  /** Thông tin nhóm: join task, mở poll (tuỳ chọn) */
  groupExtras?: ChatBubbleGroupExtras;
}

// ── Call Log Message ────────────────────────────────────────────────────

function CallLogMessage({ message }: { message: IMessage }) {
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
        : callType === "video"
          ? "Cuộc gọi video"
          : "Cuộc gọi thoại";

  const durationLabel =
    durationSec > 0 ? `${Math.floor(durationSec / 60)} phút ${durationSec % 60} giây` : "";

  const IconComponent = callType === "video" ? Video : Phone;
  const iconColor = kind === "missed" ? "#ef4444" : primary;

  return (
    <View className="my-3 items-center px-6">
      <View className="min-w-[220px] items-center rounded-2xl border border-border/30 bg-muted/40 px-5 py-3">
        <View className="mb-1 flex-row items-center gap-2">
          <IconComponent size={16} color={iconColor} strokeWidth={1.5} />
          <Text className="text-sm font-bold text-foreground">{title}</Text>
        </View>
        {durationLabel ? (
          <Text className="text-xs text-muted-foreground">{durationLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** Dải giờ trong cùng khung thông báo (viền + nền) với nội dung bên dưới. */
function SystemNotifyTimeHeader({ createdAt, now }: { createdAt?: string | null; now: Date }) {
  const iso = createdAt?.trim();
  if (!iso) return null;
  const label = formatConversationListActivityTime(iso, now) || formatTimestamp(iso);
  if (!label) return null;
  return (
    <View className="border-b border-border/40 bg-muted/90 px-3 py-1.5">
      <Text
        className="text-center text-[11px] font-semibold text-muted-foreground"
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

// ── System center (JSON + card) ───────────────────────────────────────────

function SystemCenterBlock({
  message,
  isOwn,
  viewerUserId,
  groupExtras,
  calendarNow,
}: {
  message: IMessage;
  isOwn: boolean;
  viewerUserId?: string | null;
  groupExtras?: ChatBubbleGroupExtras;
  calendarNow: Date;
}) {
  const { muted } = useIconColors();
  const view = useMemo(
    () =>
      buildSystemBubbleView(message, {
        isOwn,
        currentUserId: viewerUserId ?? groupExtras?.currentUserId,
      }),
    [message, isOwn, viewerUserId, groupExtras?.currentUserId],
  );

  const [joinBusy, setJoinBusy] = useState(false);

  if (view.variant === "text") {
    return (
      <View className="my-2 items-center px-6">
        <View className="w-full max-w-[85%] overflow-hidden rounded-2xl border border-border/40 bg-muted/60">
          <SystemNotifyTimeHeader createdAt={message.createdAt} now={calendarNow} />
          <View className="px-4 py-2.5">
            <Text className="text-center text-[12px] leading-[18px] text-muted-foreground">
              {view.text}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (view.variant === "poll_created_row") {
    const showVoteCta = Boolean(view.pollId && groupExtras?.onOpenPollVote);
    return (
      <View className="my-2 items-center px-4">
        <View className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-border/40 bg-muted/60">
          <SystemNotifyTimeHeader createdAt={message.createdAt} now={calendarNow} />
          <View className="flex-row flex-wrap items-center justify-center gap-2 px-4 py-3">
            <BarChart2 size={16} color="#f97316" strokeWidth={2} />
            <Text className="min-w-[120px] flex-1 text-center text-[12px] leading-[18px] text-muted-foreground">
              {view.actorLabel} đã tạo một bình chọn{view.question ? `: ${view.question}` : ""}
            </Text>
            {showVoteCta ? (
              <Pressable
                onPress={() => groupExtras!.onOpenPollVote(view.pollId)}
                className="rounded-full bg-orange-500 px-3 py-1.5"
              >
                <Text className="text-[11px] font-bold text-white">Bình chọn</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const t = (groupExtras?.groupTasks ?? []).find((x) => String(x.taskId ?? "") === view.taskId);
  const participants = Array.isArray(t?.participants) ? (t.participants as string[]) : [];
  const participantsCount = participants.length;
  const joined = groupExtras ? participants.includes(groupExtras.currentUserId) : false;
  const assignees = Array.isArray(t?.assignees) ? (t.assignees as string[]) : [];
  const canJoinThisTask = groupExtras ? assignees.includes(groupExtras.currentUserId) : false;

  const onJoin = async (): Promise<void> => {
    if (!groupExtras) return;
    setJoinBusy(true);
    try {
      await groupExtras.joinTask(view.taskId);
      groupExtras.onTaskJoined?.(view.taskId);
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

  return (
    <View className="my-2 items-center px-4">
      <View className="w-full max-w-[92%] overflow-hidden rounded-2xl border border-border/40 bg-muted/60">
        <SystemNotifyTimeHeader createdAt={message.createdAt} now={calendarNow} />
        <View className="px-3 py-3">
          {groupExtras ? (
            <View className="mb-2 flex-row flex-wrap items-center justify-center gap-2">
              <Text className="text-[12px] font-semibold text-muted-foreground">
                {participantsCount} người đã tham gia
              </Text>
              <Pressable
                onPress={() => void onJoin()}
                disabled={joined || !canJoinThisTask || joinBusy}
                className={
                  joined
                    ? "rounded-full bg-muted px-3 py-1"
                    : !canJoinThisTask
                      ? "rounded-full bg-primary/40 px-3 py-1"
                      : "rounded-full bg-primary px-3 py-1"
                }
              >
                {joinBusy ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text
                    className={`text-[12px] font-bold ${joined || !canJoinThisTask ? "text-muted-foreground" : "text-white"}`}
                  >
                    {joined ? "Đã tham gia" : "Tham gia"}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}

          <View className="mb-1 flex-row items-center justify-center gap-2">
            <ClipboardList size={16} color="#22c55e" strokeWidth={2} />
            <Text className="text-[12px] font-bold text-foreground">Giao việc</Text>
          </View>

          <View className="rounded-xl border border-border/40 bg-background/80 px-3 py-2">
            <Text className="mb-1 text-center text-[12px] font-semibold text-muted-foreground">
              {message.senderId === (viewerUserId ?? groupExtras?.currentUserId)
                ? "Bạn"
                : view.actorLabel}{" "}
              đã giao việc
            </Text>
            <Text className="text-center text-[13px] font-extrabold text-foreground">
              {view.title}
            </Text>
            <View className="mt-2 gap-1">
              <View className="flex-row flex-wrap items-center justify-center gap-2">
                <Users size={14} color={muted} strokeWidth={2} />
                <Text className="text-[12px] text-muted-foreground">
                  <Text className="font-semibold">Giao cho:</Text> {view.assigneeLabel}
                </Text>
              </View>
              {view.dueDate ? (
                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  <CalendarClock size={14} color={muted} strokeWidth={2} />
                  <Text className="text-[12px] text-muted-foreground">
                    <Text className="font-semibold">Deadline:</Text>{" "}
                    {new Date(view.dueDate).toLocaleString("vi-VN")}
                  </Text>
                </View>
              ) : null}
              {view.note ? (
                <Text className="text-center text-[12px] text-muted-foreground">
                  <Text className="font-semibold">Ghi chú:</Text> {view.note}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
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

// ── Inline Video Player ──────────────────────────────────────────────────

function ActiveVideoPlayer({ videoUri }: { videoUri: string }) {
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = false;
    p.play(); // Tự động phát khi người dùng bấm vào Thumbnail
  });
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      nativeControls
      allowsFullscreen
    />
  );
}

function InlineVideoPlayer({ videoUri, posterUri }: { videoUri: string; posterUri: string }) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Layout 1: Chỉ tải hình ảnh (Tối ưu Memory - Không Crash App khi Chat có 30 videos)
  if (!isLoaded) {
    return (
      <Pressable
        className="aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border/20 bg-black/80"
        onPress={() => setIsLoaded(true)}
      >
        <Image source={{ uri: posterUri }} className="absolute h-full w-full" resizeMode="cover" />
        <View className="rounded-full bg-black/50 p-3">
          <Play size={24} color="white" strokeWidth={2} fill="white" />
        </View>
      </Pressable>
    );
  }

  // Layout 2: Click vào -> Khởi tạo VideoView & Native Controls để xem
  return (
    <View className="aspect-video w-full overflow-hidden rounded-2xl border border-border/20 bg-black">
      <ActiveVideoPlayer videoUri={videoUri} />
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
  groupExtras,
}: ChatBubbleProps) => {
  const { muted, primary } = useIconColors();
  const calendarNow = useCalendarNow();
  const isRecalled = Boolean(message.isRecalled);
  const isDeleted = Boolean(message.isDeleted);

  const showDateSeparator = !prevMessage || !isSameDay(prevMessage.createdAt, message.createdAt);

  if (message.type === "system" || isCenterPositionMessage(message)) {
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} now={calendarNow} />}
        <SystemCenterBlock
          message={message}
          isOwn={isOwn}
          viewerUserId={viewerUserId}
          groupExtras={isGroup ? groupExtras : undefined}
          calendarNow={calendarNow}
        />
      </>
    );
  }

  if (message.type === "call") {
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} now={calendarNow} />}
        <CallLogMessage message={message} />
      </>
    );
  }

  const isSameSenderAsPrev =
    !!prevMessage &&
    prevMessage.senderId === message.senderId &&
    isSameDay(prevMessage.createdAt, message.createdAt);
  const isSameSenderAsNext =
    !!nextMessage &&
    nextMessage.senderId === message.senderId &&
    isSameDay(nextMessage.createdAt, message.createdAt);
  const showSenderName = !isOwn && isGroup && !isSameSenderAsPrev;
  const showTimestamp = !isSameSenderAsNext;

  const rawMedia = message.mediaUrl?.trim();
  const isLocalMedia = Boolean(
    rawMedia && (rawMedia.startsWith("file:") || rawMedia.startsWith("content:")),
  );
  const hasImage = message.type === "image" && rawMedia;
  const hasSticker = message.type === "sticker" && rawMedia;
  const hasVideo = message.type === "video" && (message.thumbnailUrl || rawMedia);
  const hasFile = message.type === "file" && (rawMedia || isLocalMedia);
  const hasCaption = (message.content ?? "").trim().length > 0;
  const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;

  const isVisualMedia = Boolean(hasImage || hasVideo || hasSticker);
  const parsedLocation =
    message.type === "location" ? parseLocationPayload(message.content ?? "") : null;
  const hasLocationBlock = message.type === "location" && (parsedLocation !== null || hasCaption);
  const structuredPollSchedule =
    message.type === "poll" || message.type === "schedule"
      ? parseTitleBodyJson(message.content ?? "")
      : null;
  const hasPollScheduleBlock =
    (message.type === "poll" || message.type === "schedule") &&
    (structuredPollSchedule !== null || hasCaption);

  const isEmojiMessage = message.type === "emoji";
  const fallbackLabel = getMessageTypeLabel(message.type);
  const hasRenderableSpecial =
    isVisualMedia ||
    hasFile ||
    hasLocationBlock ||
    hasPollScheduleBlock ||
    (isEmojiMessage && (hasCaption || Boolean(fallbackLabel)));

  const plainTextFallback = !hasRenderableSpecial && !hasCaption ? fallbackLabel || "Tin nhắn" : "";

  return (
    <>
      {showDateSeparator && <DateSeparator date={message.createdAt} now={calendarNow} />}

      <View
        className={`${isSameSenderAsPrev ? "mt-0.5" : "mt-2"} ${isOwn ? "items-end" : "items-start"}`}
      >
        {showSenderName && message.senderDisplayName ? (
          <Text className="mb-1 ml-2 text-[11px] font-semibold text-primary">
            {message.senderDisplayName}
          </Text>
        ) : null}

        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={300}
          className="max-w-[78%]"
        >
          {isDeleted || isRecalled ? (
            <View className="flex-row items-center gap-1.5 rounded-[20px] border border-dashed border-border/40 px-4 py-2.5 opacity-60">
              <Ban size={13} color={muted} strokeWidth={1.5} />
              <Text className="text-sm italic text-muted-foreground">
                {isDeleted ? "Tin nhắn đã bị xóa" : "Tin nhắn đã được thu hồi"}
              </Text>
            </View>
          ) : (
            <View>
              <View
                className={[
                  isVisualMedia ? "overflow-hidden rounded-2xl" : "",
                  !isVisualMedia
                    ? `${hasFile ? "py-1" : "px-4 py-2.5"} ${
                        hasFile
                          ? ""
                          : isOwn
                            ? "rounded-[20px] rounded-br-[5px] bg-primary"
                            : "rounded-[20px] rounded-bl-[5px] bg-card"
                      }`
                    : "",
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

                {hasImage && (
                  <Image
                    source={{
                      uri: isLocalMedia
                        ? rawMedia!
                        : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) ?? ""),
                    }}
                    className="aspect-[4/3] w-full rounded-2xl"
                    resizeMode="cover"
                  />
                )}

                {hasSticker && (
                  <Image
                    source={{
                      uri: isLocalMedia
                        ? rawMedia!
                        : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) ?? ""),
                    }}
                    className="h-[168px] w-[168px] self-center rounded-2xl"
                    resizeMode="contain"
                  />
                )}

                {hasVideo && (
                  <InlineVideoPlayer
                    videoUri={
                      isLocalMedia ? rawMedia! : (normalizeMediaUrl(message.mediaUrl!) ?? "")
                    }
                    posterUri={
                      isLocalMedia
                        ? (message.thumbnailUrl ?? rawMedia)!
                        : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl!) ?? "")
                    }
                  />
                )}

                {hasFile && (
                  <View
                    className={`mb-1.5 mt-1 flex-row items-center gap-3 border border-border/40 px-3 py-2.5 ${
                      isOwn
                        ? "rounded-[20px] rounded-br-[5px] bg-muted/60"
                        : "rounded-[20px] rounded-bl-[5px] border-border/50 bg-card"
                    }`}
                    style={{ maxWidth: 260, minWidth: 160 }}
                  >
                    <FileText size={28} color={muted} strokeWidth={1.5} />
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <Text
                        className="text-[13px] font-semibold leading-tight text-foreground"
                        numberOfLines={1}
                      >
                        {message.mediaOriginalName?.trim() || "Tệp đính kèm"}
                      </Text>
                      {message.mediaSize != null && message.mediaSize > 0 ? (
                        <Text className="mt-1 text-[11px] text-muted-foreground">
                          {formatFileSize(message.mediaSize)}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => {
                        const url = normalizeMediaUrl(message.mediaUrl);
                        if (url) void Linking.openURL(url);
                      }}
                      className="rounded-xl border border-border/50 bg-muted/80 p-2"
                    >
                      <Download size={16} color={muted} strokeWidth={2} />
                    </Pressable>
                  </View>
                )}

                {message.type === "location" && parsedLocation ? (
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(mapsUrlForLatLng(parsedLocation.lat, parsedLocation.lng))
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

                {(message.type === "poll" || message.type === "schedule") &&
                structuredPollSchedule ? (
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
                ) : null}

                {isEmojiMessage && hasCaption ? (
                  <View className={isVisualMedia ? "px-3 py-2" : ""}>
                    <Text
                      className={`text-[34px] leading-[42px] ${isOwn ? "text-white" : "text-foreground"}`}
                    >
                      {message.content}
                    </Text>
                  </View>
                ) : null}

                {!hasFile && !isEmojiMessage && hasCaption && (
                  <View className={isVisualMedia ? "px-3 py-2" : ""}>
                    <Text
                      className={`text-[15px] leading-[22px] ${isOwn && !isVisualMedia ? "text-white" : "text-foreground"}`}
                    >
                      {message.content}
                    </Text>
                  </View>
                )}

                {hasFile && hasCaption && (
                  <View
                    className={`mt-1 border border-border/40 px-4 py-2 ${isOwn ? "rounded-[20px] rounded-br-[5px] bg-muted/60" : "rounded-[20px] rounded-bl-[5px] bg-card"}`}
                  >
                    <Text className="text-[15px] leading-[22px] text-foreground">
                      {message.content}
                    </Text>
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
                    className={`mt-0.5 text-[10px] ${isOwn && !isVisualMedia ? "text-white/50" : "text-muted-foreground/60"}`}
                  >
                    (đã sửa)
                  </Text>
                )}
              </View>

              {hasReactions && <ReactionsRow reactions={message.reactions} isOwn={isOwn} />}
            </View>
          )}
        </Pressable>

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

function DateSeparator({ date, now }: { date: string; now: Date }) {
  return (
    <View className="my-3 items-center">
      <View className="rounded-full bg-muted/50 px-3 py-1">
        <Text className="text-[11px] font-medium text-muted-foreground">
          {formatDateLabel(date, now)}
        </Text>
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
