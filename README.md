# cups-printer-admin

Web-based print & scan management for CUPS printers on NAS.

## Project Overview

A self-hosted web application that provides a user-friendly interface for printing and scanning via a CUPS server running on a NAS. Designed for home/small office use, accessible from any device on the local network.

## Environment

- **NAS**: 绿联 (UGREEN) NAS, Docker support
- **Printer**: Brother DCP-1618W (USB connected to NAS, monochrome, no duplex hardware)
- **CUPS**: Running in Docker container `anujdatar/cups:latest`, accessible at `http://<nas-ip>:39193`
- **CUPS Printer Name**: `Brother_DCP-1618W`
- **CUPS Admin**: username `admin`, password `admin`

## Tech Stack

- **Backend**: TypeScript + Hono (lightweight web framework) + @hono/node-server
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: better-sqlite3 (for print/scan history)
- **File Processing**: sharp (images), pdf-lib (PDF manipulation)
- **Scanning**: SANE (scanimage CLI)
- **Language**: Chinese (中文 UI)
- **Build Output**: Single Docker image, frontend built and served by backend

## Architecture

```
cups-printer-admin (this container)
├── Frontend (React SPA, served as static files)
├── Backend (Hono API server, port 3000)
│   ├── Print API → sends jobs to CUPS via IPP/lp command
│   ├── Scan API → calls scanimage (SANE) for scanning
│   └── SQLite DB → stores print/scan history
└── SANE drivers (for scanner access)

CUPS container (existing, separate)
├── Port 39193 (mapped from 631)
└── Brother DCP-1618W printer
```

## Docker Deployment

Final docker-compose.yml will look like:

```yaml
services:
  cups:
    image: anujdatar/cups:latest
    container_name: cups
    restart: unless-stopped
    ports:
      - "39193:631"
    volumes:
      - /volume1/docker/cups:/etc/cups
    devices:
      - /dev/bus/usb/003:/dev/bus/usb/003
    environment:
      - TZ=Asia/Shanghai
      - CUPSADMIN=admin
      - CUPSPASSWORD=admin

  printer-admin:
    image: ghcr.io/<user>/cups-printer-admin:latest  # or build locally
    container_name: printer-admin
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /volume1/docker/printer-admin/data:/app/data  # SQLite DB + uploaded files
    devices:
      - /dev/bus/usb/003:/dev/bus/usb/003  # USB device for SANE scanning
    environment:
      - TZ=Asia/Shanghai
      - CUPS_SERVER=http://cups:631
      - PRINTER_NAME=Brother_DCP-1618W
```

## Features

### 1. Print Module (打印)

**File Upload & Print**
- Drag-and-drop or click to upload files
- Supported formats: PDF, JPEG, PNG, Word (.docx), Excel (.xlsx)
- File preview before printing (image thumbnail, PDF first page)
- Print options:
  - Copies (份数): 1-99
  - Paper size (纸张): A4, A5, B5, Letter
  - Orientation (方向): Portrait/Landscape (纵向/横向)
  - Pages (页码范围): All, specific pages
  - Duplex (双面打印): Long edge / Short edge / Off (软件实现, since hardware doesn't support it — prompt user to re-feed paper manually)
- Submit print job to CUPS
- Show job status (queued, printing, completed, failed)

**Implementation Notes**
- Use IPP protocol or `lp` command to submit jobs to CUPS
- For .docx/.xlsx conversion, use LibreOffice headless in the Docker image
- For duplex: since the printer doesn't support hardware duplex, implement "manual duplex" — print odd pages first, then prompt user to re-insert paper, then print even pages

### 2. Scan Module (扫描)

**Basic Scan**
- One-click scan button
- Scan settings:
  - Resolution (分辨率): 150/300/600 DPI
  - Color mode (色彩): Grayscale (灰度) / Color (彩色)
  - Paper size (纸张): A4, A5, Letter
  - Format (格式): PDF, JPEG, PNG
- Preview scanned result
- Download scanned file

**Multi-page Scan to PDF (多页扫描合并PDF)**
- Scan multiple pages one by one
- Preview each scanned page as thumbnail
- Reorder pages by drag-and-drop
- Delete individual pages
- Merge all pages into single PDF
- Download merged PDF

**ID Card Scan (身份证扫描)**
- Dedicated mode for scanning ID cards
- Step 1: Scan front side → preview
- Step 2: Prompt to flip card, scan back side → preview
- Auto-compose both sides onto a single A4 page (front on top, back on bottom)
- Download as PDF or image

**Implementation Notes**
- Use `scanimage` CLI (SANE) for scanning
- The USB device must be passed through to this container
- SANE Brother drivers need to be installed in the Docker image (brscan4)

### 3. History Module (历史记录)

**Print History**
- List of all print jobs: filename, time, copies, status, paper size
- Filterable by date
- Re-print from history (re-submit same file)

**Scan History**
- List of all scans: filename, time, format, resolution
- Download previous scans
- Delete old scans to free space

**Storage**
- SQLite database at `/app/data/history.db`
- Uploaded files stored at `/app/data/uploads/`
- Scanned files stored at `/app/data/scans/`
- Consider auto-cleanup of files older than 30 days

### 4. UI/UX Requirements

**Design**
- Clean, modern Chinese UI
- Warm paper-like color scheme (not cold/sterile)
- Tab-based navigation: 打印 | 扫描 | 身份证扫描 | 历史记录
- Mobile-first responsive design
- Works well on iPhone, Android, iPad, desktop browsers
- Touch-friendly controls (large buttons, easy tap targets)
- Toast notifications for success/error states

**Responsive Breakpoints**
- Mobile: < 640px (single column, full-width controls)
- Tablet: 640-1024px
- Desktop: > 1024px

**No Authentication Required**
- Open access on local network
- No login page

## API Endpoints

```
# Print
POST   /api/print/upload      Upload file and submit print job
GET    /api/print/status/:id  Get print job status
GET    /api/print/options     Get available print options (paper sizes, etc.)

# Scan
POST   /api/scan/start        Start a scan with given options
GET    /api/scan/preview/:id  Get scan preview image
POST   /api/scan/merge        Merge multiple scans into PDF
POST   /api/scan/idcard       Start ID card scan workflow

# History
GET    /api/history/print     Get print history (with pagination)
GET    /api/history/scan      Get scan history (with pagination)
DELETE /api/history/:id       Delete a history entry
POST   /api/history/reprint/:id  Re-print a previous job

# System
GET    /api/status            Printer & scanner status
```

## Dockerfile

The Dockerfile should:
1. Use Node.js 20 Alpine as base
2. Install SANE, Brother brscan4 driver, LibreOffice headless
3. Build frontend (Vite)
4. Build backend (TypeScript → JavaScript)
5. Serve everything from the backend on port 3000

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
RUN apk add --no-cache sane sane-backends cups-client libreoffice
# Install Brother brscan4 driver (may need special handling for Alpine)
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

## Project Structure

```
cups-printer-admin/
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── Dockerfile
├── docker-compose.yml          # Example compose file
├── index.html
├── public/
│   └── favicon.svg
├── src/
│   ├── client/                 # React frontend
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── Layout.tsx      # Shell with tabs
│   │   │   ├── PrintTab.tsx    # Print upload & options
│   │   │   ├── ScanTab.tsx     # Basic scan & multi-page
│   │   │   ├── IdCardTab.tsx   # ID card scan workflow
│   │   │   ├── HistoryTab.tsx  # Print & scan history
│   │   │   ├── FileDropzone.tsx
│   │   │   ├── PrintOptions.tsx
│   │   │   ├── ScanPreview.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── hooks/
│   │   │   ├── useApi.ts
│   │   │   └── useScan.ts
│   │   └── lib/
│   │       ├── api.ts          # API client
│   │       └── types.ts        # Shared types
│   └── server/                 # Hono backend
│       ├── index.ts            # Entry point, serve static + API
│       ├── routes/
│       │   ├── print.ts
│       │   ├── scan.ts
│       │   └── history.ts
│       ├── services/
│       │   ├── cups.ts         # CUPS/IPP integration
│       │   ├── scanner.ts      # SANE scanimage wrapper
│       │   └── converter.ts    # File format conversion
│       └── db/
│           ├── index.ts        # SQLite setup
│           └── schema.ts       # Table definitions
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Web server port |
| `CUPS_SERVER` | `http://localhost:631` | CUPS server URL |
| `PRINTER_NAME` | `Brother_DCP-1618W` | CUPS printer name |
| `DATA_DIR` | `/app/data` | Data directory for DB and files |
| `MAX_FILE_SIZE` | `50` | Max upload size in MB |
| `HISTORY_RETENTION_DAYS` | `30` | Auto-delete history older than N days |

## Notes

- The printer is monochrome only (Color=F)
- No hardware duplex support (Duplex=F) — manual duplex via software
- Scanner USB device path may change on reboot, consider using udev rules
- SANE driver for Brother: brscan4 package
- CUPS connection from this container to the CUPS container needs Docker networking (use service name `cups` in compose)
