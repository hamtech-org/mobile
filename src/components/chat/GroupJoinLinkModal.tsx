import { useCallback } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { ArrowLeft, Copy, Download, Share2 } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";

import { Avatar } from "@/components/common/Avatar";
import type { GroupJoinLinkModalData } from "@/contexts/GroupJoinLinkModalContext";
import { useAppSelector } from "@/hooks/useAppStore";
import {
  useGetGroupJoinPreviewQuery,
  useJoinGroupViaLinkMutation,
} from "@/store/api/endpoints/joinApi";
import { joinLinkMessageDomain } from "@/utils/groupJoinLinkMessage";
import { useGroupJoinLinkModal } from "@/contexts/GroupJoinLinkModalContext";
import { toast } from "@/utils/appToast";

const PRIMARY = "#0068FF";

type Props = {
  open: boolean;
  data: GroupJoinLinkModalData | null;
  onClose: () => void;
};

export function GroupJoinLinkModal({ open, data, onClose }: Props) {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const { openShareGroupJoinLinkPicker } = useGroupJoinLinkModal();
  const suffix = data?.suffix ?? "";
  const joinUrl = data?.url ?? "";

  const { data: preview, isLoading: previewLoading } = useGetGroupJoinPreviewQuery(suffix, {
    skip: !open || !suffix,
  });
  const [joinViaLink, { isLoading: joining }] = useJoinGroupViaLinkMutation();
  const groupName = data?.groupName ?? preview?.name ?? "Nhóm chat";
  const groupAvatar = data?.groupAvatar ?? preview?.avatar;
  const domain = joinLinkMessageDomain(joinUrl);

  const handleCopy = useCallback(async () => {
    if (!joinUrl) return;
    await Clipboard.setStringAsync(joinUrl);
    toast.success("Đã sao chép link");
  }, [joinUrl]);

  const handleShare = useCallback(() => {
    if (!data) return;
    openShareGroupJoinLinkPicker(data);
  }, [data, openShareGroupJoinLinkPicker]);

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

  return (
    <Modal visible={open && Boolean(data)} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-3 py-3" style={{ backgroundColor: PRIMARY }}>
          <Pressable onPress={onClose} className="p-2" accessibilityLabel="Quay lại">
            <ArrowLeft color="#fff" size={24} />
          </Pressable>
          <Text className="flex-1 pr-10 text-center text-[17px] font-bold text-white">
            Link nhóm
          </Text>
        </View>

        <View className="flex-1 items-center px-6 pt-8">
          <Avatar uri={groupAvatar || undefined} name={groupName} size="xl" isGroup />
          <Text className="mt-4 text-center text-[18px] font-bold text-slate-900">{groupName}</Text>
          <Text className="mt-2 px-4 text-center text-[14px] leading-snug text-slate-500">
            Mời mọi người tham gia nhóm bằng mã QR hoặc link dưới đây:
          </Text>

          <View className="mt-8 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <QRCode value={joinUrl} size={200} color="#0a1629" backgroundColor="#ffffff" />
          </View>

          <Pressable
            onPress={() => void handleCopy()}
            className="mt-6 w-full max-w-[320px] rounded-xl border border-sky-100 bg-sky-50 px-4 py-3"
          >
            <Text
              className="text-center font-mono text-[13px]"
              style={{ color: PRIMARY }}
              numberOfLines={2}
            >
              {joinUrl}
            </Text>
          </Pressable>

          <View className="mt-10 flex-row justify-center gap-10">
            <ActionChip icon={Copy} label="Sao chép link" onPress={() => void handleCopy()} />
            <ActionChip icon={Share2} label="Chia sẻ link" onPress={() => void handleShare()} />
            <ActionChip icon={Download} label="Chia sẻ QR" onPress={() => void handleShare()} />
          </View>

          {previewLoading ? (
            <ActivityIndicator className="mt-8" color={PRIMARY} />
          ) : preview && !preview.isMember && preview.requestStatus !== "pending" ? (
            <Pressable
              onPress={() => void handleJoin()}
              disabled={joining}
              className="mt-8 w-full max-w-[280px] items-center rounded-xl py-3"
              style={{ backgroundColor: PRIMARY, opacity: joining ? 0.6 : 1 }}
            >
              <Text className="text-[15px] font-bold text-white">
                {joining ? "Đang xử lý…" : "Tham gia nhóm"}
              </Text>
            </Pressable>
          ) : preview?.isMember && data?.conversationId ? (
            <Pressable
              onPress={() => {
                onClose();
                router.push(`/(main)/(chat)/${data.conversationId}`);
              }}
              className="mt-8 w-full max-w-[280px] items-center rounded-xl border border-slate-200 py-3"
            >
              <Text className="text-[15px] font-semibold text-slate-800">Mở nhóm chat</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

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
