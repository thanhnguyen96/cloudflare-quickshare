import { MAX_MULTIPART_PARTS, PRESIGNED_URL_TTL_SECONDS } from "../../_lib/constants";
import { json } from "../../_lib/http";
import { createPresignedUploadPartUrl, getS3ConfigError } from "../../_lib/r2";
import type { Env } from "../../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const configError = getS3ConfigError(env);
  if (configError) {
    return json({ error: configError }, 500);
  }

  const url = new URL(request.url);
  const key = (url.searchParams.get("key") || "").trim();
  const uploadId = (url.searchParams.get("uploadId") || "").trim();
  const partNumber = Number(url.searchParams.get("partNumber") || 0);

  if (!key || !uploadId || !Number.isInteger(partNumber)) {
    return json({ error: "Missing or invalid key, uploadId, or partNumber." }, 400);
  }

  if (partNumber < 1 || partNumber > MAX_MULTIPART_PARTS) {
    return json({ error: `partNumber must be between 1 and ${MAX_MULTIPART_PARTS}.` }, 400);
  }

  const signedUrl = await createPresignedUploadPartUrl(env, key, uploadId, partNumber);
  return json({
    url: signedUrl,
    partNumber,
    expiresInSeconds: PRESIGNED_URL_TTL_SECONDS,
  });
};
