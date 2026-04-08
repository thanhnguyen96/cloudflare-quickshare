import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { uploadFileMultipart } from "../../services/uploadApi";
import { formatBytes } from "../../utils/formatBytes";

const MAX_FILE_BYTES = 4 * 1024 * 1024 * 1024;
const PROGRESS_REFRESH_MS = 500;

interface UploadResult {
  downloadUrl: string;
  expiresAt: number;
}

interface StatusState {
  text: string;
  isError: boolean;
}

interface ProgressState {
  loaded: number;
  total: number;
}

export function Uploader() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isQrFocused, setIsQrFocused] = useState(false);
  const [status, setStatus] = useState<StatusState>({ text: "", isError: false });
  const [progress, setProgress] = useState<ProgressState>({ loaded: 0, total: 0 });
  const [result, setResult] = useState<UploadResult | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const liveProgressRef = useRef<ProgressState>({ loaded: 0, total: 0 });
  const tickerRef = useRef<number | null>(null);

  const isProgressVisible = Boolean(file) || isUploading;
  const progressPercent =
    progress.total > 0 ? Math.min(100, (progress.loaded / progress.total) * 100) : 0;
  const qrUrl = result
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(result.downloadUrl)}`
    : "";

  useEffect(() => {
    return () => {
      stopProgressTicker();
    };
  }, []);

  useEffect(() => {
    if (!isQrFocused) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQrFocused(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isQrFocused]);

  function setNextFile(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    setIsQrFocused(false);
    setStatus({ text: "", isError: false });

    const total = nextFile?.size ?? 0;
    const nextProgress = { loaded: 0, total };
    liveProgressRef.current = nextProgress;
    setProgress(nextProgress);
  }

  function startProgressTicker() {
    stopProgressTicker();
    tickerRef.current = window.setInterval(() => {
      setProgress({ ...liveProgressRef.current });
    }, PROGRESS_REFRESH_MS);
  }

  function stopProgressTicker() {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setNextFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files?.[0] ?? null;
    setNextFile(droppedFile);
  }

  function handlePickClick() {
    inputRef.current?.click();
  }

  async function handleUploadClick() {
    if (!file) {
      setStatus({ text: "Please choose a file before upload.", isError: true });
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setStatus({ text: `File exceeds ${formatBytes(MAX_FILE_BYTES)} limit.`, isError: true });
      return;
    }

    setIsUploading(true);
    setResult(null);
    liveProgressRef.current = { loaded: 0, total: file.size };
    setProgress({ loaded: 0, total: file.size });
    startProgressTicker();

    try {
      const completed = await uploadFileMultipart({
        file,
        onProgress: (loaded, total) => {
          liveProgressRef.current = { loaded, total };
        },
        onStatusChange: (text) => {
          setStatus({ text, isError: false });
        },
      });

      liveProgressRef.current = { loaded: file.size, total: file.size };
      setProgress({ loaded: file.size, total: file.size });
      setResult({
        downloadUrl: completed.downloadUrl,
        expiresAt: completed.expiresAt,
      });
      setStatus({ text: "Upload successful.", isError: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setStatus({ text: message, isError: true });
    } finally {
      stopProgressTicker();
      setIsUploading(false);
    }
  }

  return (
    <section className="uploader">
      <div
        className={`uploader__dropzone${isDragging ? " uploader__dropzone--active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <p className="uploader__file-name">{file ? file.name : "No file selected"}</p>
        <p className="uploader__file-size">{file ? formatBytes(file.size) : "Max 4 GB per file"}</p>

        <div className="uploader__controls">
          <button
            className="uploader__button uploader__button--secondary"
            type="button"
            onClick={handlePickClick}
            disabled={isUploading}
          >
            Choose file
          </button>
          <button
            className="uploader__button uploader__button--primary"
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload and create link"}
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        className="uploader__input"
        type="file"
        onChange={handleInputChange}
        disabled={isUploading}
      />

      {status.text ? (
        <p className={`uploader__status${status.isError ? " uploader__status--error" : ""}`}>
          {status.text}
        </p>
      ) : null}

      {isProgressVisible ? (
        <div className="uploader__progress">
          <div className="uploader__progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)}>
            <div
              className="uploader__progress-fill"
              style={{ width: `${progressPercent.toFixed(1)}%` }}
            />
          </div>
          <div className="uploader__progress-meta">
            <span>{progressPercent.toFixed(1)}%</span>
            <span>
              {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
            </span>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="uploader__result">
          <p className="uploader__result-label">Download link</p>
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="uploader__result-link"
          >
            {result.downloadUrl}
          </a>
          <p className="uploader__result-expire">
            Expires at: {new Date(result.expiresAt).toLocaleString()}
          </p>

          <button
            type="button"
            className="uploader__qr-trigger"
            onClick={() => {
              setIsQrFocused(true);
            }}
            aria-label="Open focused QR view"
          >
            <img className="uploader__qr-image" src={qrUrl} alt="Download QR code" loading="lazy" />
          </button>
        </div>
      ) : null}

      {result && isQrFocused ? (
        <button
          type="button"
          className="uploader__qr-overlay"
          onClick={() => {
            setIsQrFocused(false);
          }}
          aria-label="Close focused QR view"
        >
          <div className="uploader__qr-overlay-panel">
            <img
              className="uploader__qr-overlay-image"
              src={qrUrl}
              alt="Focused QR code"
            />
          </div>
        </button>
      ) : null}
    </section>
  );
}
