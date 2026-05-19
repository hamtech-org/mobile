import type { ReactElement } from "react";
import { Image, Text, View } from "react-native";
import { Image as ImageIcon, Link2, Video as VideoIcon } from "lucide-react-native";

import { ChatFileTypeBadge } from "@/components/chat/ChatFileTypeBadge";
import type { IMessage } from "@/types/chat.types";
import {
  formatPinnedMessagePreviewLine,
  mediaThumbForPinnedRow,
} from "@/utils/pinnedMessageDisplay";
import { resolveChatFileBubbleMeta } from "@/utils/chatMediaDisplay";

function extractFirstHttpUrl(content: string): string | null {
  const m = (content ?? "").trim().match(/https?:\/\/[^\s<]+/);
  return m ? m[0] : null;
}

function truncateUrl(url: string, max = 42): string {
  if (url.length <= max) return url;
  return `${url.slice(0, 28)}…${url.slice(-8)}`;
}

/** Preview một hàng trong danh sách ghim — đồng bộ web `PinnedRowPreview`. */
export function PinnedRowPreview({
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
      <View className="min-w-0 flex-1 flex-row items-center overflow-hidden">
        <Text className="shrink-0 text-[13px] font-semibold text-foreground" numberOfLines={1}>
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
      <View className="min-w-0 flex-1 flex-row items-center overflow-hidden">
        <Text className="shrink-0 text-[13px] font-semibold text-foreground" numberOfLines={1}>
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
    const { fileName, mimeType } = resolveChatFileBubbleMeta(msg);
    return (
      <View className="min-w-0 flex-1 flex-row items-center overflow-hidden">
        <Text className="shrink-0 text-[13px] font-semibold text-foreground" numberOfLines={1}>
          {sender}:{" "}
        </Text>
        <ChatFileTypeBadge fileName={fileName} mimeType={mimeType} size="xs" />
        <Text
          className="min-w-0 flex-1 text-[13px] text-muted-foreground"
          numberOfLines={1}
          ellipsizeMode="tail"
          style={{ marginLeft: 6 }}
        >
          {fileName}
        </Text>
      </View>
    );
  }

  if (msg.type === "text") {
    const url = extractFirstHttpUrl(msg.content ?? "");
    if (url) {
      return (
        <View className="min-w-0 flex-1 flex-row items-center overflow-hidden">
          <Text className="shrink-0 text-[13px] font-semibold text-foreground" numberOfLines={1}>
            {sender}:{" "}
          </Text>
          <Link2 size={13} color={mutedColor} style={{ marginRight: 4 }} />
          <Text
            className="min-w-0 flex-1 text-[13px] text-muted-foreground"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Link · {truncateUrl(url)}
          </Text>
        </View>
      );
    }
  }

  const line = formatPinnedMessagePreviewLine(msg);
  return (
    <View className="min-w-0 flex-1 flex-row items-center overflow-hidden">
      <Text className="shrink-0 text-[13px] font-semibold text-foreground" numberOfLines={1}>
        {sender}:{" "}
      </Text>
      <Text
        className="min-w-0 flex-1 text-[13px] text-muted-foreground"
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {line}
      </Text>
    </View>
  );
}
