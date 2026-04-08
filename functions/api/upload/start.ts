import {
  MAX_FILE_BYTES,
  MAX_MULTIPART_PARTS,
  ONE_DAY_MS,
} from "../../_lib/constants";
import {
  buildContentDisposition,
  formatBytes,
  json,
  readJson,
  sanitizeContentType,
  sanitizeFilename,
} from "../../_lib/http";
import { choosePartSize, getS3ConfigError } from "../../_lib/r2";
import type { Env } from "../../_lib/types";

interface StartUploadRequest {
  filename?: unknown;
  size?: unknown;
  contentType?: unknown;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const configError = getS3ConfigError(env);
  if (configError) {
    return json({ error: configError }, 500);
  }

  const body = await readJson<StartUploadRequest>(request);
  const filenameInput = typeof body?.filename === "string" ? body.filename : "";
  const filename = sanitizeFilename(filenameInput);
  const size = Number(body?.size ?? 0);
  const contentType = sanitizeContentType(body?.contentType);

  if (!filename) {
    return json({ error: "Filename is required." }, 400);
  }

  if (!Number.isFinite(size) || size <= 0) {
    return json({ error: "Invalid file size." }, 400);
  }

  if (size > MAX_FILE_BYTES) {
    return json({ error: `File too large. Max ${formatBytes(MAX_FILE_BYTES)}.` }, 413);
  }

  const partSize = choosePartSize(size);
  const partCount = Math.ceil(size / partSize);

  if (partCount > MAX_MULTIPART_PARTS) {
    return json({ error: "Too many parts for multipart upload." }, 400);
  }

  const key = crypto.randomUUID();
  const now = Date.now();
  const expiresAt = now + ONE_DAY_MS;

  const multipart = await env.UPLOADS.createMultipartUpload(key, {
    httpMetadata: {
      contentType,
      contentDisposition: buildContentDisposition(filename),
    },
    customMetadata: {
      filename,
      uploadedAt: String(now),
      expiresAt: String(expiresAt),
      uploadMode: "pages-multipart-presigned",
    },
  });

  return json({
    key,
    uploadId: multipart.uploadId,
    filename,
    size,
    contentType,
    partSize,
    partCount,
    expiresAt,
    expiresAtIso: new Date(expiresAt).toISOString(),
    maxFileBytes: MAX_FILE_BYTES,
  });
};
