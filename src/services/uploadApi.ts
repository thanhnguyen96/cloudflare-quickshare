import type {
  CompleteUploadResponse,
  PartUrlResponse,
  UploadedPart,
  UploadSessionResponse,
} from "../types/upload";

const JSON_HEADERS = { "content-type": "application/json" };

interface UploadFileParams {
  file: File;
  onProgress: (loaded: number, total: number) => void;
  onStatusChange: (status: string) => void;
}

export async function uploadFileMultipart({
  file,
  onProgress,
  onStatusChange,
}: UploadFileParams): Promise<CompleteUploadResponse> {
  let session: UploadSessionResponse | null = null;
  const uploadedParts: UploadedPart[] = [];

  try {
    onStatusChange("Preparing multipart upload...");
    session = await startUploadSession(file);

    let completedBytes = 0;
    onProgress(0, file.size);

    for (let partNumber = 1; partNumber <= session.partCount; partNumber += 1) {
      const start = (partNumber - 1) * session.partSize;
      const end = Math.min(start + session.partSize, file.size);
      const chunk = file.slice(start, end);

      onStatusChange(`Uploading part ${partNumber}/${session.partCount}...`);
      const partUrl = await getPartUploadUrl(session.key, session.uploadId, partNumber);

      const etag = await uploadPart(partUrl.url, chunk, (loaded) => {
        onProgress(completedBytes + loaded, file.size);
      });

      completedBytes += chunk.size;
      onProgress(completedBytes, file.size);
      uploadedParts.push({ partNumber, etag });
    }

    onStatusChange("Finalizing upload...");
    return await completeUpload(session.key, session.uploadId, uploadedParts);
  } catch (error) {
    if (session) {
      await abortUpload(session.key, session.uploadId);
    }
    throw error;
  }
}

async function startUploadSession(file: File): Promise<UploadSessionResponse> {
  const response = await fetch("/api/upload/start", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      filename: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });

  return await parseJsonResponse<UploadSessionResponse>(
    response,
    "Unable to start multipart upload.",
  );
}

async function getPartUploadUrl(
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<PartUrlResponse> {
  const params = new URLSearchParams({
    key,
    uploadId,
    partNumber: String(partNumber),
  });

  const response = await fetch(`/api/upload/part-url?${params.toString()}`);
  return await parseJsonResponse<PartUrlResponse>(
    response,
    "Unable to get upload URL for part.",
  );
}

async function completeUpload(
  key: string,
  uploadId: string,
  parts: UploadedPart[],
): Promise<CompleteUploadResponse> {
  const response = await fetch("/api/upload/complete", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ key, uploadId, parts }),
  });

  return await parseJsonResponse<CompleteUploadResponse>(
    response,
    "Unable to complete multipart upload.",
  );
}

async function abortUpload(key: string, uploadId: string): Promise<void> {
  try {
    await fetch("/api/upload/abort", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ key, uploadId }),
    });
  } catch {
    // best-effort cleanup; do not block user with abort failures
  }
}

function uploadPart(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);

    xhr.upload.onprogress = (event) => {
      onProgress(event.loaded || 0);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("etag");
        if (!etag) {
          reject(
            new Error(
              "Missing ETag from R2 response. Check R2 bucket CORS ExposeHeaders includes ETag.",
            ),
          );
          return;
        }
        resolve(etag.replace(/^"+|"+$/g, ""));
        return;
      }

      reject(new Error(`Part upload failed with status ${xhr.status}.`));
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Network error during part upload. Check R2 CORS and R2 access key secrets.",
        ),
      );
    xhr.onabort = () => reject(new Error("Part upload aborted."));
    xhr.send(chunk);
  });
}

async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || fallbackError);
  }
  return payload as T;
}
