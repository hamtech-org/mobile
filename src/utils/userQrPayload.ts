export const USER_QR_KIND = "hamtech_user_qr" as const;

export type UserQrPayload = {
  kind: typeof USER_QR_KIND;
  userId: string;
  displayName?: string;
  avatar?: string | null;
};

export function buildUserQrPayload(input: {
  userId: string;
  displayName?: string | null;
  avatar?: string | null;
}): string {
  return JSON.stringify({
    kind: USER_QR_KIND,
    userId: input.userId.trim(),
    displayName: input.displayName?.trim() || undefined,
    avatar: input.avatar ?? null,
  } satisfies UserQrPayload);
}

export function tryParseUserQrPayload(text: string): UserQrPayload | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const obj = JSON.parse(trimmed) as Partial<UserQrPayload>;
    const userId = String(obj.userId ?? "").trim();
    if (obj.kind !== USER_QR_KIND || !userId) return null;
    return {
      kind: USER_QR_KIND,
      userId,
      displayName: String(obj.displayName ?? "").trim() || undefined,
      avatar: obj.avatar ?? null,
    };
  } catch {
    return null;
  }
}
