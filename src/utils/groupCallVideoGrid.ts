export const GROUP_TILE_GAP_PX = 8;
export const GROUP_TILE_MIN_W = 168;
export const GROUP_TILE_MIN_H = 96;

export function maxTilesPerPage(
  viewportW: number,
  viewportH: number,
  totalRemotes: number,
): number {
  if (totalRemotes <= 0) return 1;
  if (viewportW < 80 || viewportH < 80) return 1;
  const g = GROUP_TILE_GAP_PX;
  const maxK = Math.min(totalRemotes, 24);
  for (let k = maxK; k >= 1; k--) {
    let fits = false;
    for (let cols = 1; cols <= k; cols++) {
      const rows = Math.ceil(k / cols);
      const cellW = (viewportW - g * Math.max(0, cols - 1)) / cols;
      const cellH = (viewportH - g * Math.max(0, rows - 1)) / rows;
      if (cellW >= GROUP_TILE_MIN_W && cellH >= GROUP_TILE_MIN_H) {
        fits = true;
        break;
      }
    }
    if (fits) return k;
  }
  return 1;
}

export function gridColsRows(tileCount: number): { cols: number; rows: number } {
  const n = Math.max(1, tileCount);
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}
