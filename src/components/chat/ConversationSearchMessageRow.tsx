import type { ReactElement } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ImageIcon, Link2, Video } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { chatListCardStyles } from "@/components/chat/chatListCardStyles";
import { CONVERSATION_GALLERY_THEME } from "@/components/chat/conversationGallery/conversationGalleryTheme";
import type { IMessage } from "@/types/chat.types";
import { chatImageDisplayUrl } from "@/utils/chatMediaDisplay";
import {
  conversationSearchLeadKind,
  conversationSearchResultMeta,
  conversationSearchResultTitle,
  isConversationSearchLinkMessage,
} from "@/utils/conversationSearchDisplay";
import { formatChatPreviewLine } from "@/utils/messageDisplay";

type ConversationSearchMessageRowProps = {
  message: IMessage;
  currentUserId: string;
  senderLabel: string;
  avatarUri?: string | null;
  timeLabel: string;
  needle: string;
  onPress: () => void;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightTitle({ text, needle }: { text: string; needle: string }): ReactElement {
  const n = needle.trim();
  if (!n) return <Text style={styles.title}>{text}</Text>;
  try {
    const parts = text.split(new RegExp(`(${escapeRegExp(n)})`, "gi"));
    return (
      <Text style={styles.title} numberOfLines={2}>
        {parts.map((part, i) =>
          part.toLowerCase() === n.toLowerCase() ? (
            <Text key={i} style={styles.titleHighlight}>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          ),
        )}
      </Text>
    );
  } catch {
    return (
      <Text style={styles.title} numberOfLines={2}>
        {text}
      </Text>
    );
  }
}

function SearchResultLead({
  message: m,
  linkLike,
  avatarUri,
  senderLabel,
}: {
  message: IMessage;
  linkLike: boolean;
  avatarUri?: string | null;
  senderLabel: string;
}): ReactElement {
  const mediaTheme = CONVERSATION_GALLERY_THEME.media;
  const linkTheme = CONVERSATION_GALLERY_THEME.link;
  const lead = conversationSearchLeadKind(m, linkLike);

  if (lead === "image-thumb") {
    const thumb = chatImageDisplayUrl(m);
    return (
      <View style={[styles.lead, { backgroundColor: mediaTheme.softBg }]}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.leadFill} resizeMode="cover" />
        ) : (
          <ImageIcon size={24} color={mediaTheme.tint} strokeWidth={1.75} />
        )}
      </View>
    );
  }

  if (lead === "video-icon") {
    return (
      <View style={[styles.lead, { backgroundColor: mediaTheme.softBg }]}>
        <Video size={24} color={mediaTheme.tint} strokeWidth={1.75} />
      </View>
    );
  }

  if (lead === "link-icon") {
    return (
      <View style={[styles.lead, { backgroundColor: linkTheme.softBg }]}>
        <Link2 size={22} color={linkTheme.tint} strokeWidth={2} />
      </View>
    );
  }

  return (
    <View style={styles.leadAvatar}>
      <Avatar uri={avatarUri} name={senderLabel} size="md" />
    </View>
  );
}

/** Một dòng kết quả — card giống file/link, gọn một cột trái + nội dung. */
export function ConversationSearchMessageRow({
  message: m,
  currentUserId,
  senderLabel,
  avatarUri,
  timeLabel,
  needle,
  onPress,
}: ConversationSearchMessageRowProps): ReactElement {
  const rawPreview = formatChatPreviewLine(m, currentUserId);
  const linkLike = isConversationSearchLinkMessage(m, rawPreview);
  const title = conversationSearchResultTitle(m, rawPreview);
  const meta = conversationSearchResultMeta(senderLabel, timeLabel);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        chatListCardStyles.pressable,
        pressed ? chatListCardStyles.pressablePressed : null,
      ]}
    >
      <View style={[chatListCardStyles.card, styles.row]}>
        <SearchResultLead
          message={m}
          linkLike={linkLike}
          avatarUri={avatarUri}
          senderLabel={senderLabel}
        />
        <View style={styles.textCol}>
          <HighlightTitle text={title} needle={needle} />
          <Text style={chatListCardStyles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#202124",
    lineHeight: 20,
  },
  titleHighlight: {
    backgroundColor: "rgba(59, 130, 246, 0.22)",
    color: "#1D4ED8",
    fontWeight: "700",
  },
  lead: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  leadFill: {
    width: 48,
    height: 48,
  },
  leadAvatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
