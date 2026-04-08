import { json, readJson } from "../../_lib/http";
import type { Env } from "../../_lib/types";

interface AbortUploadRequest {
  key?: unknown;
  uploadId?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<AbortUploadRequest>(request);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const uploadId = typeof body?.uploadId === "string" ? body.uploadId.trim() : "";

  if (!key || !uploadId) {
    return json({ error: "Missing key or uploadId." }, 400);
  }

  try {
    const multipart = env.UPLOADS.resumeMultipartUpload(key, uploadId);
    await multipart.abort();
  } catch (error) {
    console.warn("Multipart abort warning", { key, uploadId, error });
  }

  return json({ ok: true });
};
