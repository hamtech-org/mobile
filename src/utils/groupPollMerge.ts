import type { PollVoteModalPoll } from "@/components/chat/PollVoteModal";

/** Parse JSON trong tin `type: "poll"` (nhiều biến thể client/backend). */
export function parsePollPayloadFromMessageContent(content: string):
  | (Partial<PollVoteModalPoll> & {
      pollId?: string;
    })
  | null {
  const raw = (content ?? "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const nested =
      o.poll && typeof o.poll === "object" ? (o.poll as Record<string, unknown>) : null;
    const pollId = String(o.pollId ?? nested?.pollId ?? "").trim();
    const question = String(o.question ?? nested?.question ?? "").trim();
    const rawOpts = (Array.isArray(o.options) ? o.options : nested?.options) ?? [];
    const options = (Array.isArray(rawOpts) ? rawOpts : [])
      .map((x) => {
        const ox = x as Record<string, unknown>;
        const text = String(ox.text ?? "").trim();
        const voters = Array.isArray(ox.voters) ? (ox.voters as string[]).map(String) : [];
        return text ? { text, voters } : null;
      })
      .filter((x): x is { text: string; voters: string[] } => x != null);
    if (!pollId || !question) return null;
    return {
      pollId,
      question,
      options,
      isClosed: Boolean(o.isClosed ?? nested?.isClosed),
      isMultipleChoice: Boolean(
        o.isMultipleChoice ?? o.multiple ?? nested?.isMultipleChoice ?? nested?.multiple,
      ),
      isPinned: Boolean(o.isPinned ?? nested?.isPinned),
    };
  } catch {
    return null;
  }
}

/** Ưu tiên dữ liệu live từ API nhóm (`getPolls`). */
export function mergePollWithGroupList(
  partial: NonNullable<ReturnType<typeof parsePollPayloadFromMessageContent>>,
  groupPolls?: PollVoteModalPoll[] | null,
): PollVoteModalPoll | null {
  const id = String(partial.pollId ?? "").trim();
  if (!id) return null;
  const live = groupPolls?.find((p) => p.pollId === id);
  if (live) return live;
  if (!partial.question || !partial.options?.length) return null;
  return {
    pollId: id,
    question: partial.question,
    options: partial.options,
    isClosed: partial.isClosed,
    isMultipleChoice: partial.isMultipleChoice,
    isPinned: partial.isPinned,
  };
}
