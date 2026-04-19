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
      <Pressable className="flex-1 bg-black/50 justify-center px-4" onPress={onClose}>
        <Pressable className="bg-card rounded-2xl border border-border max-h-[85%] overflow-hidden" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/60">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 rounded-xl bg-orange-500/15 items-center justify-center">
                <BarChart2 size={18} color="#f97316" strokeWidth={2} />
              </View>
              <Text className="text-foreground font-bold text-[17px]">Bình chọn</Text>
            </View>
            <Pressable onPress={onClose} className="w-9 h-9 rounded-full bg-muted items-center justify-center">
              <X size={20} color={muted} strokeWidth={2} />
            </Pressable>
          </View>

          <ScrollView className="px-4 py-4" keyboardShouldPersistTaps="handled">
            <View className="rounded-xl bg-muted/40 p-3 mb-3">
              <Text className="text-foreground font-extrabold text-[15px]">{poll.question}</Text>
              <Text className="text-muted-foreground text-[12px] mt-1">
                {poll.isMultipleChoice ? "Chọn nhiều đáp án" : "Chọn một đáp án"} • {total} lượt bình chọn
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
                    disabled ? "opacity-60 border-border/40 bg-muted/20" : checked ? "border-primary/50 bg-primary/10" : "border-border/60 bg-background"
                  }`}
                >
                  <View className="flex-row items-start gap-3">
                    <View
                      className={`mt-0.5 w-5 h-5 rounded-full border items-center justify-center ${
                        checked ? "bg-primary border-primary" : "border-border"
                      }`}
                    >
                      {busyHere ? <ActivityIndicator size="small" color={primary} /> : checked ? <Check size={12} color="white" strokeWidth={3} /> : null}
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-[13px] font-semibold text-foreground">{option.text}</Text>
                      <Text className="text-[11px] text-muted-foreground mt-0.5">
                        {votes} lượt ({pct}%)
                      </Text>
                      <View className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
                        <View className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="flex-row items-center justify-between px-4 py-3 border-t border-border/60">
            <Text className="text-muted-foreground text-[12px] flex-1 pr-2">
              {poll.isClosed ? "Bình chọn đã đóng" : "Bấm để bình chọn / rút phiếu"}
            </Text>
            <Pressable onPress={onClose} className="px-4 py-2 rounded-xl bg-muted">
              <Text className="font-bold text-[13px] text-foreground">Đóng</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
