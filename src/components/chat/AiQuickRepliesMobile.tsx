import { useEffect, useRef, useState, type ReactElement } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { apiClient } from "@/services/api";
import { useIconColors } from "@/hooks/useIconColors";
import { toast } from "@/utils/appToast";

type Topic = "Cải thiện" | "Hài Hước" | "Nghiêm túc" | "Truyền cảm hứng";

const TOPICS: Topic[] = ["Cải thiện", "Hài Hước", "Nghiêm túc", "Truyền cảm hứng"];

interface AiQuickRepliesMobileProps {
  activeConversationId: string | null;
  inputText: string;
  onPickReply: (text: string) => void;
}

/** Gợi ý AI theo chủ đề — khớp web `AiQuickReplies.tsx`. */
export function AiQuickRepliesMobile({
  activeConversationId,
  inputText,
  onPickReply,
}: AiQuickRepliesMobileProps): ReactElement {
  const { primary, muted } = useIconColors();
  const inputTrimmed = inputText.trim();
  const canSuggest = Boolean(activeConversationId) && inputTrimmed.length > 0;

  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, string[]>());
  const lastInputKeyRef = useRef("");

  const fetchSuggestions = async (topic: Topic) => {
    if (!canSuggest) return;

    const nextKey = `${topic}::vi::reply::${inputTrimmed}`;
    const cached = cacheRef.current.get(nextKey);
    if (cached?.length) {
      setSelectedTopic(topic);
      setReplies(cached);
      return;
    }

    setSelectedTopic(topic);
    setLoading(true);
    try {
      const res = await apiClient.post<{
        success: boolean;
        data: { suggestions: string[] };
      }>("/ai/suggest-content", {
        context: inputTrimmed,
        type: "reply",
        language: "vi",
        topics: [topic],
      });
      const normalized = (res.data?.data?.suggestions ?? [])
        .map((s) => String(s).trim())
        .filter(Boolean);
      if (!normalized.length) {
        toast.info("Không có gợi ý phù hợp.");
        return;
      }
      cacheRef.current.set(nextKey, normalized);
      setReplies(normalized);
    } catch {
      toast.error("Gợi ý AI thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const inputKey = `vi::reply::${inputTrimmed}`;
    if (lastInputKeyRef.current && lastInputKeyRef.current !== inputKey) {
      setSelectedTopic(null);
      setReplies([]);
    }
    lastInputKeyRef.current = inputKey;
  }, [inputTrimmed]);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topicRow}
      >
        {TOPICS.map((topic) => {
          const isActive = topic === selectedTopic;
          return (
            <Pressable
              key={topic}
              onPress={() => void fetchSuggestions(topic)}
              disabled={!canSuggest || loading}
              style={[
                styles.topicChip,
                isActive && { backgroundColor: primary },
                (!canSuggest || loading) && styles.topicChipDisabled,
              ]}
            >
              <View style={styles.topicChipInner}>
                {loading && isActive ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text
                  style={[styles.topicText, isActive && styles.topicTextActive]}
                  numberOfLines={1}
                >
                  {topic}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {replies.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.replyScroll}
        >
          {replies.map((text) => (
            <Pressable
              key={text}
              onPress={() => {
                if (!activeConversationId) return;
                onPickReply(text);
              }}
              disabled={!activeConversationId}
              style={styles.replyChip}
            >
              <Sparkles size={12} color={primary} strokeWidth={2} />
              <Text style={styles.replyText} numberOfLines={2}>
                {text}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {!canSuggest ? (
        <Text style={[styles.hint, { color: muted }]}>Nhập nội dung để AI gợi ý theo chủ đề.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topicRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 6,
    paddingBottom: 8,
  },
  topicChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.05)",
    flexShrink: 0,
  },
  topicChipDisabled: {
    opacity: 0.45,
  },
  topicChipInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  topicText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#65676b",
  },
  topicTextActive: {
    color: "#fff",
  },
  replyScroll: {
    paddingBottom: 4,
    paddingRight: 8,
  },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 240,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  replyText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#65676b",
    flexShrink: 1,
  },
  hint: {
    marginTop: 4,
    fontSize: 11,
  },
});
