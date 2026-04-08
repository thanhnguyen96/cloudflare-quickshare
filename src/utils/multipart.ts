const MIN_PART_SIZE = 5 * 1024 * 1024;
const DEFAULT_PART_SIZE = 16 * 1024 * 1024;
const MAX_PARTS = 10000;

export function choosePartSize(totalBytes: number): number {
  const minByPartCount = Math.ceil(totalBytes / MAX_PARTS);
  const base = Math.max(DEFAULT_PART_SIZE, MIN_PART_SIZE, minByPartCount);
  return Math.ceil(base / MIN_PART_SIZE) * MIN_PART_SIZE;
}

export function normalizeEtag(raw: string): string {
  return raw.trim().replace(/^"+|"+$/g, "");
}
