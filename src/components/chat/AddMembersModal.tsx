import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Link2, Search, Share2, UserPlus, X } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import type { FriendListItem } from "@/store/api/userApi";

const C = {
  bg: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  line: "rgba(0,0,0,0.06)",
  primary: "#0068FF",
};

export type AddMembersModalProps = {
  visible: boolean;
  onClose: () => void;
  friends: FriendListItem[];
  isLoadingFriends?: boolean;
  existingMemberIds: string[];
  selectedIds: Set<string>;
  onToggleSelect: (userId: string) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
  showJoinLinkActions?: boolean;
  onOpenJoinLink?: () => void;
  onShareJoinLink?: () => void;
};

function friendSubtitle(friend: FriendListItem, isInGroup: boolean): string {
  if (isInGroup) return "Đã tham gia";
  return String(friend.email ?? friend.phone ?? "").trim();
}

function matchesFriendSearch(friend: FriendListItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [friend.displayName, friend.email, friend.phone]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q) || String(v).includes(query));
}

/** Modal thêm thành viên — đồng bộ web `AddMembersModal`. */
export function AddMembersModal({
  visible,
  onClose,
  friends,
  isLoadingFriends = false,
  existingMemberIds,
  selectedIds,
  onToggleSelect,
  onConfirm,
  isSubmitting = false,
  showJoinLinkActions = false,
  onOpenJoinLink,
  onShareJoinLink,
}: AddMembersModalProps): ReactElement {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  const memberSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return friends.filter((f) => matchesFriendSearch(f, q));
  }, [friends, query]);

  const rows = useMemo(() => {
    const notInGroup: FriendListItem[] = [];
    const inGroup: FriendListItem[] = [];
    for (const f of filtered) {
      if (memberSet.has(f.userId)) inGroup.push(f);
      else notInGroup.push(f);
    }
    return [...notInGroup, ...inGroup];
  }, [filtered, memberSet]);

  const selectedCount = selectedIds.size;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thêm thành viên</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityLabel="Đóng"
            >
              <X size={20} color={C.sub} strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.toolbar}>
            {showJoinLinkActions && (onOpenJoinLink || onShareJoinLink) ? (
              <View style={styles.linkRow}>
                {onOpenJoinLink ? (
                  <Pressable
                    style={styles.linkBtn}
                    onPress={onOpenJoinLink}
                    disabled={isSubmitting}
                  >
                    <Link2 size={16} color={C.primary} strokeWidth={2} />
                    <Text style={styles.linkBtnText}>Link nhóm</Text>
                  </Pressable>
                ) : null}
                {onShareJoinLink ? (
                  <Pressable
                    style={styles.linkBtn}
                    onPress={onShareJoinLink}
                    disabled={isSubmitting}
                  >
                    <Share2 size={16} color={C.primary} strokeWidth={2} />
                    <Text style={styles.linkBtnText}>Chia sẻ link</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.searchWrap}>
              <Search size={16} color={C.sub} strokeWidth={2} style={styles.searchIcon} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Tìm kiếm người dùng"
                placeholderTextColor={C.sub}
                style={styles.searchInput}
                editable={!isSubmitting}
              />
            </View>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {isLoadingFriends ? (
              <Text style={styles.emptyText}>Đang tải danh sách...</Text>
            ) : rows.length === 0 ? (
              <Text style={styles.emptyText}>
                {friends.length === 0 ? "Chưa có bạn bè để thêm" : "Không có người dùng phù hợp"}
              </Text>
            ) : (
              rows.map((friend) => {
                const isInGroup = memberSet.has(friend.userId);
                const selected = selectedIds.has(friend.userId);
                const sub = friendSubtitle(friend, isInGroup);
                return (
                  <Pressable
                    key={friend.userId}
                    style={[styles.row, isInGroup ? styles.rowInGroup : null]}
                    onPress={() => {
                      if (!isInGroup && !isSubmitting) onToggleSelect(friend.userId);
                    }}
                    disabled={isInGroup || isSubmitting}
                  >
                    {isInGroup ? (
                      <View style={styles.checkInGroup}>
                        <Check size={14} color="#fff" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={[styles.checkOuter, selected && styles.checkOuterOn]}>
                        {selected ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                      </View>
                    )}
                    <Avatar uri={friend.avatar || undefined} name={friend.displayName} size="sm" />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {friend.displayName || friend.userId}
                      </Text>
                      {sub ? (
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {sub}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.footerCount}>Đã chọn {selectedCount} người</Text>
            <Pressable
              style={[
                styles.confirmBtn,
                (selectedCount === 0 || isSubmitting) && styles.confirmBtnDisabled,
              ]}
              onPress={onConfirm}
              disabled={selectedCount === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.confirmBtnText}>Đang thêm...</Text>
                </>
              ) : (
                <>
                  <UserPlus size={16} color="#fff" strokeWidth={2.25} />
                  <Text style={styles.confirmBtnText}>Thêm vào nhóm</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "88%",
    backgroundColor: C.bg,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: C.text },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolbar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  linkRow: { flexDirection: "row", gap: 8 },
  linkBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,104,255,0.3)",
    backgroundColor: "rgba(240,249,255,0.9)",
  },
  linkBtnText: { fontSize: 14, fontWeight: "600", color: C.primary },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    paddingVertical: 10,
  },
  list: { flexGrow: 0, flexShrink: 1 },
  listContent: { paddingHorizontal: 20, paddingVertical: 16, gap: 4 },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    color: C.sub,
    paddingVertical: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  rowInGroup: { opacity: 0.8 },
  checkInGroup: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkOuterOn: {
    borderColor: C.primary,
    backgroundColor: C.primary,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: "600", color: C.text },
  rowSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
  },
  footerCount: { fontSize: 14, color: C.sub, flex: 1 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2563EB",
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
