# GovDocs Pro

A comprehensive web application for preparing government job and service documents.

## Current Features (MVP v1)
- Photo & Signature Resizing with exact KB compression.
- Government Presets (SSC, UPSC, Railway, etc.).
- PDF Tools: JPG to PDF and PDF Merge.
- Client-side processing for security and privacy.

## Directory Structure
- `/assets`: Global static files (CSS, Global JS, Logos, and Icons).
- `/components`: Modular UI logic for reusable elements (Uploaders, Previewers, Headers).
- `/presets`: Configuration files for government-specific requirements (Dimensions, KB limits).
- `/tools`: Dedicated namespaces for individual tools. Each tool has its own directory and entry page.
  - `/photo-resize/`
  - `/photo-compress/`
  - `/signature-resize/`
  - `/pdf-merge/`
  - ...and future expansions.
- `/utils`: Core "Engines" for image processing, PDF manipulation, and file helpers.
- `index.html`: The primary landing page and tool directory.