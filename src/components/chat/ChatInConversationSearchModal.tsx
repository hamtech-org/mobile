import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Calendar, ChevronLeft, Search, User, X } from "lucide-react-native";
import { ChatSharedFileRow } from "@/components/chat/ChatSharedFileRow";
import { ConversationSearchMessageRow } from "@/components/chat/ConversationSearchMessageRow";
import { resolveChatFileBubbleMeta } from "@/utils/chatMediaDisplay";
import { SafeAreaView } from "react-native-safe-area-context";

import { useIconColors } from "@/hooks/useIconColors";
import { apiClient } from "@/services/api";
import type { ApiEnvelope } from "@/store/api/baseChatApi";
import type { IMessage } from "@/types/chat.types";
import { toast } from "@/utils/appToast";
import { formatChatPreviewLine } from "@/utils/messageDisplay";
import { formatZaloConversationTime } from "@/utils/time";

export type ConversationSearchMemberRow = {
  userId?: string;
  displayName?: string | null;
  name?: string | null;
  avatar?: string | null;
};

type ChatInConversationSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  messages: IMessage[];
  currentUserId?: string;
  conversationId?: string;
  conversationTitle?: string;
  conversationMembers?: ConversationSearchMemberRow[];
  memberAvatarById?: Record<string, string>;
  onSelectMessage: (messageId: string) => void;
};

const PRIMARY = "#0068FF";
const INITIAL_MSG_LIMIT = 15;
const INITIAL_FILE_LIMIT = 8;

const Z = {
  bg: "#FFFFFF",
  subBg: "#F3F4F6",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  primary: "#0068FF",
  primarySoft: "rgba(0, 104, 255, 0.1)",
  primaryBorder: "rgba(0, 104, 255, 0.4)",
};

function searchHaystack(m: IMessage): string {
  return [m.content, m.mediaOriginalName, m.senderDisplayName, m.senderId]
    .filter((x) => x != null && String(x).length > 0)
    .join(" ")
    .toLowerCase();
}

function isSearchableMessage(m: IMessage): boolean {
  if (m.isRecalled || m.isDeleted) return false;
  if (m.type === "system" || m.position === "center") return false;
  return true;
}

function localDayBoundsIso(dateStr: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const start = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const end = new Date(y, mo - 1, d, 23, 59, 59, 999);
  if (Number.isNaN(start.getTime())) return null;
  return { from: start.toISOString(), to: end.toISOString() };
}

function messageOnLocalDay(createdAt: string, dateStr: string): boolean {
  if (!dateStr) return true;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return false;
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return key === dateStr;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return "";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateFilterLabel(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "";
  const [y, mo, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`;
}

/**
 * Tìm tin nhắn / file trong hội thoại — đồng bộ web ConversationSearchPanel.
 */
export function ChatInConversationSearchModal({
  visible,
  onClose,
  messages,
  currentUserId,
  conversationId,
  conversationTitle,
  conversationMembers = [],
  memberAvatarById = {},
  onSelectMessage,
}: ChatInConversationSearchModalProps) {
  const { foreground } = useIconColors();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [senderUserId, setSenderUserId] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [browseRemote, setBrowseRemote] = useState<IMessage[] | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [msgLimit, setMsgLimit] = useState(INITIAL_MSG_LIMIT);
  const [fileLimit, setFileLimit] = useState(INITIAL_FILE_LIMIT);
  const [senderPickerOpen, setSenderPickerOpen] = useState(false);
  const [iosDatePickerOpen, setIosDatePickerOpen] = useState(false);
  const lastEmptyToastKey = useRef<string | null>(null);

  const avatarBySenderId = useMemo(() => {
    const map: Record<string, string> = { ...memberAvatarById };
    for (const row of conversationMembers) {
      const id = row.userId?.trim();
      const url = row.avatar?.trim();
      if (id && url) map[id] = url;
    }
    return map;
  }, [memberAvatarById, conversationMembers]);

  const displayNameBySenderId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of conversationMembers) {
      const id = row.userId?.trim();
      if (!id) continue;
      const raw = (row.displayName ?? row.name ?? "").trim();
      const label = currentUserId && id === currentUserId ? "Bạn" : raw || "Thành viên";
      map.set(id, label);
    }
    return map;
  }, [conversationMembers, currentUserId]);

  const memberSelectOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: { userId: string; label: string }[] = [];
    for (const row of conversationMembers) {
      const id = row.userId?.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const raw = (row.displayName ?? row.name ?? "").trim();
      const label = currentUserId && id === currentUserId ? "Bạn" : raw || "Thành viên";
      out.push({ userId: id, label });
    }
    out.sort((a, b) => a.label.localeCompare(b.label, "vi"));
    return out;
  }, [conversationMembers, currentUserId]);

  const selectedSenderLabel = useMemo(() => {
    if (!senderUserId) return "Người gửi";
    return memberSelectOptions.find((o) => o.userId === senderUserId)?.label ?? "Người gửi";
  }, [senderUserId, memberSelectOptions]);

  const resetFilters = useCallback(() => {
    setQ("");
    setDebouncedQ("");
    setSenderUserId("");
    setDateFilter("");
    setBrowseRemote(null);
    setBrowseError(null);
    setMsgLimit(INITIAL_MSG_LIMIT);
    setFileLimit(INITIAL_FILE_LIMIT);
    setSenderPickerOpen(false);
    setIosDatePickerOpen(false);
    lastEmptyToastKey.current = null;
  }, []);

  useEffect(() => {
    if (!visible) resetFilters();
  }, [visible, resetFilters]);

  useEffect(() => {
    setSenderUserId("");
    setDateFilter("");
    setBrowseRemote(null);
    setBrowseError(null);
  }, [conversationId]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setMsgLimit(INITIAL_MSG_LIMIT);
    setFileLimit(INITIAL_FILE_LIMIT);
  }, [debouncedQ, senderUserId, dateFilter]);

  useEffect(() => {
    if (!conversationId || (!senderUserId && !dateFilter)) {
      setBrowseRemote(null);
      setBrowseLoading(false);
      setBrowseError(null);
      return;
    }
    let cancelled = false;
    setBrowseLoading(true);
    setBrowseError(null);
    const params: Record<string, string> = { limit: "250" };
    if (senderUserId) params.senderId = senderUserId;
    if (dateFilter) {
      const bounds = localDayBoundsIso(dateFilter);
      if (bounds) {
        params.from = bounds.from;
        params.to = bounds.to;
      }
    }
    void apiClient
      .get<ApiEnvelope<IMessage[]>>(`/chat/conversations/${conversationId}/messages/browse`, {
        params,
      })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data;
        setBrowseRemote(Array.isArray(payload) ? payload : []);
      })
      .catch(() => {
        if (cancelled) return;
        setBrowseRemote(null);
        setBrowseError("Không tải được thêm tin từ máy chủ.");
        toast.info("Lọc theo thành viên/ngày: chỉ hiển thị tin đã tải trên máy (lỗi mạng).");
      })
      .finally(() => {
        if (!cancelled) setBrowseLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, senderUserId, dateFilter]);

  const searchPool = useMemo(() => {
    const map = new Map<string, IMessage>();
    for (const m of messages) map.set(m.messageId, m);
    if (browseRemote?.length) {
      for (const m of browseRemote) map.set(m.messageId, m);
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [messages, browseRemote]);

  const { messageHits, fileHits } = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    const hasText = needle.length > 0;
    if (!hasText && !senderUserId && !dateFilter) {
      return { messageHits: [] as IMessage[], fileHits: [] as IMessage[] };
    }
    const msgOut: IMessage[] = [];
    const fileOut: IMessage[] = [];
    for (let i = searchPool.length - 1; i >= 0; i--) {
      const m = searchPool[i]!;
      if (!isSearchableMessage(m)) continue;
      if (senderUserId && m.senderId !== senderUserId) continue;
      if (dateFilter && !messageOnLocalDay(m.createdAt, dateFilter)) continue;
      if (hasText && !searchHaystack(m).includes(needle)) continue;
      if (m.type === "file") {
        if (fileOut.length < 200) fileOut.push(m);
      } else if (msgOut.length < 200) {
        msgOut.push(m);
      }
      if (msgOut.length >= 200 && fileOut.length >= 200) break;
    }
    return { messageHits: msgOut, fileHits: fileOut };
  }, [searchPool, debouncedQ, senderUserId, dateFilter]);

  const totalHits = messageHits.length + fileHits.length;
  const needleForUi = debouncedQ.trim();
  const shownMessages = messageHits.slice(0, msgLimit);
  const shownFiles = fileHits.slice(0, fileLimit);
  const hasMoreMsg = messageHits.length > msgLimit;
  const hasMoreFile = fileHits.length > fileLimit;
  const hasActiveFilter = Boolean(needleForUi || senderUserId || dateFilter);

  useEffect(() => {
    if (!hasActiveFilter) {
      lastEmptyToastKey.current = null;
      return;
    }
    if (totalHits > 0 || browseLoading) {
      lastEmptyToastKey.current = null;
      return;
    }
    const toastKey = `${needleForUi}\0${senderUserId}\0${dateFilter}`;
    if (lastEmptyToastKey.current === toastKey) return;
    lastEmptyToastKey.current = toastKey;
    toast.info(
      "Không tìm thấy tin nhắn hoặc file phù hợp (đã gộp tin tải thêm từ máy chủ nếu có).",
    );
  }, [hasActiveFilter, totalHits, browseLoading, needleForUi, senderUserId, dateFilter]);

  const jump = (messageId: string) => {
    onSelectMessage(messageId);
    onClose();
  };

  const openAndroidDatePicker = () => {
    const base = dateFilter
      ? (() => {
          const [y, mo, d] = dateFilter.split("-").map(Number);
          return new Date(y, mo - 1, d);
        })()
      : new Date();
    DateTimePickerAndroid.open({
      value: base,
      mode: "date",
      display: "default",
      onChange: (event, selectedDate) => {
        if (event.type !== "set" || !selectedDate) return;
        setDateFilter(toLocalDateKey(selectedDate));
      },
    });
  };

  const senderLabelFor = useCallback(
    (m: IMessage) => {
      if (m.senderId === currentUserId) return "Bạn";
      return displayNameBySenderId.get(m.senderId) ?? m.senderDisplayName?.trim() ?? "Thành viên";
    },
    [currentUserId, displayNameBySenderId],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.topBarBtn} hitSlop={8}>
            <ChevronLeft size={26} color={foreground} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.topTitle}>Tìm kiếm</Text>
          <View style={styles.topBarBtn} />
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchRow}>
            <Search size={18} color={Z.sub} strokeWidth={2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Nhập từ khóa để tìm kiếm"
              placeholderTextColor={Z.sub}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
            />
            {q.trim() !== "" ? (
              <Pressable onPress={() => setQ("")} hitSlop={8} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Xóa</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Lọc theo</Text>

            {memberSelectOptions.length > 0 ? (
              <Pressable
                onPress={() => setSenderPickerOpen(true)}
                style={[styles.filterChip, senderUserId ? styles.filterChipActive : null]}
              >
                <User size={13} color={senderUserId ? Z.primary : Z.sub} strokeWidth={2} />
                <Text
                  style={[styles.filterChipText, senderUserId ? styles.filterChipTextActive : null]}
                  numberOfLines={1}
                >
                  {selectedSenderLabel}
                </Text>
              </Pressable>
            ) : (
              <View style={[styles.filterChip, styles.filterChipDisabled]}>
                <User size={13} color={Z.sub} strokeWidth={2} />
                <Text style={styles.filterChipText}>Người gửi</Text>
              </View>
            )}

            <View style={[styles.filterChip, dateFilter ? styles.filterChipActive : null]}>
              <Pressable
                onPress={() => {
                  if (Platform.OS === "android") openAndroidDatePicker();
                  else setIosDatePickerOpen(true);
                }}
                style={styles.filterChipInner}
              >
                <Calendar size={13} color={dateFilter ? Z.primary : Z.sub} strokeWidth={2} />
                <Text
                  style={[styles.filterChipText, dateFilter ? styles.filterChipTextActive : null]}
                >
                  {dateFilter ? formatDateFilterLabel(dateFilter) : "Chọn ngày"}
                </Text>
              </Pressable>
              {dateFilter ? (
                <Pressable onPress={() => setDateFilter("")} hitSlop={6} style={styles.filterClear}>
                  <X size={14} color={Z.sub} strokeWidth={2.5} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {Platform.OS === "ios" && iosDatePickerOpen ? (
            <View style={styles.datePickerWrap}>
              <DateTimePicker
                value={
                  dateFilter
                    ? (() => {
                        const [y, mo, d] = dateFilter.split("-").map(Number);
                        return new Date(y, mo - 1, d);
                      })()
                    : new Date()
                }
                mode="date"
                display="inline"
                onChange={(_, selectedDate) => {
                  if (selectedDate) setDateFilter(toLocalDateKey(selectedDate));
                }}
              />
              <Pressable onPress={() => setIosDatePickerOpen(false)} style={styles.datePickerDone}>
                <Text style={styles.datePickerDoneText}>Xong</Text>
              </Pressable>
            </View>
          ) : null}

          {browseError ? <Text style={styles.browseError}>{browseError}</Text> : null}
        </View>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {!hasActiveFilter ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconBox}>
                <Search size={44} color={Z.primary} strokeWidth={1.25} />
              </View>
              <Text style={styles.emptyHint}>
                Chọn thành viên hoặc ngày để xem tin; có thể thêm từ khóa để thu hẹp.
              </Text>
              {conversationTitle?.trim() ? (
                <View style={styles.convBadge}>
                  <Text style={styles.convBadgeText} numberOfLines={1}>
                    {conversationTitle.trim()}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : totalHits === 0 && !browseLoading ? (
            <View style={styles.emptyWrap}>
              <Search size={36} color={Z.sub} strokeWidth={1.5} />
              <Text style={[styles.emptyHint, { marginTop: 12, fontWeight: "600", color: Z.text }]}>
                Không tìm thấy kết quả
              </Text>
              <Text style={[styles.emptyHint, { marginTop: 6, fontSize: 12 }]}>
                Thử từ khóa khác hoặc cuộn lịch sử để tải thêm tin.
              </Text>
            </View>
          ) : (
            <>
              {browseLoading ? (
                <View className="flex-row items-center justify-center gap-2 py-3">
                  <ActivityIndicator size="small" color={PRIMARY} />
                  <Text className="text-[12px] font-medium text-muted-foreground">
                    Đang tải tin từ máy chủ theo bộ lọc…
                  </Text>
                </View>
              ) : null}

              <View className="mb-6">
                <Text className="mb-2 px-1 text-[13px] font-bold text-foreground">
                  Tin nhắn (trong hội thoại hiện tại)
                </Text>
                {messageHits.length === 0 ? (
                  <Text className="py-4 text-center text-[13px] text-muted-foreground">
                    Không có tin nhắn khớp.
                  </Text>
                ) : (
                  <>
                    <View style={styles.messageCardList}>
                      {shownMessages.map((m) => (
                        <ConversationSearchMessageRow
                          key={m.messageId}
                          message={m}
                          currentUserId={currentUserId ?? ""}
                          senderLabel={senderLabelFor(m)}
                          avatarUri={avatarBySenderId[m.senderId] ?? null}
                          timeLabel={formatZaloConversationTime(m.createdAt)}
                          needle={needleForUi}
                          onPress={() => jump(m.messageId)}
                        />
                      ))}
                    </View>
                    {hasMoreMsg ? (
                      <Pressable
                        onPress={() => setMsgLimit((n) => n + INITIAL_MSG_LIMIT)}
                        className="mt-2 rounded-xl border border-border bg-muted/30 py-2.5"
                      >
                        <Text className="text-center text-[13px] font-semibold text-foreground">
                          Xem thêm
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>

              <View>
                <Text className="mb-2 px-1 text-[13px] font-bold text-foreground">File</Text>
                {fileHits.length === 0 ? (
                  <Text className="py-4 text-center text-[13px] text-muted-foreground">
                    Không có file khớp.
                  </Text>
                ) : (
                  <>
                    {shownFiles.map((m) => {
                      const isMe = m.senderId === currentUserId;
                      const who = isMe
                        ? "Bạn"
                        : m.senderDisplayName?.trim() || m.senderId || "Thành viên";
                      const { fileName, mimeType } = resolveChatFileBubbleMeta(m);
                      const sizeStr = formatFileSize(m.mediaSize ?? null);
                      const dateStr = m.createdAt
                        ? new Date(m.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "";
                      return (
                        <View key={m.messageId} style={{ marginBottom: 8 }}>
                          <ChatSharedFileRow
                            fileName={fileName}
                            mimeType={mimeType}
                            metaLine={[sizeStr, who, dateStr].filter(Boolean).join(" · ")}
                            onPress={() => jump(m.messageId)}
                          />
                        </View>
                      );
                    })}
                    {hasMoreFile ? (
                      <Pressable
                        onPress={() => setFileLimit((n) => n + INITIAL_FILE_LIMIT)}
                        className="mt-2 rounded-xl border border-border bg-muted/30 py-2.5"
                      >
                        <Text className="text-center text-[13px] font-semibold text-foreground">
                          Xem thêm
                        </Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={senderPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSenderPickerOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSenderPickerOpen(false)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Người gửi</Text>
            <ScrollView style={styles.sheetList}>
              <Pressable
                onPress={() => {
                  setSenderUserId("");
                  setSenderPickerOpen(false);
                }}
                style={styles.sheetRow}
              >
                <Text style={[styles.sheetRowText, !senderUserId && styles.sheetRowTextActive]}>
                  Tất cả
                </Text>
              </Pressable>
              {memberSelectOptions.map((opt) => (
                <Pressable
                  key={opt.userId}
                  onPress={() => {
                    setSenderUserId(opt.userId);
                    setSenderPickerOpen(false);
                  }}
                  style={styles.sheetRow}
                >
                  <Text
                    style={[
                      styles.sheetRowText,
                      senderUserId === opt.userId && styles.sheetRowTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Z.bg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.border,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: Z.text,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.border,
    backgroundColor: Z.bg,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 46,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Z.primaryBorder,
    backgroundColor: Z.subBg,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Z.text,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    paddingRight: 4,
  },
  clearBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Z.primary,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Z.sub,
    marginRight: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 150,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Z.border,
    backgroundColor: Z.subBg,
    gap: 5,
  },
  filterChipActive: {
    borderColor: Z.primaryBorder,
    backgroundColor: Z.primarySoft,
  },
  filterChipDisabled: {
    opacity: 0.55,
  },
  filterChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: Z.text,
  },
  filterChipTextActive: {
    color: Z.primary,
    fontWeight: "600",
  },
  filterClear: {
    marginLeft: 2,
    padding: 4,
  },
  datePickerWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Z.border,
    overflow: "hidden",
    backgroundColor: Z.bg,
  },
  datePickerDone: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.border,
    paddingVertical: 10,
  },
  datePickerDoneText: {
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
    color: Z.primary,
  },
  browseError: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "500",
    color: "#B45309",
  },
  scroll: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 28,
    flexGrow: 1,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
    minHeight: 320,
  },
  emptyIconBox: {
    width: 96,
    height: 96,
    borderRadius: 20,
    backgroundColor: Z.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyHint: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
    color: Z.sub,
    maxWidth: 300,
  },
  convBadge: {
    marginTop: 16,
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Z.subBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Z.border,
  },
  convBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: Z.text,
    textAlign: "center",
  },
  messageCardList: {
    gap: 8,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheetCard: {
    maxHeight: "70%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: Z.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  sheetTitle: {
    marginBottom: 12,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: Z.text,
  },
  sheetList: {
    maxHeight: 360,
  },
  sheetRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Z.border,
  },
  sheetRowText: {
    fontSize: 15,
    color: Z.text,
  },
  sheetRowTextActive: {
    fontWeight: "700",
    color: Z.primary,
  },
});
