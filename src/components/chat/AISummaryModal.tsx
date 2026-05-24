import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Sparkles, X } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";

interface AISummaryModalProps {
  visible: boolean;
  onClose: () => void;
  conversationName?: string | null;
  loading: boolean;
  result: string;
  onRerun: () => void;
}

export function AISummaryModal({
  visible,
  onClose,
  conversationName,
  loading,
  result,
  onRerun,
}: AISummaryModalProps) {
  const { muted } = useIconColors();
  const paragraphs = result
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Sparkles size={18} color="#fff" strokeWidth={2} />
              </View>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>AI Tóm tắt tin nhắn nhóm</Text>
                <Text style={[styles.subtitle, { color: muted }]} numberOfLines={1}>
                  {conversationName || "Nhóm chat"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={[styles.closeBtn, loading && styles.disabled]}
            >
              <X size={20} color="#64748b" strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingWrap}>
                <View style={styles.loadingIcon}>
                  <Sparkles size={28} color="#fff" strokeWidth={2} />
                </View>
                <View style={styles.loadingTextWrap}>
                  <Text style={styles.loadingTitle}>AI đang phân tích...</Text>
                  <Text style={[styles.loadingSub, { color: muted }]}>
                    Đang tổng hợp hội thoại gần đây và phần chưa đọc
                  </Text>
                </View>
                <ActivityIndicator color="#0068ff" />
              </View>
            ) : (
              <View style={styles.resultWrap}>
                <View style={styles.resultCard}>
                  <View style={styles.resultLabel}>
                    <Sparkles size={16} color="#8c52ff" strokeWidth={2} />
                    <Text style={styles.resultLabelText}>Kết quả phân tích AI</Text>
                  </View>
                  {paragraphs.length > 0 ? (
                    paragraphs.map((para, index) => (
                      <Text key={`${index}:${para.slice(0, 12)}`} style={styles.paragraph}>
                        {para}
                      </Text>
                    ))
                  ) : (
                    <Text style={styles.paragraph}>Không có dữ liệu tóm tắt.</Text>
                  )}
                </View>

                <Pressable onPress={onRerun} style={styles.rerunBtn}>
                  <Sparkles size={14} color="#64748b" strokeWidth={2} />
                  <Text style={styles.rerunText}>Phân tích lại</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
    backgroundColor: "rgba(0,104,255,0.05)",
  },
  headerLeft: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#0068ff",
  },
  titleWrap: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  closeBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  disabled: {
    opacity: 0.45,
  },
  body: {
    padding: 20,
    paddingBottom: 24,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingVertical: 48,
  },
  loadingIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#0068ff",
  },
  loadingTextWrap: {
    alignItems: "center",
    gap: 6,
  },
  loadingTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  loadingSub: {
    maxWidth: 280,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 18,
  },
  resultWrap: {
    gap: 14,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: "rgba(0,104,255,0.12)",
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(0,104,255,0.04)",
  },
  resultLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  resultLabelText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
    color: "#8c52ff",
  },
  paragraph: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    color: "#111827",
  },
  rerunBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  rerunText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
  },
});
