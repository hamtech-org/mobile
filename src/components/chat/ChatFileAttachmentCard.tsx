import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CircleCheck, Download, Files, FolderOpen } from "lucide-react-native";

import {
  CHAT_FILE_FOOTER_BG,
  CHAT_FILE_FOOTER_BG_DARK,
  CHAT_FILE_FOOTER_BORDER,
  CHAT_MEDIA_SHELL_BG,
  CHAT_MEDIA_SHELL_BG_DARK,
} from "@/components/chat/chatMediaShell";
import { chatFileTypeAccent, chatFileTypeLabel } from "@/utils/chatMediaDisplay";

export interface ChatFileAttachmentCardProps {
  fileName: string;
  fileSizeLabel: string | null;
  mimeType?: string | null;
  mediaSavedOnDevice?: boolean;
  isDark?: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onFolderHint: () => void;
}

/** Footer file xanh — pixel khớp web `ChatFileMessageCard`. */
export function ChatFileAttachmentCard({
  fileName,
  fileSizeLabel,
  mimeType,
  mediaSavedOnDevice = false,
  isDark = false,
  onOpen,
  onDownload,
  onFolderHint,
}: ChatFileAttachmentCardProps) {
  const c = isDark ? FOOTER.dark : FOOTER.light;
  const typeLabel = chatFileTypeLabel(fileName, mimeType);
  const accent = chatFileTypeAccent(fileName, mimeType);
  const metaLine = [typeLabel, fileSizeLabel].filter(Boolean).join(" • ");

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: c.bg,
          borderTopColor: isDark ? "rgba(255,255,255,0.10)" : CHAT_FILE_FOOTER_BORDER,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onOpen}
        style={styles.footerMain}
        accessibilityLabel="Mở file"
      >
        <View style={[styles.typeBadge, { backgroundColor: accent }]}>
          <Text style={styles.typeBadgeText}>{typeLabel.slice(0, 4)}</Text>
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.name, { color: c.name }]} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.metaBlock}>
            {metaLine ? (
              <Text style={[styles.meta, { color: c.meta }]} numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}
            {mediaSavedOnDevice ? (
              <View style={styles.savedRow}>
                <CircleCheck size={12} color="#059669" strokeWidth={2.25} />
                <Text style={styles.savedText}>Đã có trên máy</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionRail}>
        {mediaSavedOnDevice ? (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={onFolderHint}
            style={[styles.actionBtn, { borderColor: c.btnBorder, backgroundColor: c.btnBg }]}
            accessibilityLabel="Gợi ý thư mục tải xuống"
          >
            <FolderOpen size={16} color={c.actionIcon} strokeWidth={2} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={onDownload}
          style={[styles.actionBtn, { borderColor: c.btnBorder, backgroundColor: c.btnBg }]}
          accessibilityLabel="Tải xuống"
        >
          <Download size={16} color={c.actionIcon} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Placeholder preview — khớp web `h-[132px]` nền trắng + icon xám. */
export function ChatFilePreviewPlaceholder({
  isDark = false,
  height = 132,
}: {
  isDark?: boolean;
  height?: number;
}) {
  return (
    <View
      style={[
        styles.previewPlaceholder,
        {
          height,
          backgroundColor: isDark ? CHAT_MEDIA_SHELL_BG_DARK : CHAT_MEDIA_SHELL_BG,
        },
      ]}
    >
      <Files size={48} color={isDark ? "#52525B" : "#B0B8C4"} strokeWidth={1.5} />
    </View>
  );
}

const FOOTER = {
  light: {
    bg: CHAT_FILE_FOOTER_BG,
    name: "#1C1E21",
    meta: "#65676B",
    actionIcon: "#1C1E21",
    btnBg: "#FFFFFF",
    btnBorder: "#C5D0E0",
  },
  dark: {
    bg: CHAT_FILE_FOOTER_BG_DARK,
    name: "#E4E6EB",
    meta: "#B0B3B8",
    actionIcon: "#E4E6EB",
    btnBg: "#18181B",
    btnBorder: "rgba(255,255,255,0.15)",
  },
} as const;

const styles = StyleSheet.create({
  footer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    columnGap: 8,
  },
  footerMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 10,
    minWidth: 0,
  },
  typeBadge: {
    width: 36,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  typeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  metaBlock: {
    marginTop: 2,
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
  },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 4,
    marginTop: 2,
  },
  savedText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#059669",
    lineHeight: 14,
  },
  actionRail: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 6,
    flexShrink: 0,
  },
  actionBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
  },
  previewPlaceholder: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
