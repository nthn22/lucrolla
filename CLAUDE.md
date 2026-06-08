# Lucrolla Portfolio — Project Context

## Stack
- **Runtime:** Node.js
- **Framework:** Express 4.x
- **File uploads:** Multer 2.x with `memoryStorage()` (files never touch disk — streamed directly to Cloudinary)
- **Cloud storage:** Cloudinary v2 (`cloudinary@^2.0.0`) — images/videos stored permanently in the cloud
- **Environment config:** `dotenv` — secrets loaded from `.env` (gitignored)
- **CORS:** `cors` middleware (permissive — fine for local/self-hosted use)
- **Frontend:** Vanilla HTML/CSS/JS — no build step, no framework
- **Fonts:** Playfair Display (headings) + Inter (body) via Google Fonts

## Architecture

### Single-server, static-file approach
`server.js` serves `public/` as static files and exposes a REST API. No templating engine — the frontend fetches `/config` on load and builds the DOM with JS. All content is config-driven.

### Config-driven content
`config.json` is the single source of truth. The main site and admin panel both read/write via the API. Changes in the admin panel reflect on the main site immediately on next page load.

### Cloudinary — persistent file storage
All uploaded files go directly to Cloudinary (not local disk). This means uploads survive server restarts, redeploys, and ephemeral filesystems (Railway, Render, etc.). The Cloudinary `public_id` is stored as `cloudId` alongside the `src` URL in `config.json` so files can be deleted from the cloud when removed via the admin panel.

`multer.memoryStorage()` holds the uploaded buffer in RAM; `uploadBuffer(buffer, options)` wraps `cloudinary.uploader.upload_stream()` in a Promise and returns `{ src, cloudId }`.

Both upload routes use `multer.any()` (not `.array('fieldname', max)`). This avoids `LIMIT_UNEXPECTED_FILE` errors that Multer 2.x throws when the multipart field name doesn't match exactly. File type validation is handled entirely by `fileFilter`, so dropping `.array()`'s field-name check loses nothing.

**`multer-storage-cloudinary` was explicitly rejected** — v4.0.0 requires `cloudinary@^1.x` which has a HIGH severity CVE. The direct `upload_stream` approach with cloudinary v2 has 0 vulnerabilities.

### Auth — server-side, token-based
Admin auth is **server-side**. The password lives in `.env` as `ADMIN_PASSWORD` (never in source code or browser). On `POST /auth` the server compares the submitted password against `process.env.ADMIN_PASSWORD` and — if correct — returns a one-time `SESSION_TOKEN` (a `crypto.randomBytes(32)` hex string generated fresh on each server start). All protected routes use `requireAuth` middleware that checks `Authorization: Bearer <token>`. The token is kept in a JS variable in `admin.html` (not localStorage), so it expires when the browser tab closes.

### File layout
```
portfolio/
├── server.js            ← Express server + all API routes
├── package.json
├── config.json          ← Live content store (Cloudinary URLs + cloudIds)
├── .env                 ← Secrets: ADMIN_PASSWORD, CLOUDINARY_*, PORT (gitignored)
├── .env.example         ← Template committed to GitHub (no real values)
├── .gitignore
├── CLAUDE.md
└── public/
    ├── index.html       ← Main portfolio site
    ├── admin.html       ← Admin panel (server-side password-gated)
    ├── photos/          ← Contains only .gitkeep (uploads go to Cloudinary)
    └── media/           ← Contains only .gitkeep (uploads go to Cloudinary)
```

## config.json Structure
```json
{
  "name": "Lucrolla",
  "tagline": "...",
  "instagram": "handle",
  "heroImages": [{ "src": "https://res.cloudinary.com/...", "cloudId": "portfolio/photos/abc" }],
  "heroImage":  "https://res.cloudinary.com/...",
  "aboutImage": { "src": "https://res.cloudinary.com/...", "cloudId": "portfolio/photos/xyz" },
  "about": "Free-text about section (empty = section hidden on site)",
  "photos": [{ "src": "https://res.cloudinary.com/...", "cloudId": "portfolio/photos/def", "alt": "" }],
  "media":  [{ "src": "https://res.cloudinary.com/...", "cloudId": "portfolio/media/ghi", "alt": "" }]
}
```
- `heroImage` is kept in sync with `heroImages[0].src` for backward compatibility.
- `GET /config` calls `publicConfig()` which strips `cloudId` from all items before sending to the browser — the frontend never sees internal Cloudinary IDs.
- `GET /config` also normalises legacy configs with only `heroImage` (singular) by wrapping it into the array.

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth` | — | Verify password → return session token |
| GET | `/config` | — | Return public config (cloudIds stripped) |
| POST | `/config` | ✓ | Merge-update text fields (name, tagline, instagram, about) |
| POST | `/upload` | ✓ | Upload images; `?hero=true` → heroImages, `?about=true` → aboutImage, default → photos |
| POST | `/upload/media` | ✓ | Upload videos → media array |
| DELETE | `/photo?src=<url>` | ✓ | Delete gallery image from Cloudinary + config (also clears aboutImage if it matches) |
| DELETE | `/hero?src=<url>` | ✓ | Remove one image from hero carousel + Cloudinary |
| DELETE | `/media?src=<url>` | ✓ | Delete video from Cloudinary + config |

Delete routes use `?src=<encodeURIComponent(url)>` — **not** `/:filename`.

## Main Site (index.html) — Page Structure

Sections in order: `#home` → `#about` → `#media` → `#gallery` → `#contact` (footer)

- **About** and **Media** sections are hidden (`display:none`) when their config fields are empty/empty-array. No empty-state shown to visitors.
- About section shows if *either* `about` text or `aboutImage` is set (not both required).
- `scroll-padding-top: 64px` on `<html>` keeps sections from sliding under the fixed navbar.

### Hero Slideshow
- `heroImages` array → one `.hero-slide` div per image, stacked absolutely
- Each `.hero-slide` contains **two** `<img>` elements — a `.hero-bg` and a `.hero-img` — rather than a CSS `background-image`. The dual-layer approach was adopted because `background-size: cover` misbehaved during browser fullscreen transitions.
  - `.hero-bg` — same image, `object-fit: cover`, `filter: blur(22px) brightness(0.28) saturate(0.6)`, `inset: -40px` (overshoots the slide edges so blurred edge-fade is clipped by `overflow: hidden` on `.hero-slide`). Fills the space around the main image.
  - `.hero-img` — `object-fit: contain` so the **full picture is always visible and never cropped**, centered in the slide. The blurred background fills any empty space left by the aspect-ratio mismatch.
  - This is the same dual-layer pattern used by Instagram/Google Photos for mixed-orientation images. `object-fit: cover` was explicitly rejected because it cropped portrait images heavily on wide/fullscreen viewports.
- Active slide: `opacity:1`, others `opacity:0`, crossfade via `transition: opacity 1.6s`
- Auto-advances every 4 s via `setInterval`; **no hover-pause** (removed — hover-pause was clearing the interval whenever the mouse sat over the hero, effectively preventing auto-scroll in normal use)
- Navigation dots rendered bottom-right; only shown when >1 image
- Falls back to no-slide (static) if `heroImages` is empty
- `#home` uses `height: 100dvh` (dynamic viewport height) with `height: 100vh` as fallback — `100dvh` always equals the actual visible height in browser fullscreen (F11) mode, where `100vh` can lag or miscalculate

### Full-screen Nav Overlay
- Hamburger button toggles `#nav-overlay` via `.open` class
- Hamburger animates to an × while open
- Nav links (Home / About / Media / Gallery) use `data-nav` attribute; click handler calls `closeNav()` then `scrollIntoView({ behavior: 'smooth' })` after 280 ms delay (lets overlay fade before scroll)
- Escape key closes overlay
- "Get In Touch" pill → `href="#contact"` → scrolls to Instagram footer

### Scroll-reveal Animations
- Elements with class `fade-up` start at `opacity:0; transform:translateY(36px)`
- `IntersectionObserver` (threshold 0.08) adds `.visible` class when element enters viewport
- Grid children get staggered `transition-delay` via `:nth-child` selectors
- Observer fires once per element, then `unobserve`

### Media Section (Videos)
- 16:9 grid, same column count as gallery
- Hover: silent `video.play()` preview (desktop only via pointer events)
- Click: opens `#video-lightbox`, sets `<video src>`, calls `play()`
- Closing lightbox: `pause()` + clears `src`

### Gallery (Photos)
- 4:5 aspect ratio grid
- Click: opens `#photo-lightbox` with prev/next arrows + counter
- Keyboard: ArrowLeft / ArrowRight / Escape

## Admin Panel (admin.html) — Five Cards

1. **Site Settings** — name, tagline, instagram → `POST /config`
2. **Hero Carousel** — grid of current hero images with × delete each; drop zone adds more via `POST /upload?hero=true`; `DELETE /hero?src=` removes one from Cloudinary
3. **About Section** — optional image (one only) uploaded via `POST /upload?about=true`; delete via `DELETE /photo?src=` (server also clears `aboutImage` if the deleted file matches). Textarea for about text → `POST /config { about: "..." }`. Section hidden on main site if both `about` and `aboutImage` are empty.
4. **Portfolio Gallery** — image drop zone → `POST /upload`; × per photo → `DELETE /photo?src=`
5. **Media (Videos)** — video drop zone → `POST /upload/media`; × per video → `DELETE /media?src=`

All upload zones support both drag-and-drop and click-to-browse. Progress bar shown during upload.

Auth flow: password form → `POST /auth` → server returns `SESSION_TOKEN` → stored in `sessionToken` JS variable → all subsequent requests include `Authorization: Bearer <token>` header via `authHeaders()` helper.

## Key Decisions

- **Auth is server-side** — password in `.env`, never in browser source. Session token is a fresh random hex string per server start; anyone logged into admin re-logs after redeploy. This is safe to commit to GitHub.
- **Cloudinary v2 direct upload** — `multer.memoryStorage()` + `cloudinary.uploader.upload_stream()`. No intermediate packages. `multer-storage-cloudinary` was rejected because it requires vulnerable cloudinary v1.
- **No database** — `config.json` is the only persistence layer.
- **Multer 2.x** — explicitly chose 2.x over 1.x to avoid npm audit vulnerabilities.
- **No build step** — `npm start` is the only command. Keeps it approachable for non-coders.
- **Sections auto-hide** — About and Media are hidden on the public site when empty, so the site never looks unfinished.
- **`public/photos/` and `public/media/` kept as stubs** — contain only `.gitkeep`. Created on server startup if missing. Legacy local paths maintained for compatibility but not used in production.
- **Port from env** — `PORT=3000` default, overridable via `process.env.PORT` for Railway/Render.
- **`publicConfig()` helper** — strips `cloudId` and normalises `heroImages`/`aboutImage` before every API response so the frontend never sees internal Cloudinary IDs.
- **Global Express error handler** — four-argument `(err, req, res, next)` middleware at the bottom of `server.js` catches any unhandled middleware error (including Multer errors) and returns `{ error: message }` JSON instead of Express's default HTML 500 page. Without it, Multer errors produce an HTML response the frontend can't parse as JSON.
- **`multer.any()` for upload routes** — see Cloudinary section above.
- **Upload error logging** — both `/upload` and `/upload/media` catch blocks call `console.error(...)` so Cloudinary or storage errors are visible in the server terminal.
- **Admin toast shows real error** — `uploadFiles` in `admin.html` shows `data.error` (the actual server message) in the error toast instead of a generic "Upload failed" string, making credential and type errors immediately visible to the admin.

## Design Tokens (main site)
- Background: `#1e1e1e` (dark grey)
- Primary text: `#e8e4dc` (warm off-white)
- Accent: `#c8a97e` (warm gold — used for hover, dots active state)
- Muted: `#9e9890`
- Border: `rgba(255,255,255,0.1)`
- Nav overlay background: `rgba(12,10,8,0.97)` (near-black)

## Changing the Admin Password
Edit `.env` (never commit this file):
```
ADMIN_PASSWORD=your_new_password
```
Restart the server. The old session token is invalidated automatically on restart.

## Deployment (Railway / Render)
1. Push repo to GitHub (`.env` is gitignored — credentials stay local)
2. Connect repo in Railway/Render dashboard
3. Set environment variables in the dashboard (copy from `.env`):
   - `ADMIN_PASSWORD`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Deploy — `npm start` runs automatically
5. Re-upload photos/videos via admin panel after first deploy (local `config.json` URLs won't exist on Cloudinary yet)
