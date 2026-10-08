# 🚀 ReachOut OS — Production Deployment Guide

ReachOut OS is designed for high-availability multi-tenant outreach operations. This guide covers production deployment on **Vercel** (Serverless + Edge SPA), **Railway / Render** (Containerized), and **Docker / VPS** (Self-hosted).

---

## 📋 Required Environment Variables

Configure these variables in your hosting provider's dashboard:

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | **Yes** | Supabase project REST URL | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase backend service role key | `eyJhbGciOi...` |
| `SUPABASE_ANON_KEY` | **Yes** | Supabase public anonymous key | `eyJhbGciOi...` |
| `VITE_SUPABASE_URL` | **Yes** | Frontend public Supabase URL | `https://xyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | Frontend public anonymous key | `eyJhbGciOi...` |
| `GEMINI_API_KEY` | Optional | Enables AI Copilot & Template Drafting | `AIzaSy...` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Optional | Meta WhatsApp Inbound Webhook token | `reachout_secret_2026` |
| `PORT` | Optional | Server port (defaults to `3000`) | `3000` |
| `NODE_ENV` | Optional | Environment mode | `production` |

---

## 1. ⚡ Vercel Deployment (Recommended for Serverless)

### Step 1: Connect Repository
1. Import your GitHub repository into [Vercel](https://vercel.com).
2. Framework Preset: **Vite** (detected automatically).
3. Root Directory: `./`

### Step 2: Configure Build Settings
- **Build Command:** `npm run build` (Builds Vite SPA to `/dist` and bundles serverless API to `/api/index.js`)
- **Output Directory:** `dist`

### Step 3: Add Environment Variables
Add all required variables from the table above in **Project Settings → Environment Variables**.

### Step 4: Deploy
Click **Deploy**. Vercel will automatically route:
- Frontend SPA traffic to `dist/index.html`
- `/api/*` and webhook endpoints to the serverless entrypoint in `api/index.js`

---

## 2. 🚆 Railway Deployment (Recommended for Containerized Cloud)

### 1-Click Railway Setup
1. Create a new Project in [Railway](https://railway.app).
2. Select **Deploy from GitHub repo**.
3. Railway automatically detects `railway.toml` and `Dockerfile`.
4. Add your Environment Variables in the **Variables** tab.
5. Railway provisions the container, validates `/health`, and generates your public domain `https://reachoutos.up.railway.app`.

---

## 3. 🐳 Docker & VPS Self-Hosting

### Single-Command Docker Compose:
```bash
# 1. Clone repository
git clone https://github.com/your-org/reachoutos.git
cd reachoutos

# 2. Copy and populate production environment variables
cp .env.example .env
nano .env

# 3. Build and launch container
docker compose up -d --build

# 4. Verify running health status
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

---

## 4. 🗄️ Supabase PostgreSQL Database Setup

1. Open your Supabase Project's **SQL Editor**.
2. Run migrations in order from [`database/migrations/`](file:///d:/reachoutos/database/migrations):
   - `001_initial_schema.sql` (Tenants, Users, Contacts, Templates, Campaigns, Audit Logs)
   - `002_fix_members_fk.sql` (Tenant membership constraints)
   - `003_admin_governance.sql` (RBAC, Policy Overrides, Diagnostics)
   - `004_inbound_webhooks.sql` (24h Service Window tracking & Inbound events)
3. Seed default policies and demo fixtures from [`database/seeds/001_seed_data.sql`](file:///d:/reachoutos/database/seeds/001_seed_data.sql).

---

## 5. 🏥 Health & Diagnostics Endpoints

ReachOut OS exposes standard observability endpoints for load balancers and uptime monitors:

- **`GET /health`** (Liveness Probe): Returns HTTP 200 with service name, version, and server uptime.
- **`GET /ready`** (Readiness Probe): Executes an active PostgreSQL query ping, returning database latency (`dbLatencyMs`) and memory usage. Returns HTTP 503 if the database is unreachable.
