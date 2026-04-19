import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, Pressable, Text, View } from "react-native";
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
  Users,
  Video,
} from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatFileSize } from "@/utils/file";
import { getMessageTypeLabel, mapsUrlForLatLng, parseLocationPayload } from "@/utils/messageDisplay";
import { buildSystemBubbleView, isCenterPositionMessage } from "@/utils/systemMessage";
import { formatDateLabel, formatTimestamp, isSameDay } from "@/utils/time";
import { normalizeMediaUrl } from "@/utils/url";

/** Dữ liệu nhóm để card giao việc / nút bình chọn (chỉ khi `isGroup`). */
export interface ChatBubbleGroupExtras {
  conversationId: string;
  currentUserId: string;
  groupTasks: Array<{ taskId?: string; participants?: string[]; assignees?: string[] }>;
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

  const durationLabel = durationSec > 0 ? `${Math.floor(durationSec / 60)} phút ${durationSec % 60} giây` : "";

  const IconComponent = callType === "video" ? Video : Phone;
  const iconColor = kind === "missed" ? "#ef4444" : primary;

  return (
    <View className="items-center my-3 px-6">
      <View className="bg-muted/40 border border-border/30 px-5 py-3 rounded-2xl min-w-[220px] items-center">
        <View className="flex-row items-center gap-2 mb-1">
          <IconComponent size={16} color={iconColor} strokeWidth={1.5} />
          <Text className="text-foreground text-sm font-bold">{title}</Text>
        </View>
        {durationLabel ? <Text className="text-muted-foreground text-xs">{durationLabel}</Text> : null}
      </View>
    </View>
  );
}

// ── System center (JSON + card) ───────────────────────────────────────────

function SystemCenterBlock({
  message,
  isOwn,
  viewerUserId,
  groupExtras,
}: {
  message: IMessage;
  isOwn: boolean;
  viewerUserId?: string | null;
  groupExtras?: ChatBubbleGroupExtras;
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
      <View className="items-center my-2 px-6">
        <View className="bg-muted/60 px-4 py-2 rounded-2xl max-w-[85%]">
          <Text className="text-muted-foreground text-[12px] text-center leading-[18px]">{view.text}</Text>
        </View>
      </View>
    );
  }

  if (view.variant === "poll_created_row") {
    const showVoteCta = Boolean(view.pollId && groupExtras?.onOpenPollVote);
    return (
      <View className="items-center my-2 px-4">
        <View className="bg-muted/60 px-4 py-3 rounded-2xl max-w-[92%] w-full">
          <View className="flex-row items-center justify-center gap-2 flex-wrap">
            <BarChart2 size={16} color="#f97316" strokeWidth={2} />
            <Text className="text-muted-foreground text-[12px] text-center leading-[18px] flex-1 min-w-[120px]">
              {view.actorLabel} đã tạo một bình chọn{view.question ? `: ${view.question}` : ""}
            </Text>
            {showVoteCta ? (
              <Pressable onPress={() => groupExtras!.onOpenPollVote(view.pollId)} className="bg-orange-500 px-3 py-1.5 rounded-full">
                <Text className="text-white text-[11px] font-bold">Bình chọn</Text>
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
      Alert.alert("Thành công", "Bạn đã tham gia công việc");
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { status?: number } };
      const status = err?.status ?? err?.data?.status;
      if (status === 403) Alert.alert("Lỗi", "Bạn không được giao công việc này");
      else Alert.alert("Lỗi", "Không thể tham gia công việc");
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <View className="items-center my-2 px-4">
      <View className="bg-muted/60 px-3 py-3 rounded-2xl max-w-[92%] w-full border border-border/30">
        {groupExtras ? (
          <View className="flex-row items-center justify-center gap-2 mb-2 flex-wrap">
            <Text className="text-muted-foreground text-[12px] font-semibold">{participantsCount} người đã tham gia</Text>
            <Pressable
              onPress={() => void onJoin()}
              disabled={joined || !canJoinThisTask || joinBusy}
              className={
                joined
                  ? "px-3 py-1 rounded-full bg-muted"
                  : !canJoinThisTask
                    ? "px-3 py-1 rounded-full bg-primary/40"
                    : "px-3 py-1 rounded-full bg-primary"
              }
            >
              {joinBusy ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className={`text-[12px] font-bold ${joined || !canJoinThisTask ? "text-muted-foreground" : "text-white"}`}>
                  {joined ? "Đã tham gia" : "Tham gia"}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-center justify-center gap-2 mb-1">
          <ClipboardList size={16} color="#22c55e" strokeWidth={2} />
          <Text className="text-foreground text-[12px] font-bold">Giao việc</Text>
        </View>

        <View className="rounded-xl bg-background/80 border border-border/40 px-3 py-2">
          <Text className="text-muted-foreground text-[12px] font-semibold text-center mb-1">
            {message.senderId === (viewerUserId ?? groupExtras?.currentUserId) ? "Bạn" : view.actorLabel} đã giao việc
          </Text>
          <Text className="text-foreground text-[13px] font-extrabold text-center">{view.title}</Text>
          <View className="mt-2 gap-1">
            <View className="flex-row items-center justify-center gap-2 flex-wrap">
              <Users size={14} color={muted} strokeWidth={2} />
              <Text className="text-muted-foreground text-[12px]">
                <Text className="font-semibold">Giao cho:</Text> {view.assigneeLabel}
              </Text>
            </View>
            {view.dueDate ? (
              <View className="flex-row items-center justify-center gap-2 flex-wrap">
                <CalendarClock size={14} color={muted} strokeWidth={2} />
                <Text className="text-muted-foreground text-[12px]">
                  <Text className="font-semibold">Deadline:</Text> {new Date(view.dueDate).toLocaleString("vi-VN")}
                </Text>
              </View>
            ) : null}
            {view.note ? (
              <Text className="text-muted-foreground text-[12px] text-center">
                <Text className="font-semibold">Ghi chú:</Text> {view.note}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Reply-To Preview ────────────────────────────────────────────────────

function ReplyToPreview({ message, isOwn, onPress }: { message: IMessage; isOwn: boolean; onPress?: () => void }) {
  if (!message.replyToDetails) return null;

  const reply = message.replyToDetails;
  const previewContent = reply.content?.trim() || getMessageTypeLabel(reply.type) || "[Tin nhắn]";

  return (
    <Pressable
      onPress={onPress}
      className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-[3px] ${isOwn ? "bg-white/15 border-white/40" : "bg-black/5 border-primary/50"}`}
    >
      <Text className={`text-[10px] font-bold mb-0.5 ${isOwn ? "text-white/80" : "text-primary"}`} numberOfLines={1}>
        {reply.senderDisplayName ?? reply.senderId}
      </Text>
      <Text className={`text-[11px] ${isOwn ? "text-white/60" : "text-muted-foreground"}`} numberOfLines={1}>
        {previewContent}
      </Text>
    </Pressable>
  );
}

// ── Reactions Row ───────────────────────────────────────────────────────

function ReactionsRow({ reactions, isOwn }: { reactions: Record<string, string[]>; isOwn: boolean }) {
  const entries = Object.entries(reactions);
  if (entries.length === 0) return null;

  return (
    <View className={`flex-row flex-wrap gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, userIds]) => (
        <View key={emoji} className="flex-row items-center gap-0.5 bg-card border border-border/30 rounded-full px-1.5 py-0.5">
          <Text className="text-[13px]">{emoji}</Text>
          {userIds.length > 1 && <Text className="text-[10px] text-muted-foreground font-semibold">{userIds.length}</Text>}
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
    const body = [o.description, o.note, o.location].map((x) => (typeof x === "string" ? x.trim() : "")).find(Boolean);
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
  const isRecalled = Boolean(message.isRecalled);
  const isDeleted = Boolean(message.isDeleted);

  const showDateSeparator = !prevMessage || !isSameDay(prevMessage.createdAt, message.createdAt);

  if (message.type === "system" || isCenterPositionMessage(message)) {
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} />}
        <SystemCenterBlock message={message} isOwn={isOwn} viewerUserId={viewerUserId} groupExtras={isGroup ? groupExtras : undefined} />
      </>
    );
  }

  if (message.type === "call") {
    return (
      <>
        {showDateSeparator && <DateSeparator date={message.createdAt} />}
        <CallLogMessage message={message} />
      </>
    );
  }

  const isSameSenderAsPrev =
    !!prevMessage && prevMessage.senderId === message.senderId && isSameDay(prevMessage.createdAt, message.createdAt);
  const isSameSenderAsNext =
    !!nextMessage && nextMessage.senderId === message.senderId && isSameDay(nextMessage.createdAt, message.createdAt);
  const showSenderName = !isOwn && isGroup && !isSameSenderAsPrev;
  const showTimestamp = !isSameSenderAsNext;

  const rawMedia = message.mediaUrl?.trim();
  const isLocalMedia = Boolean(rawMedia && (rawMedia.startsWith("file:") || rawMedia.startsWith("content:")));
  const hasImage = message.type === "image" && rawMedia;
  const hasSticker = message.type === "sticker" && rawMedia;
  const hasVideo = message.type === "video" && (message.thumbnailUrl || rawMedia);
  const hasFile = message.type === "file" && (rawMedia || isLocalMedia);
  const hasCaption = (message.content ?? "").trim().length > 0;
  const hasReactions = message.reactions && Object.keys(message.reactions).length > 0;

  const isVisualMedia = Boolean(hasImage || hasVideo || hasSticker);
  const parsedLocation = message.type === "location" ? parseLocationPayload(message.content ?? "") : null;
  const hasLocationBlock = message.type === "location" && (parsedLocation !== null || hasCaption);
  const structuredPollSchedule = message.type === "poll" || message.type === "schedule" ? parseTitleBodyJson(message.content ?? "") : null;
  const hasPollScheduleBlock = (message.type === "poll" || message.type === "schedule") && (structuredPollSchedule !== null || hasCaption);

  const isEmojiMessage = message.type === "emoji";
  const fallbackLabel = getMessageTypeLabel(message.type);
  const hasRenderableSpecial =
    isVisualMedia || hasFile || hasLocationBlock || hasPollScheduleBlock || (isEmojiMessage && (hasCaption || Boolean(fallbackLabel)));

  const plainTextFallback = !hasRenderableSpecial && !hasCaption ? fallbackLabel || "Tin nhắn" : "";

  return (
    <>
      {showDateSeparator && <DateSeparator date={message.createdAt} />}

      <View className={`${isSameSenderAsPrev ? "mt-0.5" : "mt-2"} ${isOwn ? "items-end" : "items-start"}`}>
        {showSenderName && message.senderDisplayName ? (
          <Text className="text-primary text-[11px] font-semibold mb-1 ml-2">{message.senderDisplayName}</Text>
        ) : null}

        <Pressable onLongPress={() => onLongPress?.(message)} delayLongPress={300} className="max-w-[78%]">
          {isDeleted || isRecalled ? (
            <View className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-[20px] border border-dashed border-border/40 opacity-60">
              <Ban size={13} color={muted} strokeWidth={1.5} />
              <Text className="text-muted-foreground text-sm italic">{isDeleted ? "Tin nhắn đã bị xóa" : "Tin nhắn đã được thu hồi"}</Text>
            </View>
          ) : (
            <View>
              <View
                className={[
                  isVisualMedia ? "rounded-2xl overflow-hidden" : "",
                  !isVisualMedia
                    ? `${hasFile ? "py-1" : "px-4 py-2.5"} ${
                        hasFile ? "" : isOwn ? "bg-primary rounded-[20px] rounded-br-[5px]" : "bg-card rounded-[20px] rounded-bl-[5px]"
                      }`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <ReplyToPreview
                  message={message}
                  isOwn={isOwn && !isVisualMedia}
                  onPress={() => onPressReplyTo?.(message.replyToDetails!.messageId)}
                />

                {hasImage && (
                  <Image
                    source={{
                      uri: isLocalMedia ? rawMedia! : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) ?? ""),
                    }}
                    className="w-full aspect-[4/3] rounded-2xl"
                    resizeMode="cover"
                  />
                )}

                {hasSticker && (
                  <Image
                    source={{
                      uri: isLocalMedia ? rawMedia! : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) ?? ""),
                    }}
                    className="w-[168px] h-[168px] rounded-2xl self-center"
                    resizeMode="contain"
                  />
                )}

                {hasVideo && (
                  <View className="w-full aspect-video rounded-2xl bg-black/80 items-center justify-center overflow-hidden">
                    <Image
                      source={{
                        uri: isLocalMedia
                          ? (message.thumbnailUrl ?? rawMedia)!
                          : (normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl!) ?? ""),
                      }}
                      className="w-full h-full absolute"
                      resizeMode="cover"
                    />
                    <View className="bg-black/50 rounded-full p-3">
                      <Video size={24} color="white" strokeWidth={2} />
                    </View>
                  </View>
                )}

                {hasFile && (
                  <View
                    className={`flex-row items-center gap-3 px-3 py-2.5 mt-1 mb-1.5 border border-border/40 ${
                      isOwn ? "bg-muted/60 rounded-[20px] rounded-br-[5px]" : "bg-card border-border/50 rounded-[20px] rounded-bl-[5px]"
                    }`}
                    style={{ maxWidth: 260, minWidth: 160 }}
                  >
                    <FileText size={28} color={muted} strokeWidth={1.5} />
                    <View className="flex-1" style={{ minWidth: 0 }}>
                      <Text className="text-[13px] font-semibold leading-tight text-foreground" numberOfLines={1}>
                        {message.mediaOriginalName?.trim() || "Tệp đính kèm"}
                      </Text>
                      {message.mediaSize != null && message.mediaSize > 0 ? (
                        <Text className="text-[11px] mt-1 text-muted-foreground">{formatFileSize(message.mediaSize)}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => {
                        const url = normalizeMediaUrl(message.mediaUrl);
                        if (url) void Linking.openURL(url);
                      }}
                      className="p-2 rounded-xl border bg-muted/80 border-border/50"
                    >
                      <Download size={16} color={muted} strokeWidth={2} />
                    </Pressable>
                  </View>
                )}

                {message.type === "location" && parsedLocation ? (
                  <Pressable
                    onPress={() => void Linking.openURL(mapsUrlForLatLng(parsedLocation.lat, parsedLocation.lng))}
                    className={`flex-row items-center gap-2 px-3 py-2 rounded-xl ${isOwn ? "bg-white/15" : "bg-muted/50"}`}
                  >
                    <MapPin size={20} color={isOwn ? "rgba(255,255,255,0.85)" : primary} strokeWidth={2} />
                    <View className="flex-1 min-w-0">
                      <Text className={`text-[13px] font-semibold ${isOwn ? "text-white" : "text-foreground"}`} numberOfLines={2}>
                        {parsedLocation.title}
                      </Text>
                      <Text className={`text-[11px] mt-0.5 ${isOwn ? "text-white/70" : "text-primary"}`}>Mở bản đồ</Text>
                    </View>
                  </Pressable>
                ) : null}

                {(message.type === "poll" || message.type === "schedule") && structuredPollSchedule ? (
                  <View className={isOwn ? "bg-white/10 px-2 py-1 rounded-lg" : "bg-muted/40 px-2 py-1 rounded-lg"}>
                    <Text className={`text-[13px] font-bold ${isOwn ? "text-white" : "text-foreground"}`}>
                      {structuredPollSchedule.title}
                    </Text>
                    {structuredPollSchedule.body ? (
                      <Text className={`text-[12px] mt-1 ${isOwn ? "text-white/80" : "text-muted-foreground"}`}>
                        {structuredPollSchedule.body}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {isEmojiMessage && hasCaption ? (
                  <View className={isVisualMedia ? "px-3 py-2" : ""}>
                    <Text className={`text-[34px] leading-[42px] ${isOwn ? "text-white" : "text-foreground"}`}>{message.content}</Text>
                  </View>
                ) : null}

                {!hasFile && !isEmojiMessage && hasCaption && (
                  <View className={isVisualMedia ? "px-3 py-2" : ""}>
                    <Text className={`text-[15px] leading-[22px] ${isOwn && !isVisualMedia ? "text-white" : "text-foreground"}`}>
                      {message.content}
                    </Text>
                  </View>
                )}

                {hasFile && hasCaption && (
                  <View
                    className={`px-4 py-2 mt-1 border border-border/40 ${isOwn ? "bg-muted/60 rounded-[20px] rounded-br-[5px]" : "bg-card rounded-[20px] rounded-bl-[5px]"}`}
                  >
                    <Text className="text-[15px] leading-[22px] text-foreground">{message.content}</Text>
                  </View>
                )}

                {plainTextFallback ? (
                  <Text className={`text-[14px] ${isOwn ? "text-white/90" : "text-muted-foreground"}`}>{plainTextFallback}</Text>
                ) : null}

                {isEmojiMessage && !hasCaption && fallbackLabel ? (
                  <Text className={`text-[15px] ${isOwn ? "text-white/80" : "text-muted-foreground"}`}>{fallbackLabel}</Text>
                ) : null}

                {message.isEdited && (
                  <Text className={`text-[10px] mt-0.5 ${isOwn && !isVisualMedia ? "text-white/50" : "text-muted-foreground/60"}`}>
                    (đã sửa)
                  </Text>
                )}
              </View>

              {hasReactions && <ReactionsRow reactions={message.reactions} isOwn={isOwn} />}
            </View>
          )}
        </Pressable>

        {showTimestamp && (
          <View className={`flex-row items-center gap-1 mt-0.5 px-1 ${isOwn ? "flex-row-reverse" : "flex-row"}`}>
            <Text className="text-muted-foreground text-[11px]">{formatTimestamp(message.createdAt)}</Text>
            {isOwn && !isRecalled && !isDeleted && <StatusIcon status={message.status} primary={primary} muted={muted} />}
          </View>
        )}
      </View>
    </>
  );
};

function DateSeparator({ date }: { date: string }) {
  return (
    <View className="items-center my-3">
      <View className="bg-muted/50 px-3 py-1 rounded-full">
        <Text className="text-muted-foreground text-[11px] font-medium">{formatDateLabel(date)}</Text>
      </View>
    </View>
  );
}

function StatusIcon({ status, primary, muted }: { status: string; primary: string; muted: string }) {
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
