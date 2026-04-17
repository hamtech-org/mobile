import { Image, Pressable, Text, View } from "react-native";
import { Ban, Check, CheckCheck, FileText, Phone, Video } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import { normalizeMediaUrl } from "@/utils/url";
import type { IMessage } from "@/types/chat.types";

interface ChatBubbleProps {
  message: IMessage;
  isOwn: boolean;
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
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Hôm nay";
  if (date.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function isSameDay(a: string, b: string): boolean {
  return a.slice(0, 10) === b.slice(0, 10);
}

function getMediaTypeLabel(type: string | undefined): string {
  switch (type) {
    case "image":
      return "[Ảnh]";
    case "video":
      return "[Video]";
    case "file":
      return "[File]";
    default:
      return "";
  }
}

// ── System Message ──────────────────────────────────────────────────────

function SystemMessage({
  message,
  isOwn,
}: {
  message: IMessage;
  isOwn: boolean;
}) {
  let content = message.content;

  // Thay tên sender bằng "Bạn" nếu chính mình
  if (isOwn && message.senderDisplayName) {
    const name = message.senderDisplayName.trim();
    if (name) content = content.replace(name, "Bạn");
  }

  // Cố parse JSON system message (poll, task)
  if (content.trim().startsWith("{")) {
    try {
      const obj = JSON.parse(content) as Record<string, unknown>;
      const kind = obj?.kind as string | undefined;
      const actor = (obj as { actor?: { name?: string } })?.actor?.name;
      const actorName = isOwn ? "Bạn" : (actor ?? "Ai đó");

      if (kind === "poll_created") {
        const question = String(
          (obj as { poll?: { question?: string } })?.poll?.question ?? "",
        );
        content = `${actorName} đã tạo bình chọn${question ? `: ${question}` : ""}`;
      } else if (kind === "task_assigned") {
        const title = String(
          (obj as { task?: { title?: string } })?.task?.title ?? "",
        );
        content = `${actorName} đã giao việc: ${title}`;
      } else if (kind === "task_joined") {
        const title = String(
          (obj as { task?: { title?: string } })?.task?.title ?? "",
        );
        content = `${actorName} đã tham gia: ${title}`;
      }
    } catch {
      // ignore — render raw content
    }
  }

  return (
    <View className="items-center my-2 px-6">
      <View className="bg-muted/60 px-4 py-2 rounded-2xl max-w-[85%]">
        <Text className="text-muted-foreground text-[12px] text-center leading-[18px]">
          {content}
        </Text>
      </View>
    </View>
  );
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
    durationSec > 0
      ? `${Math.floor(durationSec / 60)} phút ${durationSec % 60} giây`
      : "";

  const IconComponent = callType === "video" ? Video : Phone;
  const iconColor = kind === "missed" ? "#ef4444" : primary;

  return (
    <View className="items-center my-3 px-6">
      <View className="bg-muted/40 border border-border/30 px-5 py-3 rounded-2xl min-w-[220px] items-center">
        <View className="flex-row items-center gap-2 mb-1">
          <IconComponent size={16} color={iconColor} strokeWidth={1.5} />
          <Text className="text-foreground text-sm font-bold">{title}</Text>
        </View>
        {durationLabel ? (
          <Text className="text-muted-foreground text-xs">{durationLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Reply-To Preview ────────────────────────────────────────────────────

function ReplyToPreview({
  message,
  isOwn,
  onPress,
}: {
  message: IMessage;
  isOwn: boolean;
  onPress?: () => void;
}) {
  if (!message.replyToDetails) return null;

  const reply = message.replyToDetails;
  const previewContent =
    reply.content?.trim() ||
    getMediaTypeLabel(reply.type) ||
    "[Media]";

  return (
    <Pressable
      onPress={onPress}
      className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-[3px] ${
        isOwn
          ? "bg-white/15 border-white/40"
          : "bg-black/5 border-primary/50"
      }`}
    >
      <Text
        className={`text-[10px] font-bold mb-0.5 ${
          isOwn ? "text-white/80" : "text-primary"
        }`}
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
    <View
      className={`flex-row flex-wrap gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}
    >
      {entries.map(([emoji, userIds]) => (
        <View
          key={emoji}
          className="flex-row items-center gap-0.5 bg-card border border-border/30 rounded-full px-1.5 py-0.5"
        >
          <Text className="text-[13px]">{emoji}</Text>
          {userIds.length > 1 && (
            <Text className="text-[10px] text-muted-foreground font-semibold">
              {userIds.length}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Main ChatBubble ─────────────────────────────────────────────────────

export const ChatBubble = ({
  message,
  isOwn,
  isGroup = false,
  prevMessage,
  nextMessage,
  onLongPress,
  onPressReplyTo,
}: ChatBubbleProps) => {
  const { muted, primary } = useIconColors();
  const isRecalled = Boolean(message.isRecalled);
  const isDeleted = Boolean(message.isDeleted);

  // ── Date separator ─────────────────────────────────────────
  const showDateSeparator =
    !prevMessage || !isSameDay(prevMessage.createdAt, message.createdAt);

  // ── System message ─────────────────────────────────────────
  if (message.type === "system" || (message as any).position === "center") {
    return (
      <>
        {showDateSeparator && (
          <DateSeparator date={message.createdAt} />
        )}
        <SystemMessage message={message} isOwn={isOwn} />
      </>
    );
  }

  // ── Call log ───────────────────────────────────────────────
  if (message.type === "call") {
    return (
      <>
        {showDateSeparator && (
          <DateSeparator date={message.createdAt} />
        )}
        <CallLogMessage message={message} />
      </>
    );
  }

  // ── Grouping logic ────────────────────────────────────────
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

  // ── Media checks ──────────────────────────────────────────
  const hasImage = message.type === "image" && message.mediaUrl;
  const hasVideo = message.type === "video" && (message.thumbnailUrl || message.mediaUrl);
  const hasFile = message.type === "file" && message.mediaUrl;
  const hasCaption = (message.content ?? "").trim().length > 0;
  const hasReactions =
    message.reactions && Object.keys(message.reactions).length > 0;

  return (
    <>
      {showDateSeparator && <DateSeparator date={message.createdAt} />}

      <View
        className={`${isSameSenderAsPrev ? "mt-0.5" : "mt-2"} ${isOwn ? "items-end" : "items-start"}`}
      >
        {/* Sender name — group chat only */}
        {showSenderName && message.senderDisplayName ? (
          <Text className="text-primary text-[11px] font-semibold mb-1 ml-2">
            {message.senderDisplayName}
          </Text>
        ) : null}

        <Pressable
          onLongPress={() => onLongPress?.(message)}
          delayLongPress={300}
          className="max-w-[78%]"
        >
          {/* Deleted / Recalled */}
          {isDeleted || isRecalled ? (
            <View className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-[20px] border border-dashed border-border/40 opacity-60">
              <Ban size={13} color={muted} strokeWidth={1.5} />
              <Text className="text-muted-foreground text-sm italic">
                {isDeleted
                  ? "Tin nhắn đã bị xóa"
                  : "Tin nhắn đã được thu hồi"}
              </Text>
            </View>
          ) : (
            <View>
              {/* Main bubble */}
              <View
                className={[
                  hasImage || hasVideo
                    ? "rounded-2xl overflow-hidden"
                    : `px-4 py-2.5 ${
                        isOwn
                          ? "bg-primary rounded-[20px] rounded-br-[5px]"
                          : "bg-card rounded-[20px] rounded-bl-[5px]"
                      }`,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* Reply-to preview */}
                <ReplyToPreview
                  message={message}
                  isOwn={isOwn && !hasImage && !hasVideo}
                  onPress={() =>
                    onPressReplyTo?.(message.replyToDetails!.messageId)
                  }
                />

                {/* Image */}
                {hasImage && (
                  <Image
                    source={{ uri: normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl) }}
                    className="w-full aspect-[4/3] rounded-2xl"
                    resizeMode="cover"
                  />
                )}

                {/* Video thumbnail */}
                {hasVideo && (
                  <View className="w-full aspect-video rounded-2xl bg-black/80 items-center justify-center overflow-hidden">
                    <Image
                      source={{
                        uri: normalizeMediaUrl(message.thumbnailUrl ?? message.mediaUrl!),
                      }}
                      className="w-full h-full absolute"
                      resizeMode="cover"
                    />
                    <View className="bg-black/50 rounded-full p-3">
                      <Video size={24} color="white" strokeWidth={2} />
                    </View>
                  </View>
                )}

                {/* File */}
                {hasFile && (
                  <View
                    className={`flex-row items-center gap-2 px-3 py-2.5 rounded-2xl ${
                      isOwn ? "bg-primary" : "bg-card"
                    }`}
                  >
                    <FileText
                      size={28}
                      color={isOwn ? "rgba(255,255,255,0.7)" : muted}
                      strokeWidth={1.5}
                    />
                    <View className="flex-1 min-w-0">
                      <Text
                        className={`text-xs font-semibold ${isOwn ? "text-white" : "text-foreground"}`}
                        numberOfLines={1}
                      >
                        {message.mediaOriginalName?.trim() || "File đính kèm"}
                      </Text>
                      {message.mediaSize != null && message.mediaSize > 0 && (
                        <Text
                          className={`text-[10px] ${isOwn ? "text-white/60" : "text-muted-foreground"}`}
                        >
                          {formatFileSize(message.mediaSize)}
                        </Text>
                      )}
                    </View>
                  </View>
                )}

                {/* Text content / caption */}
                {!hasFile && hasCaption && (
                  <View className={hasImage || hasVideo ? "px-3 py-2" : ""}>
                    <Text
                      className={`text-[15px] leading-[22px] ${
                        isOwn && !hasImage && !hasVideo
                          ? "text-white"
                          : "text-foreground"
                      }`}
                    >
                      {message.content}
                    </Text>
                  </View>
                )}

                {/* Edited indicator */}
                {message.isEdited && (
                  <Text
                    className={`text-[10px] mt-0.5 ${
                      isOwn && !hasImage && !hasVideo
                        ? "text-white/50"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    (đã sửa)
                  </Text>
                )}
              </View>

              {/* Reactions */}
              {hasReactions && (
                <ReactionsRow reactions={message.reactions} isOwn={isOwn} />
              )}
            </View>
          )}
        </Pressable>

        {/* Timestamp + Status */}
        {showTimestamp && (
          <View
            className={`flex-row items-center gap-1 mt-0.5 px-1 ${
              isOwn ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <Text className="text-muted-foreground text-[11px]">
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

// ── Sub-components ──────────────────────────────────────────────────────

function DateSeparator({ date }: { date: string }) {
  return (
    <View className="items-center my-3">
      <View className="bg-muted/50 px-3 py-1 rounded-full">
        <Text className="text-muted-foreground text-[11px] font-medium">
          {formatDateLabel(date)}
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
  if (status === "read") {
    return <CheckCheck size={12} color={primary} strokeWidth={2} />;
  }
  if (status === "delivered") {
    return <CheckCheck size={12} color={muted} strokeWidth={2} />;
  }
  return <Check size={12} color={muted} strokeWidth={2} />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
