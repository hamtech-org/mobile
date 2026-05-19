import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { FileText, X } from "lucide-react-native";

import { formatFileSize } from "@/utils/file";

export interface PendingAttachment {
  localId: string;
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

/** Kích thước thẻ — khớp web `w-18` + `h-16`. */
const CARD_WIDTH = 72;
const PREVIEW_HEIGHT = 64;

type ChatPendingAttachmentsStripProps = {
  attachments: PendingAttachment[];
  onRemove: (localId: string) => void;
  removeDisabled?: boolean;
};

/** Lưới file chờ gửi — khớp web `ChatComposer.tsx` pending attachments. */
export function ChatPendingAttachmentsStrip({
  attachments,
  onRemove,
  removeDisabled = false,
}: ChatPendingAttachmentsStripProps) {
  if (attachments.length === 0) return null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {attachments.map((item) => (
        <PendingAttachmentTile
          key={item.localId}
          item={item}
          onRemove={() => onRemove(item.localId)}
          removeDisabled={removeDisabled}
        />
      ))}
    </ScrollView>
  );
}

function PendingAttachmentTile({
  item,
  onRemove,
  removeDisabled,
}: {
  item: PendingAttachment;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  const isImage = item.mimeType.startsWith("image/");
  const isVideo = item.mimeType.startsWith("video/");
  return (
    <View style={styles.card}>
      <View style={styles.previewWrap}>
        {isImage ? (
          <Image
            source={{ uri: item.uri }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityLabel=""
          />
        ) : isVideo ? (
          <PendingVideoThumb uri={item.uri} />
        ) : (
          <View style={styles.filePlaceholder}>
            <FileText size={24} color="#6B7280" strokeWidth={1.75} />
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        {item.size != null && item.size > 0 ? (
          <Text style={styles.size}>{formatFileSize(item.size)}</Text>
        ) : null}
      </View>

      <Pressable
        onPress={onRemove}
        disabled={removeDisabled}
        hitSlop={6}
        style={[styles.removeBtn, removeDisabled && styles.removeBtnDisabled]}
        accessibilityLabel="Bỏ file"
      >
        <X size={12} color="#FFFFFF" strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

function PendingVideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.previewVideo}
      contentFit="cover"
      nativeControls={false}
      accessibilityLabel=""
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 144,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  scrollContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.10)",
    backgroundColor: "rgba(255,255,255,0.80)",
    overflow: "hidden",
  },
  previewWrap: {
    height: PREVIEW_HEIGHT,
    width: "100%",
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: PREVIEW_HEIGHT,
    backgroundColor: "rgba(244,244,245,0.90)",
  },
  previewVideo: {
    width: "100%",
    height: PREVIEW_HEIGHT,
    backgroundColor: "rgba(228,228,231,0.40)",
  },
  filePlaceholder: {
    flex: 1,
    height: PREVIEW_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  meta: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  name: {
    fontSize: 9,
    fontWeight: "500",
    lineHeight: 12,
    color: "#050505",
  },
  size: {
    fontSize: 8,
    lineHeight: 10,
    color: "#65676B",
  },
  removeBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    padding: 2,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.60)",
  },
  removeBtnDisabled: {
    opacity: 0.4,
  },
});
