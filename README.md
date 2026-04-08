# QuickShare 24h

Upload file from mobile/desktop, store on Cloudflare R2 for 24 hours, and share a download link.

## Tech Stack

- Frontend: React + TypeScript + Vite
- Styles: SCSS (7-1 structure) + BEM
- Backend: Cloudflare Pages Functions (Workers runtime)
- Storage: Cloudflare R2 (direct multipart upload via presigned URL)

## Features

- Responsive upload UI (mobile + desktop)
- Direct multipart upload to R2 (large file friendly)
- Upload progress: bar + percent + bytes (refresh every 0.5s)
- Max file size in app: 4 GB
- Download link route: `/d/:id`
- Dark mode / light mode
- QR code for download link (using `api.qrserver.com`)
- Tap QR to open focus overlay for easy mobile screenshot

## Project Structure

- `src/`: React app
- `src/styles/`: SCSS 7-1 folders (`abstracts/base/components/layout/pages/themes/vendors`)
- `functions/`: Pages Functions routes and helpers
- `wrangler.toml`: Cloudflare project config and R2 binding

## Prerequisites

- Node.js 18+
- Cloudflare account with Pages and R2 enabled

## Install

```bash
npm install
```

## Cloudflare Setup

### 1) R2 bucket

```bash
npx wrangler r2 bucket create quickshare-uploads
```

If bucket name is different, update both in `wrangler.toml`:

- `[vars].R2_BUCKET_NAME`
- `[[r2_buckets]].bucket_name`

### 2) Variables in `wrangler.toml`

```toml
[vars]
R2_BUCKET_NAME = "quickshare-uploads"
R2_ACCOUNT_ID = "YOUR_CLOUDFLARE_ACCOUNT_ID"
```

### 3) Pages secrets (required)

Important: when prompted for value, paste the real key value (not variable name).

```bash
npx wrangler pages secret put R2_ACCESS_KEY_ID --project-name quickshare-24h
npx wrangler pages secret put R2_SECRET_ACCESS_KEY --project-name quickshare-24h
```

### 4) R2 CORS (required for multipart upload)

`AllowedOrigins` must match exact origin (no trailing slash, correct scheme `https`).

```json
[
  {
    "AllowedOrigins": [
      "https://quickshare-24h.pages.dev",
      "https://YOUR_CUSTOM_DOMAIN"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### 5) Lifecycle rules (recommended)

In R2 bucket settings:

1. Delete objects older than 1 day
2. Abort incomplete multipart uploads after 1 day

## Development

```bash
npm run dev
```

## Checks

```bash
npm run check
npm run check:functions
npm run build
```

## Deploy

```bash
npm run deploy
```

## API Routes

- `POST /api/upload/start`
- `GET /api/upload/part-url`
- `POST /api/upload/complete`
- `POST /api/upload/abort`
- `GET /d/:id`
