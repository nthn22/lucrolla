# Lucrolla Portfolio

A full-stack photography portfolio web application with a private admin panel for content management. Built with Node.js and Express, with all media stored persistently on Cloudinary so content survives server restarts and redeployments.

Live site: [www.lucrolla.com](https://www.lucrolla.com)

---

## LinkedIn Description

> Full-stack photography portfolio built from scratch with Node.js, Express, and vanilla JavaScript. Features a config-driven frontend that renders all content dynamically from a REST API, a password-protected admin panel for uploading and managing photos and videos, and Cloudinary integration for persistent cloud media storage. Deployed on Railway with a custom domain and automatic GitHub-triggered deployments. Includes mobile-optimized UX with gesture-based hero carousel swiping, paginated galleries, image download protection, and a dark editorial design aesthetic.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js |
| **Framework** | Express 4.x |
| **Frontend** | Vanilla HTML, CSS, JavaScript — no framework, no build step |
| **File uploads** | Multer 2.x (`memoryStorage`) — files never touch disk |
| **Cloud storage** | Cloudinary v2 — photos, videos, and config stored in the cloud |
| **Config persistence** | `config.json` backed up to Cloudinary as a raw file on every save |
| **Auth** | Server-side session token (`crypto.randomBytes`) — password lives in `.env` only |
| **Environment** | dotenv |
| **Deployment** | Railway (auto-deploy from GitHub) |
| **DNS / Domain** | GoDaddy → custom domain `www.lucrolla.com` |
| **Fonts** | Playfair Display + Inter via Google Fonts |

---

## Features

### Public Site
- **Hero carousel** — full-screen slideshow with crossfade transitions, navigation dots, and mobile swipe (half-swipe drag preview with spring snap animation)
- **About section** — optional image + text block; hidden automatically when empty
- **Media section** — video grid with silent hover preview and full-screen playback; hidden when empty
- **Photo gallery** — paginated grid (21 per page) with full-screen lightbox, keyboard navigation, and mobile swipe
- **Scroll-reveal animations** — elements fade up as they enter the viewport via `IntersectionObserver`
- **Image protection** — right-click blocking, drag prevention, print-to-PDF blocking, transparent CSS overlays, `nodownload` on video controls
- **Responsive design** — mobile-first layout, `100dvh` hero for correct fullscreen rendering on iOS

### Admin Panel (password-protected, local only)
- **Site settings** — edit name, tagline, Instagram handle
- **Hero carousel** — upload, preview, and delete hero images
- **About section** — upload an image and write about text
- **Gallery** — drag-and-drop or click-to-browse photo uploads with progress bar; delete individual photos
- **Media** — video upload and management
- Sequential per-file uploads (avoids Cloudinary file-size limits on batch requests)

### Architecture
- **Config-driven** — `config.json` is the single source of truth; frontend fetches `/config` on load and builds the entire DOM from it
- **No database** — all persistence via `config.json` (backed to Cloudinary) and Cloudinary media URLs
- **Zero-disk uploads** — Multer holds files in memory; they stream directly to Cloudinary via `upload_stream`
- **Config survives redeploys** — on startup, server downloads `config.json` from Cloudinary before accepting requests
- **Server-side auth** — session token generated fresh on each start; token expires when tab closes or server restarts

---

## Local Setup

**1. Install dependencies**
```
npm install
```

**2. Create your `.env` file**
```
cp .env.example .env
```
Fill in:
```
ADMIN_PASSWORD=your_password
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000
```
Get Cloudinary values from cloudinary.com → Product Environment Credentials.

**3. Start the server**
```
npm start
```

**4. Open the site**
- Main portfolio → http://localhost:3000
- Admin panel → http://localhost:3000/admin.html

---

## Admin Panel

Go to `/admin.html` and enter the password set in `.env`. The file is gitignored — it lives locally only and is not exposed on GitHub.

| Section | What it does |
|---|---|
| **Site Settings** | Edit name, tagline, Instagram handle |
| **Hero Carousel** | Upload/delete images for the homepage slideshow |
| **About Section** | Upload an about image and write about text |
| **Portfolio Gallery** | Upload and delete gallery photos |
| **Media** | Upload and delete videos |

---

## Project Structure

```
portfolio/
├── server.js        ← Express server + all API routes
├── package.json
├── config.json      ← Live content (Cloudinary URLs, text fields)
├── .env             ← Secrets — never commit this
├── .env.example     ← Template — safe to commit
├── .gitignore
└── public/
    ├── index.html   ← Main portfolio site
    ├── photos/      ← Empty stub (uploads go to Cloudinary)
    └── media/       ← Empty stub (uploads go to Cloudinary)
```

---

## Deployment (Railway)

1. Push repo to GitHub (`.env` is gitignored — credentials stay local)
2. Go to railway.app → New Project → Deploy from GitHub repo
3. In your service → **Variables** tab, add:
   - `ADMIN_PASSWORD`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Railway runs `npm start` automatically
5. Set a custom domain in Railway → Networking → Add Custom Domain, then point your DNS CNAME to the Railway-provided target

Any push to `main` triggers an automatic redeploy.

---

## How Uploads Work

Browser selects files → one fetch request per file → Express receives file in memory (Multer) → streamed directly to Cloudinary via `upload_stream` → Cloudinary URL saved to `config.json` → `config.json` also backed up to Cloudinary as a raw file. Deleting a photo or video removes it from Cloudinary and from `config.json` simultaneously.

---

## Changing the Password

Edit `.env`:
```
ADMIN_PASSWORD=new_password
```
Restart the server. The old session token is invalidated automatically.
