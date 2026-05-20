import { getJoinGroupUrl } from "@/utils/joinGroupUrl";

export const GROUP_JOIN_LINK_KIND = "group_join_link" as const;

export type GroupJoinLinkMessagePayload = {
  kind: typeof GROUP_JOIN_LINK_KIND;
  url: string;
  suffix: string;
  groupName: string;
  groupAvatar?: string | null;
  conversationId?: string;
  description?: string;
};

const JOIN_PATH_RE = /\/join\/([a-f0-9]{8,32})\/?$/i;

export function extractJoinSuffixFromText(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const m = u.pathname.match(JOIN_PATH_RE);
    return m?.[1]?.toLowerCase() ?? null;
  } catch {
    const m = raw.match(JOIN_PATH_RE);
    return m?.[1]?.toLowerCase() ?? null;
  }
}

export function tryParseGroupJoinLinkMessage(content: string): GroupJoinLinkMessagePayload | null {
  const trimmed = (content ?? "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const obj = JSON.parse(trimmed) as Partial<GroupJoinLinkMessagePayload>;
    if (obj?.kind !== GROUP_JOIN_LINK_KIND) return null;
    const suffix = String(obj.suffix ?? "")
      .trim()
      .toLowerCase();
    const url = String(obj.url ?? "").trim() || getJoinGroupUrl(suffix);
    const groupName = String(obj.groupName ?? "").trim() || "Nhóm chat";
    if (!suffix || !url) return null;
    return {
      kind: GROUP_JOIN_LINK_KIND,
      url,
      suffix,
      groupName,
      groupAvatar: obj.groupAvatar ?? null,
      conversationId: obj.conversationId,
      description: obj.description?.trim() || "Bấm vào đây để tham gia nhóm trên HamTech",
    };
  } catch {
    return null;
  }
}

export function resolveGroupJoinLinkFromMessageContent(
  content: string,
): GroupJoinLinkMessagePayload | null {
  const parsed = tryParseGroupJoinLinkMessage(content);
  if (parsed) return parsed;
  const suffix = extractJoinSuffixFromText(content);
  if (!suffix) return null;
  return {
    kind: GROUP_JOIN_LINK_KIND,
    url: getJoinGroupUrl(suffix),
    suffix,
    groupName: "Nhóm chat",
    description: "Bấm vào đây để tham gia nhóm trên HamTech",
  };
}

export function buildGroupJoinLinkMessageContent(input: {
  suffix: string;
  groupName: string;
  groupAvatar?: string | null;
  conversationId?: string;
  url?: string;
}): string {
  const suffix = input.suffix.trim().toLowerCase();
  const payload: GroupJoinLinkMessagePayload = {
    kind: GROUP_JOIN_LINK_KIND,
    url: input.url?.trim() || getJoinGroupUrl(suffix),
    suffix,
    groupName: input.groupName.trim() || "Nhóm chat",
    groupAvatar: input.groupAvatar ?? null,
    conversationId: input.conversationId,
    description: "Bấm vào đây để tham gia nhóm trên HamTech",
  };
  return JSON.stringify(payload);
}

export function formatGroupJoinLinkListPreview(content: string): string | null {
  const p = resolveGroupJoinLinkFromMessageContent(content);
  if (!p) return null;
  return `Link mời tham gia nhóm: ${p.groupName}`;
}

export function joinLinkMessageDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "hamtech.app";
  }
}
