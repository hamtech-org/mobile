import { useCallback, useMemo, useRef, useState, type ReactElement } from "react";
import { Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageSquare,
  MoreHorizontal,
  PinOff,
  Video as VideoIcon,
} from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { IMessage } from "@/types/chat.types";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { normalizeMediaUrl } from "@/utils/url";

const ACCENT_BLUE = "#0068FF";
const ACCENT_GREEN = "#10b981";

function extractFirstHttpUrl(content: string): string | null {
  const m = (content ?? "").trim().match(/https?:\/\/[^\s<]+/);
  return m ? m[0] : null;
}

function truncateUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return `${url.slice(0, 28)}…${url.slice(-8)}`;
}

function mediaThumbForPinnedRow(msg: IMessage): string | undefined {
  if (msg.type === "image" || msg.type === "video") {
    return normalizeMediaUrl(msg.thumbnailUrl ?? msg.mediaUrl);
  }
  return undefined;
}

function pollQuestionFromMsg(msg: IMessage): string | null {
  if ((msg as { type?: string }).type !== "system") return null;
  const raw = String((msg as { content?: string }).content ?? "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    const obj = JSON.parse(raw) as { kind?: string; poll?: { question?: string } };
    if (obj?.kind !== "poll_created") return null;
    const q = String(obj?.poll?.question ?? "").trim();
    return q || null;
  } catch {
    return null;
  }
}

/** Một dòng preview cho hàng pinned (đồng bộ web `PinnedRowPreview`). */
function PinnedRowPreview({
  msg,
  viewerUserId,
  mutedColor,
}: {
  msg: IMessage;
  viewerUserId: string;
  mutedColor: string;
}): ReactElement {
  const sender = msg.senderDisplayName?.trim() || "Người dùng";
  const thumb = mediaThumbForPinnedRow(msg);

  if (msg.type === "image") {
    return (
      <View className="flex-row items-center" style={{ flexShrink: 1 }}>
        <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
          {sender}:{" "}
        </Text>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              marginRight: 6,
              backgroundColor: "#e2e8f0",
            }}
            resizeMode="cover"
          />
        ) : (
          <ImageIcon size={14} color={mutedColor} style={{ marginRight: 4 }} />
        )}
        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          Ảnh
        </Text>
      </View>
    );
  }

  if (msg.type === "video") {
    return (
      <View className="flex-row items-center" style={{ flexShrink: 1 }}>
        <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
          {sender}:{" "}
        </Text>
        {thumb ? (
          <Image
            source={{ uri: thumb }}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              marginRight: 6,
              backgroundColor: "#0a0a0a",
            }}
            resizeMode="cover"
          />
        ) : (
          <VideoIcon size={14} color={mutedColor} style={{ marginRight: 4 }} />
        )}
        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          Video
        </Text>
      </View>
    );
  }

  if (msg.type === "file") {
    const name = msg.mediaOriginalName?.trim() || "Tệp tin";
    return (
      <View className="flex-row items-center" style={{ flexShrink: 1 }}>
        <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
          {sender}:{" "}
        </Text>
        <FileText size={14} color={mutedColor} style={{ marginRight: 4 }} />
        <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
          {name}
        </Text>
      </View>
    );
  }

  if (msg.type === "text") {
    const url = extractFirstHttpUrl(msg.content ?? "");
    if (url) {
      return (
        <View className="flex-row items-center" style={{ flexShrink: 1 }}>
          <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
            {sender}:{" "}
          </Text>
          <Link2 size={13} color={mutedColor} style={{ marginRight: 4 }} />
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            Link · {truncateUrl(url)}
          </Text>
        </View>
      );
    }
  }

  const line = formatChatPreviewLine(msg, viewerUserId);
  return (
    <View className="flex-row items-center" style={{ flexShrink: 1 }}>
      <Text className="text-[13px] font-semibold text-foreground" numberOfLines={1}>
        {sender}:{" "}
      </Text>
      <Text className="flex-1 text-[13px] text-muted-foreground" numberOfLines={1}>
        {line}
      </Text>
    </View>
  );
}

interface PinnedRowProps {
  msg: IMessage;
  viewerUserId: string;
  onPress: () => void;
  onUnpin?: () => void | Promise<void>;
}

function PinnedRow({ msg, viewerUserId, onPress, onUnpin }: PinnedRowProps): ReactElement {
  const { muted } = useIconColors();
  const moreBtnRef = useRef<View>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const pollQuestion = useMemo(() => pollQuestionFromMsg(msg), [msg]);

  const openMenu = useCallback(() => {
    moreBtnRef.current?.measureInWindow((x, y, _w, h) => {
      const screenW = Dimensions.get("window").width;
      const menuW = 168;
      const left = Math.max(8, Math.min(x - menuW + 28, screenW - menuW - 8));
      setMenuPos({ top: y + h + 6, left });
    });
  }, []);

  const closeMenu = useCallback(() => setMenuPos(null), []);

  return (
    <>
      <View className="flex-row items-stretch gap-2 border-b border-border bg-card">
        <Pressable
          className="min-w-0 flex-1 flex-row items-start gap-3 px-3 py-2.5 active:bg-muted/40"
          onPress={onPress}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pollQuestion ? ACCENT_GREEN : ACCENT_BLUE,
            }}
          >
            {pollQuestion ? (
              <BarChart2 size={18} color="#fff" strokeWidth={2} />
            ) : (
              <MessageSquare size={18} color="#fff" strokeWidth={2} />
            )}
          </View>
          <View className="min-w-0 flex-1 pt-0.5">
            <Text className="text-[13px] font-bold text-foreground" numberOfLines={1}>
              {pollQuestion ? "Bình chọn" : "Tin nhắn"}
            </Text>
            <View className="mt-0.5">
              {pollQuestion ? (
                <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
                  {pollQuestion}
                </Text>
              ) : (
                <PinnedRowPreview msg={msg} viewerUserId={viewerUserId} mutedColor={muted} />
              )}
            </View>
          </View>
        </Pressable>

        {onUnpin ? (
          <View ref={moreBtnRef} collapsable={false} className="items-center justify-center pr-2">
            <Pressable
              onPress={openMenu}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-lg active:bg-muted"
              android_ripple={{ color: "rgba(0,0,0,0.06)", borderless: true }}
            >
              <MoreHorizontal size={18} color={muted} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Modal
        visible={menuPos !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeMenu}
      >
        <Pressable style={{ flex: 1 }} onPress={closeMenu}>
          {menuPos ? (
            <View
              className="overflow-hidden rounded-lg border border-border bg-card"
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                minWidth: 168,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.18,
                shadowRadius: 14,
                elevation: 8,
              }}
              pointerEvents="box-none"
            >
              <Pressable
                onPress={() => {
                  closeMenu();
                  void onUnpin?.();
                }}
                className="flex-row items-center gap-2 px-3 py-2.5 active:bg-muted/60"
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              >
                <PinOff size={16} color={muted} />
                <Text className="text-[13px] text-foreground">Bỏ ghim</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

export interface ChatPinnedReminderBarProps {
  pinnedMessages: IMessage[];
  currentUserId: string;
  onJumpToMessage: (messageId: string) => void;
  /** Mở menu "Bỏ ghim" cho hàng nếu được cung cấp. */
  onTogglePin?: (msg: IMessage) => void | Promise<void>;
}

/**
 * Thanh "Danh sách ghim" (đồng bộ web `PinnedMessagesBar`):
 * collapsed → 1 dòng "Danh sách ghim (N)"; expanded → list inline có scroll.
 */
export function ChatPinnedReminderBar({
  pinnedMessages,
  currentUserId,
  onJumpToMessage,
  onTogglePin,
}: ChatPinnedReminderBarProps): ReactElement | null {
  const { muted } = useIconColors();
  const total = pinnedMessages.length;
  const [expanded, setExpanded] = useState(false);

  if (total === 0) return null;

  if (!expanded) {
    return (
      <View className="w-full border-b border-border bg-muted/70">
        <Pressable
          className="w-full flex-row items-center gap-2 px-3 py-2.5 active:bg-muted"
          onPress={() => setExpanded(true)}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ACCENT_BLUE,
            }}
          >
            <MessageSquare size={14} color="#fff" strokeWidth={2} />
          </View>
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            Danh sách ghim ({total})
          </Text>
          <View style={{ flex: 1 }} />
          <Text className="text-[13px] text-muted-foreground">Mở rộng</Text>
          <ChevronDown size={16} color={muted} />
        </Pressable>
      </View>
    );
  }

  const listMaxH = Math.min(Dimensions.get("window").height * 0.5, 320);

  return (
    <View className="w-full border-b border-border bg-card">
      <View className="flex-row items-center justify-between gap-2 border-b border-border bg-muted/70 px-3 py-2">
        <Text className="text-[14px] font-bold text-foreground" numberOfLines={1}>
          Danh sách ghim ({total})
        </Text>
        <Pressable
          className="flex-row items-center gap-1 rounded-md px-1.5 py-1 active:bg-muted"
          onPress={() => setExpanded(false)}
          android_ripple={{ color: "rgba(0,0,0,0.06)" }}
          hitSlop={6}
        >
          <Text className="text-[13px] font-medium text-muted-foreground">Thu gọn</Text>
          <ChevronUp size={16} color={muted} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: listMaxH }} nestedScrollEnabled showsVerticalScrollIndicator>
        {pinnedMessages.map((msg) => (
          <PinnedRow
            key={msg.messageId}
            msg={msg}
            viewerUserId={currentUserId}
            onPress={() => onJumpToMessage(msg.messageId)}
            onUnpin={onTogglePin ? () => onTogglePin(msg) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}
