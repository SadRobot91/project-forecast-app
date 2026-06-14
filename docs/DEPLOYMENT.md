# Deployment Guide

This document covers how to deploy the Project Forecast App to production and manage the deployment pipeline.

---

## Architecture Overview

The app is deployed as:
1. **Frontend** — Static site (React + Vite build) served by CDN
2. **Backend** — Serverless functions (Node.js runtime)
3. **Database** — Managed PostgreSQL (hosted external to deployment)

```
Domain → Vercel CDN → /api/* → Serverless Node.js function
                      ↓
                      PostgreSQL (RDS, Supabase, etc.)

User browser → HTTPS → Vercel Edge Network
               (frontend static assets cached globally)
               
API calls → Backend function (on-demand cold start)
            → PostgreSQL
            → Response back to frontend
```

---

## Deployment Platforms

### Option A: Vercel (Recommended for POC)

**Pros:**
- Free tier (generous limits)
- Built-in serverless function support for Node.js
- Fast global CDN
- GitHub integration (deploy on push)
- Environment variable management UI

**Cons:**
- Cold start latency (~1–3s for serverless functions)
- Function execution limits (10s timeout on free tier)

### Option B: AWS Lambda + CloudFront

**Pros:**
- Highly scalable
- Pay-per-use model
- Mature infrastructure

**Cons:**
- More complex setup
- Higher learning curve

### Option C: Self-hosted (Docker + DigitalOcean / AWS EC2)

**Pros:**
- Full control
- No vendor lock-in

**Cons:**
- Requires DevOps knowledge
- More expensive for small teams

**This guide focuses on Vercel.**

---

## Vercel Setup

### 1. Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up (GitHub recommended for easier linking)
3. Create a new project → Link GitHub repo

### 2. Import Project

1. Click "Import Project" → Select your repo
2. Vercel auto-detects monorepo structure
3. Build settings:
   - **Framework Preset:** Node.js (or None)
   - **Build Command:** `pnpm install && pnpm run build` (root level)
   - **Output Directory:** (leave empty — use `vercel.json`)

### 3. Configure `vercel.json`

**File:** `vercel.json` (already in repo)

```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "backend/src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "backend/src/index.ts"
    },
    {
      "src": "/(.*)",
      "dest": "frontend/$1"
    }
  ]
}
```

**Explanation:**
- Build `frontend/` as static site → output to `dist/`
- Build `backend/src/index.ts` as serverless Node.js function
- Route `/api/*` → backend serverless function
- Route everything else (`/*`) → frontend static files
- Frontend router (React Router) handles client-side routing

### 4. Set Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

#### Backend variables (for serverless function)

```
DATABASE_URL = postgres://user:pass@host:5432/project_forecast
PORT = 3000
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
KEYEDIN_API_KEY = (optional)
KEYEDIN_REPORT_KEY = (optional)
NODE_ENV = production
```

#### Frontend variables (injected at build time)

```
VITE_API_URL = https://your-app.vercel.app
VITE_USE_MOCK = false
VITE_SUPABASE_URL = https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc...
```

**Important:** Frontend env vars must have `VITE_` prefix (Vite requirement).

### 5. Deploy

```bash
git push origin main
```

Vercel automatically builds and deploys on push to `main` branch.

Monitor deployment:
- Vercel dashboard → Deployments tab
- Watch build logs in real time
- Automatic rollback if build fails

---

## Database Deployment

### Option A: Supabase (Recommended for POC)

Supabase provides managed PostgreSQL + built-in auth.

#### Setup

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region, database password
4. Wait for provisioning (~2 min)
5. Copy connection string from `Settings → Database → Connection Strings → URI`

```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
```

#### Migrations

```bash
cd backend
DATABASE_URL="<your-supabase-connection-string>" pnpm run migrate
```

This applies all pending migrations from `backend/src/db/migrations/`.

#### User Provisioning

1. **Supabase Auth:**
   - Dashboard → Authentication → Users
   - Add user (email + password)
   - Note the UUID

2. **Local User table:**
   ```sql
   INSERT INTO "User" (email, name, role, supabase_uid, password_hash)
   VALUES ('pm@example.com', 'Alice PM', 'pm', '<uuid-from-supabase>', '');
   ```

#### Env vars for Vercel

```
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ0eXAiOiJKV1QiLCJhbGc...
DATABASE_URL = postgresql://postgres:...
```

### Option B: AWS RDS

If you prefer AWS for the database:

1. Create RDS PostgreSQL instance (free tier available)
2. Set **Public accessibility** to Yes (if backend is serverless)
3. Create security group allowing Vercel IPs
4. Set `DATABASE_URL` env var to RDS endpoint

**Note:** Vercel serverless functions may have IP issues reaching RDS. Use Supabase or configure VPC for better reliability.

### Option C: DigitalOcean Managed PostgreSQL

Similar to RDS — set `DATABASE_URL` to the managed DB connection string.

---

## Pre-Deployment Checklist

### Code

- [ ] All tests pass locally: `pnpm test`
- [ ] No TypeScript errors: `pnpm run build`
- [ ] Commit code to `main` branch
- [ ] No secrets in `.env` files (use Vercel secrets)

### Environment

- [ ] Supabase project created
- [ ] PostgreSQL database provisioned
- [ ] All migrations applied: `pnpm run migrate`
- [ ] Test users provisioned in Supabase + local DB

### Supabase

- [ ] Create Supabase project
- [ ] Note `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- [ ] Enable Email/Password auth (default)

### Vercel

- [ ] GitHub repo linked to Vercel
- [ ] Environment variables set (Backend + Frontend)
- [ ] `vercel.json` in repo root
- [ ] Build command and output paths configured

### Optional: Keyedin

- [ ] Keyedin API token acquired
- [ ] Custom report created in Keyedin
- [ ] `KEYEDIN_*` env vars set (if needed)

---

## Deployment Steps

### Step 1: Initial Setup (First Time Only)

```bash
# Create Supabase project
# (via dashboard at supabase.com)

# Get connection string from Supabase
export DATABASE_URL="postgresql://postgres:PASSWORD@host:5432/postgres"

# Apply migrations
cd backend
pnpm run migrate
pnpm run seed

# Verify database
pnpm run test  # Should not have DB connection errors
```

### Step 2: Link to Vercel

```bash
# Install Vercel CLI (if not already)
npm install -g vercel

# Link project
cd <project-root>
vercel link

# Follow prompts (select organization, project name, etc.)
```

### Step 3: Set Environment Variables

In Vercel dashboard or via CLI:

```bash
# Via CLI
vercel env add DATABASE_URL
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add VITE_API_URL
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_USE_MOCK false
```

### Step 4: Deploy

```bash
git push origin main

# Vercel auto-deploys on push to main
# Monitor at: https://vercel.com/dashboard
```

Or manually:

```bash
vercel deploy --prod
```

### Step 5: Verify

1. **Frontend:** Visit `https://your-app.vercel.app`
2. **Backend health:** Visit `https://your-app.vercel.app/api/health`
3. **Login:** Test auth flow end-to-end
4. **Allocations:** Test resource allocation saves correctly
5. **Dashboard:** Verify calculations and charts load

---

## Monitoring & Debugging

### Vercel Logs

```bash
# Stream logs from deployed function
vercel logs

# Filter by path
vercel logs api/auth
```

### Supabase Monitoring

- Dashboard → Logs → API → Check for errors
- Dashboard → Logs → Authentication → Check login issues
- Dashboard → Database → Query performance

### Frontend Issues

- Browser DevTools → Network tab → Check API calls
- Browser Console → Check CORS errors
- Vercel Analytics → Monitor page load performance

### Backend Issues

- Vercel Logs → Check function cold starts, timeouts
- Database logs → Check slow queries, connection issues
- Error tracking → Set up Sentry for production errors

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Build fails: "pnpm not found" | Vercel not configured for pnpm | Set build script to use `npm` or install pnpm package |
| 503 "Auth service not configured" | Missing Supabase env vars | Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| 401 "Invalid token" | Token expired or malformed | User must re-login; check token refresh logic |
| POST /api fails: "Cannot find module" | Missing dependencies | Run `pnpm install` in backend/, commit `pnpm-lock.yaml` |
| Frontend static 404 on reload | React Router issue | Vercel auto-handles with `rewrites` (should work) |
| Database connection timeout | RDS security group blocking | Allow Vercel IPs in RDS security group (or use Supabase) |
| Slow API response (>10s) | Lambda cold start or long query | Optimize queries, consider reserved concurrency, warm up function |

---

## Rollback

### Rollback to Previous Deployment

In Vercel dashboard:
1. Deployments tab → find previous stable version
2. Click three-dots → "Promote to Production"

No downtime — CDN caches assets, DB state unchanged.

### Rollback Database

```bash
# List applied migrations
SELECT * FROM migrations;

# If migration 009 broke things:
cd backend
# Edit migrations/009_ongoing_phase_id.sql to remove the migration
# Re-run:
pnpm run migrate
```

**Better practice:** Use database backups instead of rolling back migrations.

---

## Cost Estimation

### Vercel (Free Tier)
- 100 GB bandwidth/month
- 12 Function Compute hours/month
- Suitable for POC with <100 daily active users

### Supabase (Free Tier)
- 500 MB database storage
- 1 GB egress/month
- 50,000 monthly active users
- Suitable for POC

### Total Free Tier Cost
**$0 (if usage stays within limits)**

### Production Scaling

- Vercel Pro: $20/month
- Supabase Pro: $25/month
- Estimated total: **$45–100/month** for small production

---

## CI/CD Pipeline

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run build
      - run: pnpm test
      
      - uses: vercel/action@main
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

This ensures tests pass before deploying.

---

## Security Best Practices

1. **Secrets:** Never commit `.env` files
   - Use Vercel secrets management
   - Store in 1Password or LastPass, not GitHub

2. **Database Access:**
   - Use strong passwords (32+ chars)
   - Enable SSL on database connections
   - Restrict inbound IPs (firewall rules)

3. **Supabase:**
   - Keep Service Role key private (never expose in frontend code)
   - Use Anon key for frontend (public)
   - Enable Row Level Security (RLS) for sensitive data

4. **API:**
   - All routes require Bearer token
   - pm_id filtering enforces project ownership
   - Rate limiting recommended (use middleware)

5. **TLS:**
   - Vercel auto-provisions SSL/TLS (free)
   - Force HTTPS redirects in frontend

---

## Scaling for Production

### Horizontal Scaling

Vercel handles auto-scaling; no configuration needed.

### Vertical Scaling

- Database: Upgrade Supabase plan (CPU, RAM, storage)
- Functions: Increase reserved concurrency (Vercel Pro)

### Performance Optimization

1. **Database indexes:**
   ```sql
   CREATE INDEX idx_project_pm_id ON "Project"(pm_id);
   CREATE INDEX idx_allocation_resource_week ON "AllocationEntry"(resource_id, week_start);
   ```

2. **API caching:** Add Redis for session/calculation cache

3. **CDN:** Vercel auto-caches static assets globally

4. **Query optimization:** Profile slow queries with `EXPLAIN ANALYZE`

---

## Backup & Recovery

### Database Backups

**Supabase:**
- Free plan: daily backups (7 days retention)
- Pro plan: hourly backups (30 days retention)
- Dashboard → Settings → Backups

**RDS:**
- Automated daily backups (7 days)
- Configure via AWS console

### Backup Verification

Test restore quarterly:
```bash
DATABASE_URL=<restored-db> pnpm run migrate
```

---

## Post-Deployment Validation

After each deploy:

1. **Smoke test:**
   ```bash
   curl https://your-app.vercel.app/api/health
   # Expected: { status: 'ok' }
   ```

2. **Auth test:**
   - Visit login page
   - Enter test credentials
   - Verify redirect to projects

3. **Functional test:**
   - Create a test project
   - Allocate resources
   - Lock baseline
   - Record actuals
   - Verify dashboard updates

4. **Load test (optional):**
   ```bash
   k6 run load-test.js  # If k6 script exists
   ```

---

## Support & Escalation

- **Vercel Status:** [status.vercel.com](https://status.vercel.com)
- **Supabase Status:** [status.supabase.com](https://status.supabase.com)
- **Vercel Support:** [vercel.com/support](https://vercel.com/support)
- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)

