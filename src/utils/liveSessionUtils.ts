import type { LiveCoverColor } from "@/store/api/liveApi";
import { LIVE_COVER_COLORS } from "@/store/api/liveApi";

export function formatLiveDuration(startedAt: string, nowMs = Date.now()): string {
  const start = new Date(startedAt).getTime();
  const totalSec = Math.max(0, Math.floor((nowMs - start) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h) % 360;
}

export function resolveLiveCoverBackground(opts: {
  coverImageUrl?: string;
  coverColor?: LiveCoverColor;
  hostUserId: string;
}): { type: "image"; url: string } | { type: "color"; color: string } {
  if (opts.coverImageUrl) {
    return { type: "image", url: opts.coverImageUrl };
  }
  if (opts.coverColor && LIVE_COVER_COLORS[opts.coverColor]) {
    return { type: "color", color: LIVE_COVER_COLORS[opts.coverColor] };
  }
  const hue = hashHue(opts.hostUserId);
  return { type: "color", color: `hsl(${hue}, 52%, 36%)` };
}
