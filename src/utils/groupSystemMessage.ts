export type GroupSystemPerson = {
  userId?: string;
  name?: string;
};

type GroupSystemPayload = {
  kind?: string;
  actor?: GroupSystemPerson;
  targets?: GroupSystemPerson[];
  member?: GroupSystemPerson;
  successor?: GroupSystemPerson;
  target?: GroupSystemPerson;
  selfDemote?: boolean;
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
    if (kind === "group_member_left") {
      const who = labelPerson(obj.member, currentUserId, "Thành viên");
      return `${who} đã rời nhóm`;
    }
    if (kind === "group_member_removed") {
      const who = labelPerson(obj.actor, currentUserId, "Ai đó");
      const targetLabel = formatTargetList(obj.targets ?? [], currentUserId);
      return `${who} đã mời ${targetLabel} ra khỏi nhóm`;
    }
    if (kind === "group_owner_transferred") {
      const actorId = String(obj.actor?.userId ?? "").trim();
      const successorId = String(obj.successor?.userId ?? "").trim();
      const actorLabel = labelPerson(obj.actor, currentUserId, "Ai đó");
      const successorLabel = labelPerson(obj.successor, currentUserId, "Thành viên");
      if (currentUserId && actorId && actorId === currentUserId) {
        return `Bạn đã chuyển quyền trưởng nhóm cho ${successorLabel}`;
      }
      if (currentUserId && successorId && successorId === currentUserId) {
        return `${actorLabel} đã chuyển quyền trưởng nhóm cho bạn`;
      }
      return `${actorLabel} đã chuyển quyền trưởng nhóm cho ${successorLabel}`;
    }
    if (kind === "group_owner_assigned") {
      const successorId = String(obj.successor?.userId ?? "").trim();
      const successorLabel = labelPerson(obj.successor, currentUserId, "Thành viên");
      if (currentUserId && successorId && successorId === currentUserId) {
        return "Bạn là trưởng nhóm mới";
      }
      return `${successorLabel} là trưởng nhóm mới`;
    }
    if (kind === "group_admin_promoted") {
      const actorId = String(obj.actor?.userId ?? "").trim();
      const targetId = String(obj.target?.userId ?? "").trim();
      const actorLabel = labelPerson(obj.actor, currentUserId, "Ai đó");
      const targetLabel = labelPerson(obj.target, currentUserId, "Thành viên");
      if (currentUserId && actorId && actorId === currentUserId) {
        return `Bạn đã bổ nhiệm ${targetLabel} làm phó nhóm`;
      }
      if (currentUserId && targetId && targetId === currentUserId) {
        return `${actorLabel} đã bổ nhiệm bạn làm phó nhóm`;
      }
      return `${actorLabel} đã bổ nhiệm ${targetLabel} làm phó nhóm`;
    }
    if (kind === "group_admin_demoted") {
      if (obj.selfDemote) {
        const who = labelPerson(obj.actor, currentUserId, "Ai đó");
        return `${who} đã từ chức phó nhóm`;
      }
      const actorId = String(obj.actor?.userId ?? "").trim();
      const targetId = String(obj.target?.userId ?? "").trim();
      const actorLabel = labelPerson(obj.actor, currentUserId, "Ai đó");
      const targetLabel = labelPerson(obj.target, currentUserId, "Thành viên");
      if (currentUserId && actorId && actorId === currentUserId) {
        return `Bạn đã hạ ${targetLabel} xuống thành viên`;
      }
      if (currentUserId && targetId && targetId === currentUserId) {
        return `${actorLabel} đã hạ bạn xuống thành viên`;
      }
      return `${actorLabel} đã hạ ${targetLabel} xuống thành viên`;
    }
    return null;
  } catch {
    return null;
  }
}
