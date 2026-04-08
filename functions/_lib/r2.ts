import { AwsClient } from "aws4fetch";
import {
  DEFAULT_PART_SIZE_BYTES,
  MAX_MULTIPART_PARTS,
  MIN_MULTIPART_PART_BYTES,
  PRESIGNED_URL_TTL_SECONDS,
} from "./constants";
import type { Env } from "./types";

export function getS3ConfigError(env: Env): string {
  const missing: string[] = [];

  if (!env.R2_ACCOUNT_ID) {
    missing.push("R2_ACCOUNT_ID");
  }

  if (!env.R2_BUCKET_NAME) {
    missing.push("R2_BUCKET_NAME");
  }

  if (!env.R2_ACCESS_KEY_ID) {
    missing.push("R2_ACCESS_KEY_ID");
  }

  if (!env.R2_SECRET_ACCESS_KEY) {
    missing.push("R2_SECRET_ACCESS_KEY");
  }

  if (missing.length > 0) {
    return `Missing config: ${missing.join(", ")}.`;
  }

  const accountId = env.R2_ACCOUNT_ID.trim();
  if (!/^[a-f0-9]{32}$/i.test(accountId)) {
    return "Invalid R2_ACCOUNT_ID format in wrangler.toml [vars].";
  }

  if (
    env.R2_ACCESS_KEY_ID === "R2_ACCESS_KEY_ID" ||
    env.R2_SECRET_ACCESS_KEY === "R2_SECRET_ACCESS_KEY"
  ) {
    return "R2 key secret value is invalid. Use actual Access Key and Secret Key values.";
  }

  return "";
}

export function choosePartSize(totalBytes: number): number {
  const minByPartCount = Math.ceil(totalBytes / MAX_MULTIPART_PARTS);
  const base = Math.max(DEFAULT_PART_SIZE_BYTES, MIN_MULTIPART_PART_BYTES, minByPartCount);
  return Math.ceil(base / MIN_MULTIPART_PART_BYTES) * MIN_MULTIPART_PART_BYTES;
}

export async function createPresignedUploadPartUrl(
  env: Env,
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  const objectUrl = new URL(buildObjectUrl(env, key));
  objectUrl.searchParams.set("partNumber", String(partNumber));
  objectUrl.searchParams.set("uploadId", uploadId);
  objectUrl.searchParams.set("X-Amz-Expires", String(PRESIGNED_URL_TTL_SECONDS));

  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const signed = await client.sign(
    new Request(objectUrl.toString(), { method: "PUT" }),
    {
      aws: {
        signQuery: true,
      },
    },
  );

  return signed.url;
}

export function normalizeCompletedParts(
  parts: unknown,
): { ok: true; parts: R2UploadedPart[] } | { ok: false; error: string } {
  if (!Array.isArray(parts) || parts.length === 0) {
    return { ok: false, error: "At least one uploaded part is required." };
  }

  const normalized: R2UploadedPart[] = [];
  const usedPartNumbers = new Set<number>();

  for (const raw of parts) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, error: "Invalid part payload format." };
    }

    const candidate = raw as { partNumber?: unknown; etag?: unknown };
    const partNumber = Number(candidate.partNumber);
    const etag = normalizeEtag(candidate.etag);

    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > MAX_MULTIPART_PARTS) {
      return { ok: false, error: `Invalid partNumber: ${candidate.partNumber}` };
    }

    if (!etag) {
      return { ok: false, error: `Missing etag for part ${partNumber}.` };
    }

    if (usedPartNumbers.has(partNumber)) {
      return { ok: false, error: `Duplicate partNumber: ${partNumber}.` };
    }

    usedPartNumbers.add(partNumber);
    normalized.push({ partNumber, etag });
  }

  normalized.sort((a, b) => a.partNumber - b.partNumber);
  return { ok: true, parts: normalized };
}

function buildObjectUrl(env: Env, key: string): string {
  const encodedKey = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(
    env.R2_BUCKET_NAME,
  )}/${encodedKey}`;
}

function normalizeEtag(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^"+|"+$/g, "");
}
