import type { ReactElement } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  BarChart2,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  Pin,
  Video as VideoIcon,
} from "lucide-react-native";

import { ChatFileTypeBadge } from "@/components/chat/ChatFileTypeBadge";
import { chatListCardStyles } from "@/components/chat/chatListCardStyles";
import type { IMessage } from "@/types/chat.types";
import { resolveChatFileBubbleMeta } from "@/utils/chatMediaDisplay";
import {
  bulletinPinnedPreviewLine,
  mediaThumbForPinnedRow,
  pinnedBulletinCardTitle,
  pinnedBulletinMetaLine,
  pinnedMessageAccent,
  pinnedMessageKind,
  pollQuestionFromPinnedMessage,
  shouldShowPinnedBulletinPreview,
  type PinnedMessageKind,
} from "@/utils/pinnedMessageDisplay";

const Z = {
  primary: "#0068FF",
};

const KIND_ICONS: Record<PinnedMessageKind, typeof MessageSquare> = {
  message: MessageSquare,
  poll: BarChart2,
  image: ImageIcon,
  video: VideoIcon,
  file: FileText,
};

type BulletinPinnedMessageCardProps = {
  msg: IMessage;
  when: string;
  viewerUserId: string;
  onPress: () => void;
  disabled?: boolean;
};

export function BulletinPinnedMessageCard({
  msg,
  when,
  viewerUserId,
  onPress,
  disabled,
}: BulletinPinnedMessageCardProps): ReactElement {
  const who = String(msg.senderDisplayName ?? "").trim() || "Thành viên";
  const kind = pinnedMessageKind(msg);
  const accent = pinnedMessageAccent(msg);
  const Icon = KIND_ICONS[kind];
  const title = pinnedBulletinCardTitle(msg, viewerUserId);
  const pollQ = pollQuestionFromPinnedMessage(msg);
  const preview = pollQ ?? bulletinPinnedPreviewLine(msg, viewerUserId);
  const showPreview = shouldShowPinnedBulletinPreview(kind, title, preview);
  const thumb = kind === "image" || kind === "video" ? mediaThumbForPinnedRow(msg) : undefined;
  const meta = pinnedBulletinMetaLine(who, when);
  const fileMeta = kind === "file" ? resolveChatFileBubbleMeta(msg) : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        chatListCardStyles.pressable,
        pressed && !disabled ? chatListCardStyles.pressablePressed : null,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <View style={[chatListCardStyles.card, styles.row]}>
        <View style={styles.iconWrap}>
          {kind === "file" && fileMeta ? (
            <ChatFileTypeBadge
              fileName={fileMeta.fileName}
              mimeType={fileMeta.mimeType}
              size="list"
            />
          ) : (
            <View style={[styles.kindCircle, { backgroundColor: accent }]}>
              <Icon size={16} color="#fff" strokeWidth={2.25} />
            </View>
          )}
          <View style={styles.pinBadge}>
            <Pin size={9} color={Z.primary} strokeWidth={2.5} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={chatListCardStyles.title} numberOfLines={2}>
            {title || "…"}
          </Text>
          <Text style={chatListCardStyles.meta} numberOfLines={1}>
            {meta}
          </Text>
          {showPreview ? (
            <Text style={chatListCardStyles.preview} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </View>

        {thumb ? (
          <View style={styles.thumbWrap}>
            <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
            {kind === "video" ? (
              <View style={styles.videoOverlay}>
                <VideoIcon size={14} color="#fff" strokeWidth={2.5} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardDisabled: {
    opacity: 0.85,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 40,
    height: 40,
    marginRight: 12,
    flexShrink: 0,
  },
  kindCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pinBadge: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  thumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    flexShrink: 0,
    marginLeft: 10,
  },
  thumb: { width: "100%", height: "100%" },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
});
