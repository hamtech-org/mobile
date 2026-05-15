export type GroupSystemPerson = {
  userId?: string;
  name?: string;
};

type GroupSystemPayload = {
  kind?: string;
  actor?: GroupSystemPerson;
  targets?: GroupSystemPerson[];
  member?: GroupSystemPerson;
};

function labelPerson(
  person: GroupSystemPerson | undefined,
  currentUserId?: string | null,
  fallback = "Thành viên",
): string {
  const userId = String(person?.userId ?? "").trim();
  const name = String(person?.name ?? "").trim();
  if (currentUserId && userId && userId === currentUserId) return "Bạn";
  return name || fallback;
}

function formatTargetList(targets: GroupSystemPerson[], currentUserId?: string | null): string {
  if (targets.length === 0) return "Thành viên";
  const labels = targets.map((t) => labelPerson(t, currentUserId));
  if (labels.length <= 3) return labels.join(", ");
  const more = labels.length - 3;
  return `${labels.slice(0, 3).join(", ")} và ${more} người khác`;
}

export function formatGroupSystemChatLine(
  raw: string,
  currentUserId?: string | null,
): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed) as GroupSystemPayload;
    const kind = String(obj?.kind ?? "");

    if (kind === "group_member_invited") {
      const who = labelPerson(obj.actor, currentUserId, "Ai đó");
      return `${who} đã mời ${formatTargetList(obj.targets ?? [], currentUserId)} vào nhóm`;
    }
    if (kind === "group_member_joined") {
      const who = labelPerson(obj.member, currentUserId);
      return `${who} đã tham gia nhóm`;
    }
    if (kind === "group_member_removed") {
      const who = labelPerson(obj.actor, currentUserId, "Ai đó");
      const targetLabel = formatTargetList(obj.targets ?? [], currentUserId);
      return `${who} đã mời ${targetLabel} ra khỏi nhóm`;
    }
    return null;
  } catch {
    return null;
  }
}
