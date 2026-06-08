# Lucrolla Portfolio

A photography portfolio site with a hidden admin panel for managing all content. Built with Node.js / Express. Photos and videos are stored on Cloudinary so they persist across deploys.

---

## Local Setup

**1. Install dependencies**
```
npm install
```

**2. Create your `.env` file** — copy the template and fill in your values:
```
cp .env.example .env
```
Open `.env` and set:
```
ADMIN_PASSWORD=your_password
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000
```
Get the Cloudinary values from your dashboard at cloudinary.com → Product Environment Credentials.

**3. Start the server**
```
npm start
```

**4. Open the site**
- Main portfolio → http://localhost:3000
- Admin panel → http://localhost:3000/admin.html

---

## Admin Panel

Go to `/admin.html` and enter the password set in `.env`.

The panel has five sections:

| Section | What it does |
|---|---|
| **Site Settings** | Edit name, tagline, Instagram handle |
| **Hero Carousel** | Upload multiple images that auto-slideshow on the homepage |
| **About Section** | Add a photo and text for the About section (hidden on site if empty) |
| **Portfolio Gallery** | Upload gallery photos |
| **Media** | Upload videos (mp4, mov, etc.) |

All uploads go directly to Cloudinary. Deleting an item removes it from Cloudinary too.

---

## Changing the Password

Edit `.env`:
```
ADMIN_PASSWORD=new_password
```
Restart the server. Anyone currently logged into the admin panel will be logged out automatically.

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
    ├── admin.html   ← Admin panel
    ├── photos/      ← Empty stub (.gitkeep only — uploads go to Cloudinary)
    └── media/       ← Empty stub (.gitkeep only — uploads go to Cloudinary)
```

---

## Deploying to Railway

1. Push repo to GitHub (`.env` is gitignored — your secrets stay local)
2. Go to railway.app → New Project → Deploy from GitHub repo
3. In your service → **Variables** tab, add:
   - `ADMIN_PASSWORD`
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
4. Railway runs `npm start` automatically — watch Deploy Logs for `Portfolio running at...`
5. Your site is live at the Railway-generated domain
6. Admin panel is at `https://your-domain.up.railway.app/admin.html`

> **Note:** `config.json` deploys with the repo. If it has leftover test photos, delete them via the local admin panel and push again before deploying.

---

## How Uploads Work

Files are uploaded from the browser → sent to the Express server in memory (never written to disk) → streamed directly to Cloudinary via their API. The Cloudinary URL is saved in `config.json`. When a file is deleted through the admin panel, it is removed from Cloudinary too.
