/** Map dramas.media_type (e.g. "korean drama", "chinese special") to a legend bucket. */
export function mediaTypeRegion(mediaType: string): string {
  const s = mediaType.trim().toLowerCase();
  const first = s.split(/\s+/)[0] ?? "";
  if (first.startsWith("korean")) return "Korean";
  if (first.startsWith("chinese")) return "Chinese";
  if (first.startsWith("japanese") || first.startsWith("japan")) return "Japanese";
  if (first.startsWith("taiwan")) return "Taiwanese";
  if (first.startsWith("thai")) return "Thai";
  if (first.startsWith("hong") || first.startsWith("hongkong")) return "Hong Kong";
  if (first.startsWith("filipino") || first.startsWith("philippine")) return "Filipino";
  if (first.startsWith("singapore")) return "Singapore";
  return "Other";
}

const REGION_ORDER = [
  "Korean",
  "Chinese",
  "Japanese",
  "Taiwanese",
  "Thai",
  "Hong Kong",
  "Filipino",
  "Singapore",
  "Other",
] as const;

const REGION_COLORS: Record<string, string> = {
  Korean: "#a78bfa",
  Chinese: "#f472b6",
  Japanese: "#38bdf8",
  Taiwanese: "#fbbf24",
  Thai: "#34d399",
  "Hong Kong": "#fb923c",
  Filipino: "#f87171",
  Singapore: "#94a3b8",
  Other: "#94a3b8",
};

export function regionColor(region: string): string {
  return REGION_COLORS[region] ?? REGION_COLORS.Other;
}

export function orderedRegionsPresent(inUse: Set<string>): string[] {
  const out: string[] = [];
  for (const r of REGION_ORDER) {
    if (inUse.has(r)) out.push(r);
  }
  return out;
}
