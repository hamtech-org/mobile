import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Search, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import type { GroupJoinLinkModalData } from "@/contexts/GroupJoinLinkModalContext";
import { useShareGroupJoinLink } from "@/hooks/useShareGroupJoinLink";
import { useGetFriendsQuery } from "@/store/api/userApi";
import { useGetConversationsQuery } from "@/store/api/chatApi";
import type { IConversation } from "@/types/chat.types";

const Z = { primary: "#0068FF", line: "#E2E8F0", sub: "#64748B" };

type ShareTab = "all" | "groups" | "friends";

type Props = {
  open: boolean;
  onClose: () => void;
  link: GroupJoinLinkModalData | null;
  excludeConversationId?: string | null;
};

type FriendRow = { userId: string; displayName: string; avatar?: string | null };

function sortRecent(convs: IConversation[]) {
  return [...convs].sort((a, b) => {
    const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/** Chỉ lấy người đã kết bạn (accepted / friend) từ GET /contacts/friends. */
function parseAcceptedFriends(data: unknown): FriendRow[] {
  if (!data) return [];
  let raw: unknown[] = [];
  if (Array.isArray(data)) {
    raw = data;
  } else if (typeof data === "object") {
    const o = data as { friends?: unknown };
    if (Array.isArray(o.friends)) raw = o.friends;
  }
  return (
    raw
      .map((item) => {
        const f = item as {
          userId?: string;
          friendId?: string;
          displayName?: string;
          avatar?: string | null;
          contactStatus?: string;
          status?: string;
        };
        const userId = f.userId ?? f.friendId;
        if (!userId) return null;
        if (f.contactStatus && f.contactStatus !== "accepted" && f.contactStatus !== "friend") {
          return null;
        }
        return {
          userId,
          displayName: f.displayName ?? userId,
          avatar: f.avatar ?? null,
        };
      })
      .filter((row) => row !== null) as FriendRow[]
  ).sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
}

export function ShareGroupJoinLinkPickerModal({
  open,
  onClose,
  link,
  excludeConversationId,
}: Props) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<ShareTab>("all");
  const [selectedConvIds, setSelectedConvIds] = useState<Set<string>>(new Set());
  const [selectedFriendIds, setSelectedFriendIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const { data: conversations, isLoading: loadingConvs } = useGetConversationsQuery(undefined, {
    skip: !open,
  });
  const { data: friendsRes, isLoading: loadingFriends } = useGetFriendsQuery(undefined, {
    skip: !open,
  });
  const { shareToMany } = useShareGroupJoinLink();

  const convList = useMemo(
    () => (conversations ?? []).filter((c) => c.conversationId !== excludeConversationId),
    [conversations, excludeConversationId],
  );

  // userApi.getFriends đã unwrap `data` → friendsRes là mảng bạn bè.
  const friends = useMemo(() => parseAcceptedFriends(friendsRes), [friendsRes]);

  const directByFriend = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of convList) {
      if (c.type === "direct" && c.otherUserId) m.set(c.otherUserId, c.conversationId);
    }
    return m;
  }, [convList]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setTab("all");
    setSelectedConvIds(new Set());
    setSelectedFriendIds(new Set());
  }, [open]);

  const hasSearch = q.trim().length > 0;

  const groupConvs = useMemo(
    () => sortRecent(convList.filter((c) => c.type === "group")),
    [convList],
  );

  const filteredGroups = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return groupConvs;
    return groupConvs.filter((c) => (c.name ?? "").toLowerCase().includes(s));
  }, [groupConvs, q]);

  const filteredFriends = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return friends;
    return friends.filter((f) => f.displayName.toLowerCase().includes(s));
  }, [friends, q]);

  type ListItem =
    | { kind: "header"; key: string; title: string }
    | { kind: "group"; key: string; conv: IConversation }
    | { kind: "friend"; key: string; friend: FriendRow };

  const listItems = useMemo((): ListItem[] => {
    if (hasSearch || tab === "all") {
      const items: ListItem[] = [];
      if (filteredGroups.length > 0) {
        items.push({ kind: "header", key: "hdr-groups", title: "Nhóm chat" });
        for (const c of filteredGroups) {
          items.push({ kind: "group", key: c.conversationId, conv: c });
        }
      }
      if (filteredFriends.length > 0) {
        items.push({ kind: "header", key: "hdr-friends", title: "Bạn bè" });
        for (const f of filteredFriends) {
          items.push({ kind: "friend", key: f.userId, friend: f });
        }
      }
      return items;
    }
    if (tab === "friends") {
      return filteredFriends.map((f) => ({ kind: "friend" as const, key: f.userId, friend: f }));
    }
    return filteredGroups.map((c) => ({ kind: "group" as const, key: c.conversationId, conv: c }));
  }, [filteredFriends, filteredGroups, hasSearch, tab]);

  const selectedCount = selectedConvIds.size + selectedFriendIds.size;

  const handleSend = async () => {
    if (!link || selectedCount === 0) return;
    setSubmitting(true);
    try {
      const convFromFriends: string[] = [];
      const friendOnly: string[] = [];
      for (const fid of selectedFriendIds) {
        const ex = directByFriend.get(fid);
        if (ex) convFromFriends.push(ex);
        else friendOnly.push(fid);
      }
      const conversationIds = [...new Set([...selectedConvIds, ...convFromFriends])];
      await shareToMany({ conversationIds, friendIds: friendOnly }, link);
      onClose();
    } catch {
      /* toast in hook */
    } finally {
      setSubmitting(false);
    }
  };

  const toggleConv = useCallback((id: string) => {
    setSelectedConvIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleFriend = useCallback((id: string) => {
    setSelectedFriendIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const loading = loadingConvs || loadingFriends;

  return (
    <Modal visible={open && Boolean(link)} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Chia sẻ link nhóm</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color="#334155" />
          </Pressable>
        </View>

        {link ? (
          <Text style={styles.sub} numberOfLines={1}>
            Gửi link mời: <Text style={styles.subBold}>{link.groupName}</Text>
          </Text>
        ) : null}

        <View style={styles.searchWrap}>
          <Search size={18} color={Z.sub} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Tìm bạn bè hoặc nhóm..."
            placeholderTextColor={Z.sub}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.tabs}>
          {(
            [
              { id: "all" as const, label: "Tất cả" },
              { id: "groups" as const, label: "Nhóm chat" },
              { id: "friends" as const, label: "Bạn bè" },
            ] as const
          ).map((t) => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tabBtn}>
              <Text style={[styles.tabText, tab === t.id ? styles.tabTextOn : null]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={Z.primary} />
        ) : (
          <FlatList
            data={listItems}
            keyExtractor={(item) => item.key}
            contentContainerStyle={{ paddingBottom: 16 }}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {hasSearch
                  ? "Không tìm thấy kết quả."
                  : tab === "friends"
                    ? "Chưa có bạn bè để chia sẻ."
                    : tab === "groups"
                      ? "Không có nhóm chat để chia sẻ."
                      : "Chưa có nhóm hoặc bạn bè để chia sẻ."}
              </Text>
            }
            renderItem={({ item }) => {
              if (item.kind === "header") {
                return <Text style={styles.sectionHeader}>{item.title}</Text>;
              }
              if (item.kind === "friend") {
                const f = item.friend;
                const on = selectedFriendIds.has(f.userId);
                return (
                  <Pressable style={styles.row} onPress={() => toggleFriend(f.userId)}>
                    <View style={[styles.check, on ? styles.checkOn : null]}>
                      {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                    </View>
                    <Avatar uri={f.avatar || undefined} name={f.displayName} size="sm" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {f.displayName}
                      </Text>
                      <Text style={styles.rowSub}>
                        {directByFriend.has(f.userId) ? "Chat 1-1" : "Sẽ mở chat mới"}
                      </Text>
                    </View>
                  </Pressable>
                );
              }
              const c = item.conv;
              const on = selectedConvIds.has(c.conversationId);
              return (
                <Pressable style={styles.row} onPress={() => toggleConv(c.conversationId)}>
                  <View style={[styles.check, on ? styles.checkOn : null]}>
                    {on ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                  </View>
                  <View style={styles.iconWrap}>
                    <Users size={18} color={Z.primary} />
                  </View>
                  <Text style={[styles.rowTitle, { flex: 1, marginLeft: 12 }]} numberOfLines={1}>
                    {c.name ?? "Hội thoại"}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}

        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
            <Text style={styles.cancelText}>Hủy</Text>
          </Pressable>
          <Pressable
            style={[styles.sendBtn, (submitting || selectedCount === 0) && { opacity: 0.45 }]}
            onPress={() => void handleSend()}
            disabled={submitting || selectedCount === 0}
          >
            <Text style={styles.sendText}>
              {submitting ? "Đang gửi…" : `Gửi${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff", paddingTop: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  sub: { fontSize: 13, color: Z.sub, paddingHorizontal: 16, marginBottom: 8 },
  subBold: { fontWeight: "600", color: "#334155" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#0f172a" },
  tabs: { flexDirection: "row", paddingHorizontal: 12, marginBottom: 4 },
  tabBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: "600", color: Z.sub },
  tabTextOn: { color: Z.primary },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: Z.sub,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: Z.primary, borderColor: Z.primary },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  rowSub: { fontSize: 12, color: Z.sub, marginTop: 2 },
  empty: { textAlign: "center", color: Z.sub, marginTop: 32, paddingHorizontal: 16 },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Z.line,
  },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: "600", color: "#475569" },
  sendBtn: {
    backgroundColor: Z.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
