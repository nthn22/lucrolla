# Photography Portfolio

A clean photography portfolio site with a hidden admin panel for managing content.

## Setup

**1. Install dependencies**
```
npm install
```

**2. Start the server**
```
npm start
```

**3. Open the site**
- Main portfolio → http://localhost:3000
- Admin panel   → http://localhost:3000/admin.html

## Admin Panel

Password: `lucrolla123`

To change the password, open `public/admin.html` and find this line near the top of the `<script>` section:
```js
const ADMIN_PASSWORD = 'lucrolla123';
```
Change the value and save.

## Adding Photos

1. Go to the admin panel
2. Drag & drop photos into the **Portfolio Photos** section, or click to browse
3. They appear on the main site immediately

## Changing the Hero Image

1. Go to the admin panel → **Hero Image** section
2. Drop or select an image, then click **Set as Hero**

## Project Structure

```
portfolio/
├── server.js          ← Node/Express backend
├── package.json       ← Dependencies
├── config.json        ← Site content (name, tagline, photos list)
├── README.md
└── public/
    ├── index.html     ← Main portfolio site
    ├── admin.html     ← Admin panel
    └── photos/        ← Uploaded images stored here
```
