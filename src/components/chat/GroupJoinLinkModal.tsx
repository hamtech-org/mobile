import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { ArrowLeft, Copy, Download, Share2, Users } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";

import { Avatar } from "@/components/common/Avatar";
import type { GroupJoinLinkModalData } from "@/contexts/GroupJoinLinkModalContext";
import { useAppSelector } from "@/hooks/useAppStore";
import {
  useGetGroupJoinPreviewQuery,
  useJoinGroupViaLinkMutation,
} from "@/store/api/endpoints/joinApi";
import { useGetConversationsQuery } from "@/store/api/chatApi";
import { useGroupJoinLinkModal } from "@/contexts/GroupJoinLinkModalContext";
import { toast } from "@/utils/appToast";

const PRIMARY = "#0068FF";

type QrSvgRef = { toDataURL: (callback: (dataUrl: string) => void) => void };

async function ensureMediaLibraryPermission(): Promise<boolean> {
  const current = await MediaLibrary.getPermissionsAsync();
  if (current.granted) return true;
  const req = await MediaLibrary.requestPermissionsAsync();
  return req.granted;
}

type Props = {
  open: boolean;
  data: GroupJoinLinkModalData | null;
  onClose: () => void;
};

export function GroupJoinLinkModal({ open, data, onClose }: Props) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const { openShareGroupJoinLinkPicker } = useGroupJoinLinkModal();
  const qrRef = useRef<QrSvgRef | null>(null);
  const suffix = data?.suffix ?? "";
  const joinUrl = data?.url ?? "";

  const { data: preview, isLoading: previewLoading } = useGetGroupJoinPreviewQuery(suffix, {
    skip: !open || !suffix,
  });
  const { data: conversations = [] } = useGetConversationsQuery(undefined, {
    skip: !open,
  });
  const [joinViaLink, { isLoading: joining }] = useJoinGroupViaLinkMutation();
  const conversationIdForChat = preview?.conversationId ?? data?.conversationId;
  const liveConversation = conversations.find((c) => c.conversationId === conversationIdForChat);
  const groupName =
    liveConversation?.name?.trim() || data?.groupName || preview?.name || "Nhóm chat";
  const groupAvatar = liveConversation?.avatar ?? data?.groupAvatar ?? preview?.avatar;
  const currentData = data
    ? {
        ...data,
        groupName,
        groupAvatar,
        conversationId: conversationIdForChat ?? data.conversationId,
      }
    : null;
  const showMemberBanner = Boolean(preview && !previewLoading && preview.isMember);
  const showMemberCount = Boolean(preview && !previewLoading);

  const handleCopy = useCallback(async () => {
    if (!joinUrl) return;
    await Clipboard.setStringAsync(joinUrl);
    toast.success("Đã sao chép link");
  }, [joinUrl]);

  const handleShare = useCallback(() => {
    if (!currentData) return;
    openShareGroupJoinLinkPicker(currentData);
  }, [currentData, openShareGroupJoinLinkPicker]);

  const handleSaveQr = useCallback(() => {
    const svg = qrRef.current;
    if (!svg) return;
    svg.toDataURL(async (dataUrl) => {
      try {
        const base64 = dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;
        if (!base64) {
          toast.error("Không lưu được mã QR");
          return;
        }
        const filename = `hamtech-join-${suffix || "group"}.png`;
        const dest = `${FileSystem.cacheDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(dest, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!(await ensureMediaLibraryPermission())) {
          toast.error("Cần quyền truy cập thư viện ảnh để lưu mã QR");
          return;
        }
        await MediaLibrary.saveToLibraryAsync(dest);
        toast.success("Đã tải mã QR");
      } catch {
        toast.error("Không lưu được mã QR");
      }
    });
  }, [suffix]);

  const handleJoin = async () => {
    if (!suffix) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(`/join/${suffix}`)}`);
      return;
    }
    try {
      const result = await joinViaLink(suffix).unwrap();
      toast.success("Đã xử lý yêu cầu tham gia");
      onClose();
      if (result.status === "joined" || result.status === "already_member") {
        router.push(`/(main)/(chat)/${result.conversationId}`);
      }
    } catch (e: unknown) {
      const msg =
        (e as { data?: { error?: { message?: string } } })?.data?.error?.message ??
        "Không thể tham gia nhóm";
      toast.error(msg);
    }
  };

  const showJoinFooter =
    !previewLoading && Boolean(preview && !preview.isMember && preview.requestStatus !== "pending");
  const showOpenChatFooter = !previewLoading && Boolean(preview?.isMember && conversationIdForChat);
  const showFooter = showJoinFooter || showOpenChatFooter;

  return (
    <Modal visible={open && Boolean(data)} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
          <View className="flex-row items-center px-3 py-3" style={{ backgroundColor: PRIMARY }}>
            <Pressable onPress={onClose} className="p-2" accessibilityLabel="Quay lại">
              <ArrowLeft color="#fff" size={24} />
            </Pressable>
            <Text className="flex-1 pr-10 text-center text-[17px] font-bold text-white">
              Link nhóm
            </Text>
          </View>

          <View style={styles.scrollRegion}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {showMemberBanner ? (
                <Text className="mb-3 text-center text-[14px] text-slate-500">
                  Bạn đã là thành viên nhóm này.
                </Text>
              ) : null}

              <Avatar
                uri={groupAvatar || undefined}
                name={groupName}
                size="xl"
                isGroup
                groupConversationId={conversationIdForChat}
                cacheVersion={String(liveConversation?.memberCount ?? "")}
              />
              <Text className="mt-3 text-center text-[18px] font-bold text-slate-900">
                {groupName}
              </Text>

              {showMemberCount ? (
                <View className="mt-1.5 flex-row items-center justify-center gap-1.5">
                  <Users color="#64748b" size={16} />
                  <Text className="text-[14px] text-slate-500">
                    {preview?.memberCount ?? 0} thành viên
                  </Text>
                </View>
              ) : null}

              <Text className="mt-2 px-2 text-center text-[14px] leading-snug text-slate-500">
                Mời mọi người tham gia nhóm bằng mã QR hoặc link dưới đây:
              </Text>

              <View className="mt-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <QRCode
                  value={joinUrl}
                  size={148}
                  color="#0a1629"
                  backgroundColor="#ffffff"
                  ecl="M"
                  quietZone={8}
                  getRef={(c) => {
                    qrRef.current = c as QrSvgRef | null;
                  }}
                />
              </View>

              <View className="mt-4 w-full">
                <Pressable
                  onPress={() => void handleCopy()}
                  className="w-full rounded-xl border border-sky-100 bg-sky-50 px-4 py-3"
                >
                  <Text
                    className="text-center font-mono text-[13px]"
                    style={{ color: PRIMARY }}
                    numberOfLines={2}
                  >
                    {joinUrl}
                  </Text>
                </Pressable>
                <View className="mt-8 w-full flex-row justify-center gap-x-5 gap-y-3">
                  <ActionChip icon={Copy} label="Sao chép link" onPress={() => void handleCopy()} />
                  <ActionChip
                    icon={Share2}
                    label="Chia sẻ link"
                    onPress={() => void handleShare()}
                  />
                  <ActionChip
                    icon={Download}
                    label="Lưu mã QR"
                    onPress={() => void handleSaveQr()}
                  />
                </View>
              </View>

              {previewLoading ? <ActivityIndicator className="mt-6" color={PRIMARY} /> : null}
            </ScrollView>
          </View>

          {showFooter ? (
            <View style={styles.footer}>
              {showJoinFooter ? (
                <Pressable
                  onPress={() => void handleJoin()}
                  disabled={joining}
                  className="w-full items-center rounded-xl py-3"
                  style={{ backgroundColor: PRIMARY, opacity: joining ? 0.6 : 1 }}
                >
                  <Text className="text-[15px] font-bold text-white">
                    {joining ? "Đang xử lý…" : "Tham gia nhóm"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    onClose();
                    router.push(`/(main)/(chat)/${conversationIdForChat}`);
                  }}
                  className="w-full items-center rounded-xl border border-slate-200 py-3"
                >
                  <Text className="text-[15px] font-semibold text-slate-800">Mở nhóm chat</Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: "#fff" },
  safe: { flex: 1, backgroundColor: "#fff" },
  scrollRegion: { flex: 1, minHeight: 0 },
  scroll: { flex: 1 },
  scrollContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
});

function ActionChip({
  icon: Icon,
  label,
  onPress,
}: {
  icon: typeof Copy;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="w-[88px] items-center">
      <View className="mb-2 h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon color={PRIMARY} size={24} />
      </View>
      <Text className="text-center text-[12px] leading-tight text-slate-600">{label}</Text>
    </Pressable>
  );
}
