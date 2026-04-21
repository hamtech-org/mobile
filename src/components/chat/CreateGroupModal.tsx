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
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Camera, Check, ChevronLeft, Search, Users } from "lucide-react-native";

import { Avatar } from "@/components/common/Avatar";
import { useAppSelector } from "@/hooks/useAppStore";
import { useCreateConversationMutation } from "@/store/api/chatApi";
import { useGetFriendsQuery } from "@/store/api/userApi";
import { useUploadMediaMutation } from "@/store/api/mediaApi";
import { prepareLocalFileForUpload } from "@/utils/uploadAttachment";
import { toast } from "@/utils/appToast";

const C = {
  bg: "#FFFFFF",
  text: "#111827",
  sub: "#6B7280",
  border: "#E5E7EB",
  primary: "#0068FF",
  selectedBg: "#EFF6FF",
};

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ visible, onClose }: CreateGroupModalProps): ReactElement {
  const currentUserId = useAppSelector((s) => s.auth.user?.userId);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [friendFilter, setFriendFilter] = useState("");

  useEffect(() => {
    if (visible) {
      setName("");
      setAvatarUrl(null);
      setSelectedIds(new Set());
      setFriendFilter("");
    }
  }, [visible]);

  const { data: friends = [], isFetching: loadingFriends } = useGetFriendsQuery(undefined, {
    skip: !visible,
  });

  const pickableFriends = useMemo(() => {
    const q = friendFilter.trim().toLowerCase();
    return friends.filter((f) => {
      if (currentUserId && f.userId === currentUserId) return false;
      if (!q) return true;
      return f.displayName.toLowerCase().includes(q);
    });
  }, [friends, friendFilter, currentUserId]);

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
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
    const n = name.trim();
    if (!n) {
      toast.error("Vui lòng nhập tên nhóm");
      return;
    }
    const memberIds = [...selectedIds];
    if (memberIds.length === 0) {
      toast.error("Chọn ít nhất một bạn bè để thêm vào nhóm");
      return;
    }
    try {
      const body: {
        type: "group";
        name: string;
        memberIds: string[];
        avatar?: string;
      } = {
        type: "group",
        name: n,
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <ChevronLeft size={28} color={C.text} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.title}>Tạo nhóm</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.noticeBanner}>
          <Text style={styles.noticeBannerText}>
            Chọn thành viên từ danh sách bạn bè đã kết bạn — không nhập mã ID.
          </Text>
        </View>

        <ScrollView
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.avatarNameRow}>
            <Pressable onPress={() => void pickAvatar()} disabled={busy} style={styles.avatarWrap}>
              <Avatar uri={avatarUrl || undefined} name={name || "Nhóm"} size="lg" isGroup />
              <View style={styles.camBadge}>
                <Camera size={14} color="#fff" strokeWidth={2} />
              </View>
            </Pressable>
            <View style={styles.nameBlock}>
              <Text style={styles.label}>Tên nhóm</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ví dụ: Nhóm dự án"
                placeholderTextColor={C.sub}
                style={styles.inputInline}
                editable={!busy}
              />
              <Text style={styles.hintSmall}>Chạm ảnh để đổi avatar nhóm (tuỳ chọn)</Text>
            </View>
          </View>

          <View style={[styles.rowIcon, { marginTop: 18 }]}>
            <Users size={20} color={C.primary} strokeWidth={2} />
            <Text style={styles.label}>Thành viên — chọn từ bạn bè</Text>
          </View>
          <Text style={styles.help}>Chạm tên để chọn / bỏ chọn. Bạn sẽ là trưởng nhóm.</Text>

          <View style={styles.searchRow}>
            <Search size={18} color={C.sub} strokeWidth={2} />
            <TextInput
              value={friendFilter}
              onChangeText={setFriendFilter}
              placeholder="Tìm theo tên..."
              placeholderTextColor={C.sub}
              style={styles.searchInput}
              editable={!busy}
            />
          </View>

          {loadingFriends ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={C.primary} />
          ) : pickableFriends.length === 0 ? (
            <Text style={[styles.help, { marginTop: 8 }]}>
              {friends.length === 0
                ? "Chưa có bạn bè trong danh sách. Hãy kết bạn trước khi tạo nhóm."
                : "Không tìm thấy bạn phù hợp."}
            </Text>
          ) : (
            <View style={styles.friendList}>
              {pickableFriends.map((f) => {
                const on = selectedIds.has(f.userId);
                return (
                  <Pressable
                    key={f.userId}
                    onPress={() => toggleId(f.userId)}
                    disabled={busy}
                    style={[styles.friendRow, on && styles.friendRowOn]}
                  >
                    <Avatar uri={f.avatar || undefined} name={f.displayName} size="sm" />
                    <Text style={styles.friendName} numberOfLines={1}>
                      {f.displayName}
                    </Text>
                    <View style={[styles.checkBox, on && styles.checkBoxOn]}>
                      {on ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable style={styles.primaryBtn} onPress={() => void handleSubmit()} disabled={busy}>
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Tạo nhóm</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 17, fontWeight: "700", color: C.text },
  noticeBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  noticeBannerText: { fontSize: 13, color: "#1E40AF", fontWeight: "600", lineHeight: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  avatarNameRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 8 },
  avatarWrap: { position: "relative" },
  camBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    backgroundColor: C.primary,
    borderRadius: 12,
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameBlock: { flex: 1, minWidth: 0 },
  inputInline: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: C.text,
    backgroundColor: "#FAFAFA",
    marginTop: 6,
  },
  hintSmall: { marginTop: 6, fontSize: 12, color: C.sub },
  rowIcon: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "600", color: C.text },
  help: { fontSize: 12, color: C.sub, marginBottom: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FAFAFA",
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 2 },
  friendList: { borderWidth: 1, borderColor: C.border, borderRadius: 12, overflow: "hidden" },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    backgroundColor: "#fff",
  },
  friendRowOn: { backgroundColor: C.selectedBg },
  friendName: { flex: 1, fontSize: 15, fontWeight: "600", color: C.text },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkBoxOn: { backgroundColor: C.primary, borderColor: C.primary },
  primaryBtn: {
    backgroundColor: C.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
