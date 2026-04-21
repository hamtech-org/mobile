import { useMemo } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { BarChart2, Check, X } from "lucide-react-native";

import { useIconColors } from "@/hooks/useIconColors";

export type PollVoteOption = { text: string; voters?: string[] };

export type PollVoteModalPoll = {
  pollId: string;
  question: string;
  options: PollVoteOption[];
  isClosed?: boolean;
  isMultipleChoice?: boolean;
};

interface PollVoteModalProps {
  visible: boolean;
  poll: PollVoteModalPoll | null;
  currentUserId: string;
  votingIndex: number | null;
  onClose: () => void;
  onToggleOption: (pollId: string, optionIndex: number) => void;
}

export function PollVoteModal({
  visible,
  poll,
  currentUserId,
  votingIndex,
  onClose,
  onToggleOption,
}: PollVoteModalProps) {
  const { muted, primary } = useIconColors();

  const total = useMemo(
    () => poll?.options?.reduce((sum, option) => sum + (option.voters?.length ?? 0), 0) ?? 0,
    [poll],
  );

  const userVotedIndexes = useMemo(() => {
    const set = new Set<number>();
    poll?.options?.forEach((opt, idx) => {
      if ((opt.voters ?? []).includes(currentUserId)) set.add(idx);
    });
    return set;
  }, [poll, currentUserId]);

  if (!poll) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-center bg-black/50 px-4" onPress={onClose}>
        <Pressable
          className="max-h-[85%] overflow-hidden rounded-2xl border border-border bg-card"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between border-b border-border/60 px-4 py-3">
            <View className="flex-row items-center gap-2">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15">
                <BarChart2 size={18} color="#f97316" strokeWidth={2} />
              </View>
              <Text className="text-[17px] font-bold text-foreground">Bình chọn</Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full bg-muted"
            >
              <X size={20} color={muted} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView className="px-4 py-4" keyboardShouldPersistTaps="handled">
            <View className="mb-3 rounded-xl bg-muted/40 p-3">
              <Text className="text-[15px] font-extrabold text-foreground">{poll.question}</Text>
              <Text className="mt-1 text-[12px] text-muted-foreground">
                {poll.isMultipleChoice ? "Chọn nhiều đáp án" : "Chọn một đáp án"} • {total} lượt
                bình chọn
              </Text>
            </View>

            {poll.options.map((option, idx) => {
              const votes = option.voters?.length ?? 0;
              const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
              const checked = userVotedIndexes.has(idx);
              const disabled = !!poll.isClosed;
              const busyHere = votingIndex === idx;

              return (
                <Pressable
                  key={`${poll.pollId}-${idx}`}
                  disabled={disabled || busyHere}
                  onPress={() => onToggleOption(poll.pollId, idx)}
                  className={`mb-2 rounded-xl border px-3 py-3 ${
                    disabled
                      ? "border-border/40 bg-muted/20 opacity-60"
                      : checked
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/60 bg-background"
                  }`}
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`mt-0.5 h-5 w-5 items-center justify-center rounded-full border ${
                        checked ? "border-primary bg-primary" : "border-border"
                      }`}
                    >
                      {busyHere ? (
                        <ActivityIndicator size="small" color={primary} />
                      ) : checked ? (
                        <Check size={12} color="white" strokeWidth={3} />
                      ) : null}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[13px] font-semibold text-foreground">
                        {option.text}
                      </Text>
                      <Text className="mt-0.5 text-[11px] text-muted-foreground">
                        {votes} lượt ({pct}%)
                      </Text>
                      <View className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <View className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="flex-row items-center justify-between border-t border-border/60 px-4 py-3">
            <Text className="flex-1 pr-2 text-[12px] text-muted-foreground">
              {poll.isClosed ? "Bình chọn đã đóng" : "Bấm để bình chọn / rút phiếu"}
            </Text>
            <Pressable onPress={onClose} className="rounded-xl bg-muted px-4 py-2">
              <Text className="text-[13px] font-bold text-foreground">Đóng</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
