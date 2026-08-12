# Menos iT Consult — Website

Official website for **Menos iT Consult**, an IT consulting company based in
Agona, Western Region, Ghana. Plain HTML/CSS/JS frontend, Node.js + Express
backend, and a custom admin dashboard.

The **public site** (`/`), the **admin dashboard** (`/admin`) and the **API**
(`/api/*`) are served from a **single host** with no cross-origin calls. Storage
is **PostgreSQL** and auth is **stateless** (an httpOnly signed cookie), so the
whole app deploys as **one Vercel Serverless Function** — no session store and
no flat-file writes.

---

## Project Structure

```
Menos-iT-Consult/
├── public/                     # All frontend files
│   ├── index.html              # Home page
│   ├── pages/                  # All other pages
│   │   ├── about.html
│   │   ├── services.html
│   │   ├── portfolio.html
│   │   ├── testimonials.html
│   │   ├── contact.html
│   │   ├── blog.html
│   │   ├── privacy.html
│   │   ├── terms.html
│   │   ├── cookies.html
│   │   └── 404.html
│   └── assets/
│       ├── css/                # Per-page stylesheets + base.css
│       ├── js/                 # script.js, legal.js
│       ├── images/             # Static images
│       └── favicon.svg
│
├── admin/                      # Admin dashboard (SPA)
│   ├── index.html
│   ├── app.js
│   ├── editor.js
│   └── style.css
│
├── vercel.json                 # Vercel config (single function + rewrites)
└── backend/                    # Node.js + Express API
    ├── api.js                  # Vercel Serverless Function entry
    ├── server.js               # Express app (exported for api.js)
    ├── db.js                   # PostgreSQL data-access layer
    ├── migrate.js              # Seed PostgreSQL from data/*.json
    ├── setup.js                # Set/reset the admin password in PostgreSQL
    ├── nginx.conf              # Single-host reverse-proxy for VM deploys
    ├── routes/
    │   ├── auth.js             # Login (signed cookie), logout, password
    │   ├── blogs.js            # Blog CRUD + publish/unpublish
    │   ├── contact.js          # Contact form -> email + save
    │   ├── messages.js         # Manage saved contact messages
    │   └── newsletter.js       # Newsletter subscriptions
    ├── middleware/
    │   └── auth.js             # Stateless signed-cookie guard
    ├── data/                   # Seed data (migrated into PostgreSQL)
    │   ├── admin.json
    │   ├── blogs.json
    │   ├── messages.json
    │   └── subscribers.json
    ├── ecosystem.config.js     # PM2 config
    ├── .env.example
    └── package.json
```

---

## Getting Started (local)

> You need a **PostgreSQL** database (local or hosted).

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values. **Required for
PostgreSQL:**

```bash
cp .env.example .env
```

```env
# PostgreSQL (required) — Vercel injects POSTGRES_URL automatically when you add its Postgres add-on
POSTGRES_URL=postgresql://user:pass@localhost:5432/menos_it

# Mail (Nodemailer / Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password        # Gmail App Password (not your login password)
RECIPIENT_EMAIL=minnahmat50@gmail.com

# Server
PORT=3000

# Cookie signing secret — required, change to a long random string
SESSION_SECRET=a-long-random-string

# Admin login password (run `node migrate.js` / `node setup.js` to hash it)
ADMIN_PASSWORD=your-secure-password

# Runtime — `production` enables secure (HTTPS-only) cookies
NODE_ENV=development
```

> **Gmail App Password:** Google Account -> Security -> 2-Step Verification -> App passwords

### 3. Provision the database

```bash
cd backend
node migrate.js
```

Creates the tables (`CREATE TABLE IF NOT EXISTS`) and seeds them from
`data/*.json`, then hashes `ADMIN_PASSWORD` from `.env` into the `admin` table.
Re-running is safe (existing rows are skipped). To (re)set only the admin
password later, run `node setup.js`.

### 4. Start the server

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

The site runs at **http://localhost:3000**. The public site (`/`), the admin
dashboard (`/admin`) and the API (`/api/*`) all share this single origin.

---

## URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Home page |
| `http://localhost:3000/about` | About page |
| `http://localhost:3000/services` | Services page |
| `http://localhost:3000/portfolio` | Portfolio page |
| `http://localhost:3000/testimonials` | Testimonials page |
| `http://localhost:3003/contact` | Contact page |
| `http://localhost:3000/blog` | Blog listing page |
| `http://localhost:3000/blog/:id` | Individual blog post (handled client-side) |
| `http://localhost:3000/privacy` | Privacy policy |
| `http://localhost:3000/terms` | Terms of service |
| `http://localhost:3000/cookies` | Cookie policy |
| `http://localhost:3000/404` | 404 page |
| `http://localhost:3000/admin` | Admin dashboard |
| `http://localhost:3000/api/health` | API health check |

---

## Admin Dashboard

Access at `http://localhost:3000/admin`

**Default login:** `admin` / `admin123` (change this before going live)

| Section | What you can do |
|---------|----------------|
| Dashboard | Overview stats — posts, messages, subscribers |
| Blog Posts | Create, edit, delete, publish/unpublish posts |
| Messages | Read and manage contact form submissions |
| Newsletter | View and remove subscribers |
| Settings | Change admin password |

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (sets a signed httpOnly cookie) |
| POST | `/api/auth/logout` | Logout (clears the cookie) |
| GET | `/api/auth/me` | Check auth state |
| PUT | `/api/auth/password` | Change password (auth) |

### Blogs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blogs` | All blog posts (public) |
| GET | `/api/blogs/:id` | Single post (public) |
| POST | `/api/blogs` | Create post (auth) |
| PUT | `/api/blogs/:id` | Update post (auth) |
| DELETE | `/api/blogs/:id` | Delete post (auth) |
| PATCH | `/api/blogs/:id/publish` | Publish post (auth) |
| PATCH | `/api/blogs/:id/unpublish` | Unpublish post (auth) |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/messages` | All messages (auth) |
| PATCH | `/api/messages/:id/read` | Mark as read (auth) |
| DELETE | `/api/messages/:id` | Delete message (auth) |

### Newsletter
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/newsletter` | Subscribe (public) |
| GET | `/api/newsletter/subscribers` | All subscribers (auth) |
| DELETE | `/api/newsletter/subscribers/:email` | Remove subscriber (auth) |

### Contact
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/contact` | Submit contact form (public) |

---

## Deployment — Vercel (recommended)

The app deploys to **Vercel as a single Serverless Function**. `vercel.json`
rewrites **all** requests (`/`, `/admin`, `/api/*`, clean URLs, 404) to
`backend/api.js`, which exports the Express app from `server.js`. That one host
serves the public site, the admin dashboard **and** the API with zero
cross-origin calls. Auth is a stateless signed cookie (survives cold starts)
and every write goes to **PostgreSQL** (the Vercel filesystem is read-only).

### 1. Create a PostgreSQL database
Use **Vercel Postgres** (or any Postgres provider) and copy the connection
string.

### 2. Add environment variables (on Vercel)
Set these in **Project -> Settings -> Environment Variables**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | the PostgreSQL connection string (required) |
| `SESSION_SECRET` | a long random string (required — signs admin cookies) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your Gmail address |
| `SMTP_PASS` | Gmail App Password |
| `RECIPIENT_EMAIL` | where enquiries are delivered |
| `ADMIN_PASSWORD` | the admin password to seed (see step 4) |
| `NODE_ENV` | `production` (enables HTTPS-only cookies) |

### 3. Install the Vercel CLI and deploy

```bash
npm i -g vercel
vercel          # links & deploys a preview
vercel --prod   # production
```

### 4. Seed the database
Run the migration once (creates tables + imports `data/*.json` + sets the admin
password). Either run it locally against the remote DB, or use `vercel run`:

```bash
# Option A — local, against the remote DATABASE_URL
cd backend
set DATABASE_URL=postgresql://...
set ADMIN_PASSWORD=your-secure-password
node migrate.js

# Option B — one-off execution on Vercel
vercel run backend/migrate.js
```

> **Login at `https://your-site.vercel.app/admin`** with `admin` / the
> `ADMIN_PASSWORD` you seeded.

### Notes
- A single Serverless Function serves every route; `public/` and `admin/` are
  bundled for it via `includeFiles` in `vercel.json` so `express.static` can
  serve them. For very high traffic you can push `/assets`, `/admin` and clean
  URL rewrites to Vercel's edge static layer, but the single-function setup is
  what keeps everything on one host.
- Each cold start opens its own Postgres connections through the `pg` Pool —
  fine for this site's scale.

---

## Deployment (Google Cloud VM)

1. Create a Compute Engine VM (Ubuntu 22.04, e2-micro for free tier)
2. Install Node.js 20+ on the VM
3. Install PostgreSQL and create a database: `sudo apt install postgresql`
4. Clone the repo and run `npm install` in `backend/`
5. Set up `.env` with production values (including `DATABASE_URL`)
6. Run `node migrate.js` to seed PostgreSQL + set the admin password
7. Install PM2: `npm install -g pm2`
8. Start with PM2: `pm2 start backend/server.js --name menos-it`
9. Install Nginx and proxy port 80 -> 3000
10. Add SSL with Certbot: `certbot --nginx -d menos-it.com -d www.menos-it.com`
   - A ready-made Nginx site config ships at `backend/nginx.conf`. It terminates TLS
     and proxies the single host to the Express app on `127.0.0.1:3000`, so the
     **public site** (`/`), the **admin dashboard** (`/admin`) and the **API** (`/api/*`)
     are all served from one host. Put it in place:
   ```bash
   sudo cp backend/nginx.conf /etc/nginx/sites-available/menos-it
   sudo ln -s /etc/nginx/sites-available/menos-it /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks, works offline)
- **Backend:** Node.js, Express 5
- **Auth:** Stateless httpOnly signed cookie (cookie-parser) + bcryptjs
- **Email:** Nodemailer (Gmail SMTP)
- **Storage:** PostgreSQL (Node.js `pg` driver); seed data lives in `backend/data/*.json`
- **Deployment:** Single host — Vercel Serverless Function (Vercel Postgres) or a Google Cloud VM
- **Font:** Inter (Google Fonts, degrades to system-ui offline)

---

## Contact

**Menos iT Consult**
Agona, Western Region, Ghana
minnahmat50@gmail.com