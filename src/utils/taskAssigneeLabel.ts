/** Đồng bộ `frontend/src/utils/syncAssignToAllGroupTasks.ts` — nhãn «Giao cho» theo người xem. */

function normalizePersonName(value: string): string {
  return value.trim().toLowerCase();
}

export function labelTaskAssigneeId(
  userId: string,
  currentUserId: string | undefined,
  nameById: Map<string, string>,
): string {
  const id = String(userId).trim();
  if (currentUserId && id && id === String(currentUserId)) return "Bạn";
  return nameById.get(id) ?? id;
}

function formatAssigneeIdList(
  ids: string[],
  currentUserId: string | undefined,
  nameById: Map<string, string>,
): string {
  const labels = ids.map((id) => labelTaskAssigneeId(id, currentUserId, nameById));
  if (labels.length <= 3) return labels.join(", ");
  const more = labels.length - 3;
  return `${labels.slice(0, 3).join(", ")} và ${more} người khác`;
}

function applyViewerToAssigneeFallbackLabel(
  label: string,
  currentUserId: string | undefined,
  viewerDisplayName: string | undefined,
  nameById: Map<string, string>,
): string {
  if (!currentUserId) return label;
  const viewerName = (
    viewerDisplayName?.trim() ||
    nameById.get(String(currentUserId)) ||
    ""
  ).trim();
  if (!viewerName) return label;
  const vn = normalizePersonName(viewerName);
  if (normalizePersonName(label) === vn) return "Bạn";

  return label
    .split(",")
    .map((part) => {
      const p = part.trim();
      if (normalizePersonName(p) === vn) return "Bạn";
      const tail = /^(.+?)\s+và\s+(\d+)\s+người\s+khác$/i.exec(p);
      if (tail && normalizePersonName(tail[1]) === vn) {
        return `Bạn và ${tail[2]} người khác`;
      }
      return p;
    })
    .join(", ");
}

export function labelTaskPerson(
  userId: string | undefined,
  name: string | undefined,
  currentUserId: string | undefined,
  nameById?: Map<string, string>,
): string {
  const id = String(userId ?? "").trim();
  if (currentUserId && id && id === String(currentUserId)) return "Bạn";
  const n = String(name ?? "").trim();
  if (n) return n;
  if (id && nameById) return nameById.get(id) ?? id;
  return n || id || "Thành viên";
}

export function resolveTaskAssigneeDisplayLabel(opts: {
  assignToAll?: boolean;
  broadcast?: boolean;
  assigneeIds: string[];
  memberCount: number;
  nameById: Map<string, string>;
  fallbackLabel?: string;
  currentUserId?: string;
  viewerDisplayName?: string;
}): string {
  const ids = opts.assigneeIds.map(String).filter(Boolean);
  const memberCount = Math.max(0, opts.memberCount);
  const isExplicitAll = Boolean(opts.assignToAll) || Boolean(opts.broadcast);
  const isPartialAssignees = ids.length > 0 && memberCount > 0 && ids.length < memberCount;

  if (isExplicitAll && !isPartialAssignees) {
    return "Cả nhóm";
  }
  if (ids.length > 0) {
    return formatAssigneeIdList(ids, opts.currentUserId, opts.nameById);
  }
  const fb = String(opts.fallbackLabel ?? "").trim();
  if (!fb) return "Cả nhóm";
  return applyViewerToAssigneeFallbackLabel(
    fb,
    opts.currentUserId,
    opts.viewerDisplayName,
    opts.nameById,
  );
}
