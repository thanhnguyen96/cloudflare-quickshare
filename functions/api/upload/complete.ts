import { json, readJson } from "../../_lib/http";
import { normalizeCompletedParts } from "../../_lib/r2";
import type { Env } from "../../_lib/types";

interface CompleteUploadRequest {
  key?: unknown;
  uploadId?: unknown;
  parts?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<CompleteUploadRequest>(request);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";

  if (!key || !uploadId) {
    return json({ error: "Missing key or uploadId." }, 400);
  }

  const normalized = normalizeCompletedParts(body?.parts);
  if (!normalized.ok) {
    return json({ error: normalized.error }, 400);
  }

  const multipart = env.UPLOADS.resumeMultipartUpload(key, uploadId);
  await multipart.complete(normalized.parts);

  const head = await env.UPLOADS.head(key);
  const expiresAt = Number(head?.customMetadata?.expiresAt || 0);
  const origin = new URL(request.url).origin;

  return json({
    id: key,
    expiresAt,
    expiresAtIso: expiresAt ? new Date(expiresAt).toISOString() : null,
    downloadUrl: `${origin}/d/${key}`,
  });
};
