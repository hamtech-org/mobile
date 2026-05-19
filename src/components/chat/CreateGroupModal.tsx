import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera, Check, Search, User, Users, X } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useAppSelector } from "@/hooks/useAppStore";
import { useCreateConversationMutation } from "@/store/api/chatApi";
import { useGetFriendsQuery, type FriendListItem } from "@/store/api/userApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { toast } from "@/utils/appToast";

const C = {
  bg: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  line: "rgba(0,0,0,0.06)",
  primary: "#0068FF",
};

const MIN_FRIENDS_TO_CREATE = 2;

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
}

function friendSubtitle(friend: FriendListItem): string {
  return String(friend.email ?? friend.phone ?? "").trim();
}

function matchesFriendSearch(friend: FriendListItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [friend.displayName, friend.email, friend.phone]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q) || String(v).includes(query));
}

/** Modal tạo nhóm — đồng bộ web `CreateGroupModal`. */
export function CreateGroupModal({ visible, onClose }: CreateGroupModalProps): ReactElement {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!visible) {
      setName("");
      setAvatarUrl(null);
      setSelectedIds(new Set());
      setSearchTerm("");
    }
  }, [visible]);

  const {
    data: friends = [],
    isFetching: loadingFriends,
    isError: friendsError,
  } = useGetFriendsQuery(undefined, {
    skip: !visible,
  });

  const filteredFriends = useMemo(() => {
    const q = searchTerm.trim();
    return friends.filter((f) => {
      if (currentUserId && f.userId === currentUserId) return false;
      return matchesFriendSearch(f, q);
    });
  }, [friends, searchTerm, currentUserId]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(userId)) n.delete(userId);
      else n.add(userId);
      return n;
    });
  }, []);

  const [createConv, { isLoading: creating }] = useCreateConversationMutation();
  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation();

  const pickAvatar = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast.error("Cần quyền thư viện ảnh");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    try {
      const file = await prepareLocalFileForUpload({
        uri: asset.uri,
        name: asset.fileName ?? "group.jpg",
        mimeType: asset.mimeType ?? "image/jpeg",
      });
      const up = await uploadMedia({
        file: { uri: file.uri, name: file.name, type: file.type },
        mediaType: "image",
      }).unwrap();
      const url = up.url?.trim();
      if (url) setAvatarUrl(url);
    } catch {
      toast.error("Không tải được ảnh");
    }
  }, [uploadMedia]);

  const handleSubmit = useCallback(async () => {
    const memberIds = [...selectedIds];
    if (memberIds.length < MIN_FRIENDS_TO_CREATE) {
      toast.info("Vui lòng chọn ít nhất 2 người để tạo nhóm (cần tối thiểu 3 thành viên)");
      return;
    }
    const trimmed = name.trim();
    const groupName = trimmed || `Nhóm (${memberIds.length + 1} thành viên)`;
    try {
      const body: {
        type: "group";
        name: string;
        memberIds: string[];
        avatar?: string;
      } = {
        type: "group",
        name: groupName,
        memberIds,
      };
      if (avatarUrl) body.avatar = avatarUrl;
      const res = await createConv(body).unwrap();
      const conv = res.data;
      const id = conv?.conversationId;
      if (!id) throw new Error("no id");
      toast.success("Đã tạo nhóm");
      onClose();
      router.replace(`/(main)/(chat)/${id}`);
    } catch {
      toast.error("Không tạo được nhóm. Thử lại sau.");
    }
  }, [avatarUrl, createConv, name, onClose, selectedIds]);

  const busy = creating || uploading;
  const selectedCount = selectedIds.size;
  const canCreate = selectedCount >= MIN_FRIENDS_TO_CREATE && !busy;

  const handleCreatePress = useCallback(() => {
    if (canCreate) {
      void handleSubmit();
      return;
    }
    if (selectedCount < MIN_FRIENDS_TO_CREATE) {
      toast.info("Vui lòng chọn ít nhất 2 người để tạo nhóm (cần tối thiểu 3 thành viên)");
    }
  }, [canCreate, handleSubmit, selectedCount]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tạo nhóm trò chuyện</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              accessibilityLabel="Đóng"
            >
              <X size={20} color={C.sub} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.nameRow}>
              <Pressable
                onPress={() => void pickAvatar()}
                disabled={busy}
                style={styles.avatarDashed}
                accessibilityLabel="Chọn ảnh nhóm"
              >
                {avatarUrl ? (
                  <Avatar uri={avatarUrl} name={name || "Nhóm"} size="md" isGroup />
                ) : (
                  <Camera size={20} color={C.sub} strokeWidth={1.75} />
                )}
              </Pressable>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nhập tên nhóm..."
                placeholderTextColor={C.sub}
                style={styles.nameInput}
                editable={!busy}
              />
            </View>

            <View style={styles.searchWrap}>
              <Search size={16} color={C.sub} strokeWidth={2} style={styles.searchIcon} />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Tìm tên hoặc số điện thoại..."
                placeholderTextColor={C.sub}
                style={styles.searchInput}
                editable={!busy}
              />
            </View>

            <View style={styles.friendCard}>
              <View style={styles.friendCardHead}>
                <Text style={styles.friendCardHeadText}>
                  Danh sách bạn bè ({filteredFriends.length})
                </Text>
              </View>
              {loadingFriends ? (
                <View style={styles.friendCardEmpty}>
                  <ActivityIndicator color={C.primary} size="small" />
                </View>
              ) : friendsError ? (
                <Text style={styles.friendCardEmptyText}>Lỗi tải danh sách bạn bè</Text>
              ) : filteredFriends.length === 0 ? (
                <Text style={styles.friendCardEmptyText}>
                  {searchTerm.trim() ? "Không tìm thấy bạn bè" : "Chưa có bạn bè"}
                </Text>
              ) : (
                filteredFriends.map((friend, idx) => {
                  const selected = selectedIds.has(friend.userId);
                  const isLast = idx === filteredFriends.length - 1;
                  const sub = friendSubtitle(friend);
                  return (
                    <Pressable
                      key={friend.userId}
                      style={[styles.friendRow, !isLast && styles.friendRowBorder]}
                      onPress={() => toggleMember(friend.userId)}
                      disabled={busy}
                    >
                      <View style={styles.checkWrap}>
                        <View style={[styles.checkOuter, selected && styles.checkOuterOn]}>
                          {selected ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
                        </View>
                      </View>
                      <View style={styles.friendAvatarWrap}>
                        {friend.avatar ? (
                          <Avatar uri={friend.avatar} name={friend.displayName} size="sm" />
                        ) : (
                          <View style={styles.friendAvatarFallback}>
                            <User size={18} color="#fff" strokeWidth={2} />
                          </View>
                        )}
                      </View>
                      <View style={styles.friendText}>
                        <Text style={styles.friendName} numberOfLines={1}>
                          {friend.displayName || "Unknown"}
                        </Text>
                        {sub ? (
                          <Text style={styles.friendSub} numberOfLines={1}>
                            {sub}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerCountCol}>
              <Text style={styles.footerCountLabel}>Đã chọn</Text>
              <Text style={styles.footerCountValue}>{selectedCount} liên hệ</Text>
            </View>
            <View style={styles.footerActions}>
              <Pressable style={styles.cancelBtn} onPress={onClose} disabled={busy}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
                onPress={handleCreatePress}
                disabled={busy}
              >
                {creating ? (
                  <ActivityIndicator color={canCreate ? "#fff" : C.sub} size="small" />
                ) : (
                  <Users
                    size={18}
                    color={canCreate ? "#fff" : "rgba(0,0,0,0.35)"}
                    strokeWidth={2}
                  />
                )}
                <Text style={[styles.createBtnText, !canCreate && styles.createBtnTextDisabled]}>
                  {creating ? "Đang tạo…" : "Tạo nhóm"}
                </Text>
              </Pressable>
            </View>
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
    maxWidth: 440,
    maxHeight: "85%",
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
  headerTitle: { fontSize: 17, fontWeight: "700", color: C.text, letterSpacing: -0.2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 20, gap: 24 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarDashed: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 4 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: C.text,
    paddingVertical: 10,
  },
  friendCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.line,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.bg,
  },
  friendCardHead: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  friendCardHeadText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.sub,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  friendCardEmpty: {
    paddingVertical: 32,
    alignItems: "center",
  },
  friendCardEmptyText: {
    textAlign: "center",
    fontSize: 13,
    color: C.sub,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  friendRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  checkWrap: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOuterOn: {
    borderColor: C.primary,
    backgroundColor: C.primary,
  },
  friendAvatarWrap: {},
  friendAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
  friendText: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 14, fontWeight: "600", color: C.text },
  friendSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    gap: 12,
  },
  footerCountCol: { flex: 1, minWidth: 0 },
  footerCountLabel: { fontSize: 13, fontWeight: "500", color: C.sub },
  footerCountValue: { fontSize: 15, fontWeight: "700", color: C.primary, marginTop: 2 },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: C.text },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.primary,
  },
  createBtnDisabled: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  createBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  createBtnTextDisabled: { color: "rgba(0,0,0,0.35)" },
});
