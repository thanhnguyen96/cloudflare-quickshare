export interface UploadSessionResponse {
  key: string;
  uploadId: string;
  filename: string;
  size: number;
  contentType: string;
  partSize: number;
  partCount: number;
  expiresAt: number;
  expiresAtIso: string;
  maxFileBytes: number;
}

export interface PartUrlResponse {
  url: string;
  partNumber: number;
  expiresInSeconds: number;
}

export interface CompleteUploadResponse {
  id: string;
  expiresAt: number;
  expiresAtIso: string | null;
  downloadUrl: string;
}

export interface UploadedPart {
  partNumber: number;
  etag: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
}
