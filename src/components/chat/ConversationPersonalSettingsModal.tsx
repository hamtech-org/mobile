import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { Ban, Bell, BellOff, ChevronRight, Clock, Pin, X } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";
import type { IConversation } from "@/types/chat.types";
import { usePatchConversationPreferencesMutation } from "@/store/api/chatApi";
import {
  useBlockFriendMutation,
  useGetFriendRequestStatusQuery,
  useUnblockFriendMutation,
} from "@/store/api/userApi";
import { toast } from "@/utils/appToast";
import {
  buildPatchForMutePayload,
  describeMuteSuccess,
  type MuteNotificationsApplyPayload,
} from "@/utils/muteNotifications";

import { MuteNotificationsModal } from "./MuteNotificationsModal";

type ConversationPersonalSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  conversation: IConversation;
};

function activeScheduleIso(c: IConversation): string | null {
  const raw = c.notificationsMutedUntil;
  if (!raw || typeof raw !== "string") return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t) || t <= Date.now()) return null;
  return raw;
}

export function ConversationPersonalSettingsModal({
  visible,
  onClose,
  conversation,
}: ConversationPersonalSettingsModalProps) {
  const { foreground, muted, primary } = useIconColors();
  const [patchPrefs] = usePatchConversationPreferencesMutation();
  const [blockFriend, { isLoading: blockingFriend }] = useBlockFriendMutation();
  const [unblockFriend, { isLoading: unblockingFriend }] = useUnblockFriendMutation();
  const [muteOpen, setMuteOpen] = useState(false);
  const [muteMode, setMuteMode] = useState<"create" | "edit">("create");
  const [muteSubmitting, setMuteSubmitting] = useState(false);

  const scheduledIso = useMemo(() => activeScheduleIso(conversation), [conversation]);
  const directOtherUserId = conversation.otherUserId?.trim() ?? "";
  const { data: friendshipStatus } = useGetFriendRequestStatusQuery(directOtherUserId, {
    skip: !directOtherUserId,
  });
  const isBlocked = friendshipStatus === "blocked";
  const isMuted = conversation.isMuted ?? false;
  const isPinned = conversation.isPinnedToTop ?? false;

  const muteUntilLabel = useMemo(() => {
    const u = conversation.notificationsMutedUntil;
    if (!u) return "Chưa đặt lịch tắt tạm";
    const d = new Date(u);
    return Number.isNaN(d.getTime()) ? "Đã hẹn tắt tạm" : `Hẹn tắt đến: ${d.toLocaleString()}`;
  }, [conversation.notificationsMutedUntil]);

  const togglePinned = useCallback(
    async (next: boolean) => {
      try {
        await patchPrefs({
          conversationId: conversation.conversationId,
          isPinnedToTop: next,
        }).unwrap();
        toast.success(next ? "Đã ghim hội thoại" : "Đã bỏ ghim hội thoại");
      } catch {
        toast.error("Không thể ghim hội thoại");
      }
    },
    [conversation.conversationId, patchPrefs],
  );

  const unmute = useCallback(async () => {
    try {
      await patchPrefs({
        conversationId: conversation.conversationId,
        isMuted: false,
        notificationsMutedUntil: null,
      }).unwrap();
      toast.success("Đã bật thông báo");
    } catch {
      toast.error("Không thể cập nhật thông báo");
    }
  }, [conversation.conversationId, patchPrefs]);

  const applyMutePayload = useCallback(
    async (payload: MuteNotificationsApplyPayload) => {
      setMuteSubmitting(true);
      try {
        await patchPrefs(buildPatchForMutePayload(conversation.conversationId, payload)).unwrap();
        toast.success(describeMuteSuccess(payload));
        setMuteOpen(false);
      } catch {
        toast.error("Không thể cập nhật thông báo");
        throw new Error("mute_failed");
      } finally {
        setMuteSubmitting(false);
      }
    },
    [conversation.conversationId, patchPrefs],
  );

  const openCreateMute = useCallback(() => {
    setMuteMode("create");
    setMuteOpen(true);
  }, []);

  const openEditMute = useCallback(() => {
    setMuteMode("edit");
    setMuteOpen(true);
  }, []);

  const confirmBlockFriend = useCallback(() => {
    const friendId = conversation.otherUserId?.trim();
    if (!friendId) {
      toast.error("Không xác định được người cần chặn");
      return;
    }

    Alert.alert(
      "Chặn bạn bè?",
      `Lịch sử hội thoại sẽ được giữ nguyên, nhưng hai bên sẽ không thể nhận tin hoặc gọi 1-1 với ${conversation.name ?? "người này"}.`,
      [
        { text: "Không", style: "cancel" },
        {
          text: "Chặn",
          style: "destructive",
          onPress: () => {
            void blockFriend({ friendId })
              .unwrap()
              .then(() => {
                toast.success("Đã chặn người dùng");
                onClose();
              })
              .catch(() => toast.error("Không thể chặn người dùng"));
          },
        },
      ],
    );
  }, [blockFriend, conversation.name, conversation.otherUserId, onClose]);

  const unblockCurrentFriend = useCallback(() => {
    const friendId = conversation.otherUserId?.trim();
    if (!friendId) {
      toast.error("Không xác định được người cần bỏ chặn");
      return;
    }

    void unblockFriend({ friendId })
      .unwrap()
      .then(() => {
        toast.success("Đã bỏ chặn người dùng");
      })
      .catch(() => toast.error("Không thể bỏ chặn người dùng"));
  }, [conversation.otherUserId, unblockFriend]);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[styles.sheet, { backgroundColor: "#fff" }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: foreground }]} numberOfLines={1}>
                  Cài đặt cho tôi
                </Text>
                <Text style={[styles.sheetSub, { color: muted }]} numberOfLines={1}>
                  {conversation.name ?? "Hội thoại"}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="rounded-full p-1 active:opacity-60"
              >
                <X size={22} color={muted} strokeWidth={1.75} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              <View style={[styles.row, { borderBottomColor: "rgba(0,0,0,0.06)" }]}>
                <Pin size={22} color={foreground} strokeWidth={1.75} />
                <Text style={[styles.rowLabel, { color: foreground, flex: 1 }]}>
                  Ghim trò chuyện lên đầu
                </Text>
                <Switch
                  value={isPinned}
                  onValueChange={(v) => void togglePinned(v)}
                  trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                  thumbColor={isPinned ? primary : "#f4f4f5"}
                />
              </View>

              <Text style={[styles.section, { color: muted }]}>Thông báo</Text>

              <View style={[styles.infoBlock, { backgroundColor: "rgba(0,0,0,0.04)" }]}>
                <Clock size={20} color={muted} strokeWidth={1.75} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.rowLabel, { color: foreground }]}>Lịch tắt tạm</Text>
                  <Text style={[styles.help, { color: muted }]}>{muteUntilLabel}</Text>
                </View>
              </View>

              {isMuted ? (
                <Pressable
                  style={[styles.actionRow, { borderColor: "rgba(0,0,0,0.08)" }]}
                  onPress={() => void unmute()}
                >
                  <Bell size={22} color={primary} strokeWidth={1.75} />
                  <Text style={[styles.actionLabel, { color: foreground, flex: 1 }]}>
                    Bật thông báo
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.actionRow, { borderColor: "rgba(0,0,0,0.08)" }]}
                  onPress={openCreateMute}
                >
                  <BellOff size={22} color={foreground} strokeWidth={1.75} />
                  <Text style={[styles.actionLabel, { color: foreground, flex: 1 }]}>
                    Tắt thông báo…
                  </Text>
                  <ChevronRight size={20} color={muted} strokeWidth={1.75} />
                </Pressable>
              )}

              {scheduledIso ? (
                <>
                  <Pressable
                    style={[styles.actionRow, { borderColor: "rgba(0,0,0,0.08)", marginTop: 10 }]}
                    onPress={openEditMute}
                  >
                    <Clock size={22} color={foreground} strokeWidth={1.75} />
                    <Text style={[styles.actionLabel, { color: foreground, flex: 1 }]}>
                      Chỉnh sửa mốc tắt tạm
                    </Text>
                    <ChevronRight size={20} color={muted} strokeWidth={1.75} />
                  </Pressable>
                  <Pressable
                    style={[styles.actionRow, { borderColor: "rgba(0,0,0,0.08)" }]}
                    onPress={() => void applyMutePayload({ kind: "clearScheduledMute" })}
                  >
                    <Bell size={22} color={foreground} strokeWidth={1.75} />
                    <Text style={[styles.actionLabel, { color: foreground, flex: 1 }]}>
                      Bỏ hẹn tắt tạm
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Text style={[styles.section, { color: muted }]}>Quyền riêng tư</Text>
              <Pressable
                disabled={blockingFriend || unblockingFriend}
                style={[styles.actionRow, { borderColor: "rgba(239,68,68,0.28)" }]}
                onPress={isBlocked ? unblockCurrentFriend : confirmBlockFriend}
              >
                <Ban size={22} color={isBlocked ? "#059669" : "#ef4444"} strokeWidth={1.75} />
                <Text
                  style={[
                    styles.actionLabel,
                    { color: isBlocked ? "#059669" : "#ef4444", flex: 1 },
                  ]}
                >
                  {isBlocked ? "Bỏ chặn bạn bè" : "Chặn bạn bè"}
                </Text>
                <ChevronRight
                  size={20}
                  color={isBlocked ? "#059669" : "#ef4444"}
                  strokeWidth={1.75}
                />
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <MuteNotificationsModal
        visible={muteOpen}
        mode={muteMode}
        scheduledUntilIso={muteMode === "edit" ? scheduledIso : null}
        isSubmitting={muteSubmitting}
        onClose={() => !muteSubmitting && setMuteOpen(false)}
        onConfirm={async (p) => {
          await applyMutePayload(p);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "88%",
    paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sheetSub: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "500",
  },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 18,
    padding: 12,
    borderRadius: 12,
  },
  help: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});
