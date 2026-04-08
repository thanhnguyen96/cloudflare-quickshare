import type { Env } from "../_lib/types";

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = (rawId || "").trim();
  if (!id) {
    return new Response("Invalid download link.", { status: 400 });
  }

  const object = await env.UPLOADS.get(id);
  if (!object) {
    return new Response("File not found or expired.", { status: 404 });
  }

  const expiresAt = Number(object.customMetadata?.expiresAt || 0);
  if (!expiresAt || expiresAt <= Date.now()) {
    await env.UPLOADS.delete(id);
    return new Response("This file has expired.", { status: 410 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, no-store");
  headers.set("x-file-expires-at", new Date(expiresAt).toISOString());

  return new Response(object.body, { headers });
};
