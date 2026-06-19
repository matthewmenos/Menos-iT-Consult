# Menos iT Consult — Website

Official website for **Menos iT Consult**, an IT consulting company based in Agona, Western Region, Ghana. Built with plain HTML/CSS/JS frontend, Node.js + Express backend, and a custom admin dashboard.

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
└── backend/                    # Node.js + Express API
    ├── server.js               # Entry point
    ├── setup.js                # One-time admin password setup
    ├── routes/
    │   ├── auth.js             # Login, logout, password change
    │   ├── blogs.js            # Blog CRUD + publish/unpublish
    │   ├── contact.js          # Contact form → email + save
    │   ├── messages.js         # Manage saved contact messages
    │   └── newsletter.js       # Newsletter subscriptions
    ├── middleware/
    │   └── auth.js             # Session auth guard
    └── data/                   # Flat-file JSON storage
        ├── admin.json          # Admin credentials (hashed)
        ├── blogs.json          # Blog posts
        ├── messages.json       # Contact form submissions
        └── subscribers.json    # Newsletter subscribers
```

---

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password        # Gmail App Password (not your login password)
RECIPIENT_EMAIL=minnahmat50@gmail.com
SESSION_SECRET=a-long-random-string
ADMIN_PASSWORD=your-secure-password
PORT=3000
```

> **Gmail App Password:** Google Account → Security → 2-Step Verification → App passwords

### 3. Set up admin password

```bash
cd backend
node setup.js
```

This hashes the `ADMIN_PASSWORD` from `.env` and writes it to `data/admin.json`.

### 4. Start the server

```bash
# Production
npm start

# Development (auto-restarts on file changes)
npm run dev
```

The site will be running at **http://localhost:3000**

---

## URLs

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Home page |
| `http://localhost:3000/about` | About page |
| `http://localhost:3000/services` | Services page |
| `http://localhost:3000/portfolio` | Portfolio page |
| `http://localhost:3000/testimonials` | Testimonials page |
| `http://localhost:3000/blog` | Blog page |
| `http://localhost:3000/contact` | Contact page |
| `http://localhost:3000/privacy` | Privacy Policy |
| `http://localhost:3000/terms` | Terms of Service |
| `http://localhost:3000/cookies` | Cookie Policy |
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
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Check session |
| PUT | `/api/auth/password` | Change password |

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

## Deployment (Google Cloud VM)

1. Create a Compute Engine VM (Ubuntu 22.04, e2-micro for free tier)
2. Install Node.js 20+ on the VM
3. Clone the repo and run `npm install` in `backend/`
4. Set up `.env` with production values
5. Run `node setup.js` to hash the admin password
6. Install PM2: `npm install -g pm2`
7. Start with PM2: `pm2 start backend/server.js --name menos-it`
8. Install Nginx and proxy port 80 → 3000
9. Add SSL with Certbot: `certbot --nginx`

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (no frameworks, works offline)
- **Backend:** Node.js, Express 5
- **Auth:** express-session + bcryptjs
- **Email:** Nodemailer (Gmail SMTP)
- **Storage:** JSON flat files (no database required)
- **Font:** Inter (Google Fonts, degrades to system-ui offline)

---

## Contact

**Menos iT Consult**
Agona, Western Region, Ghana
minnahmat50@gmail.com
