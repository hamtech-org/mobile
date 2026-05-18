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

import type { IMessage } from "@/types/chat.types";
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
  text: "#111827",
  sub: "#6B7280",
  bg: "#FFFFFF",
  border: "rgba(0,0,0,0.06)",
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

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        pressed && !disabled ? styles.cardPressed : null,
        disabled ? styles.cardDisabled : null,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <View style={[styles.kindCircle, { backgroundColor: accent }]}>
            <Icon size={18} color="#fff" strokeWidth={2} />
          </View>
          <View style={styles.pinBadge}>
            <Pin size={10} color={Z.primary} strokeWidth={2.5} />
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {title || "…"}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          {showPreview ? (
            <Text style={styles.preview} numberOfLines={2}>
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
  card: {
    borderWidth: 1,
    borderColor: Z.border,
    borderRadius: 16,
    backgroundColor: Z.bg,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  cardPressed: { opacity: 0.92 },
  cardDisabled: { opacity: 0.85 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
  },
  kindCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pinBadge: {
    position: "absolute",
    top: -2,
    left: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Z.border,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: Z.text,
    lineHeight: 20,
  },
  meta: {
    fontSize: 12,
    fontWeight: "500",
    color: Z.sub,
  },
  preview: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    lineHeight: 18,
  },
  thumbWrap: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#e2e8f0",
    flexShrink: 0,
  },
  thumb: { width: "100%", height: "100%" },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
});
