# Deploying to Vercel

The codebase is Vercel-compatible **except for file uploads** — see the limitation at the bottom of this doc.

---

## Prerequisites

- A Supabase project with the schema pushed (`npx prisma db push` locally first)
- Google OAuth enabled in Supabase **Authentication → Providers**
- A GitHub repo containing this codebase

---

## Steps

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Create Vercel project

- Go to https://vercel.com/new
- Import the GitHub repo
- Framework preset: **Next.js** (auto-detected)
- Build command: `npm run build` (already configured — runs `prisma generate && next build`)
- Output directory: leave default

### 3. Set environment variables in Vercel

Project → Settings → Environment Variables. Add **all** of these (matching your local [.env](../.env)):

| Key | Value |
|---|---|
| `DATABASE_URL` | Supabase **Session pooler** URI |
| `DIRECT_URL` | Supabase **Direct connection** URI |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (**Secret**, never expose) |
| `SUPER_ADMIN_EMAILS` | Comma-separated admin emails |
| `APP_NAME` | `Invoice Generator` |
| `DEFAULT_CURRENCY` | `GBP` |

> Mark `SUPABASE_SERVICE_ROLE_KEY` as **Sensitive** in Vercel.

### 4. Update Supabase redirect URLs

After Vercel gives you a deployment URL (e.g. `https://your-app.vercel.app`):

- Supabase Dashboard → **Authentication → URL Configuration**
- Add to **Redirect URLs**:
  ```
  https://your-app.vercel.app/auth/callback
  https://your-app.vercel.app/**
  ```
- Set **Site URL** to your production URL (or keep localhost during testing — Site URL is the *default* fallback only)

### 5. Update Google OAuth (if using Google sign-in)

Google Cloud Console → your OAuth client → **Authorized redirect URIs** — make sure your Supabase callback `https://<project>.supabase.co/auth/v1/callback` is listed. (Supabase itself proxies Google; you don't add Vercel URLs to Google.)

### 6. Trigger deploy + test

Vercel auto-deploys on push to `main`. After the build succeeds:
- Visit `https://your-app.vercel.app`
- Sign in via Google or email/password
- You should land on `/dashboard`

---

## Function configuration

PDF generation uses headless Chromium (`@sparticuz/chromium`). It needs enough memory and time on Vercel:

In Vercel project settings → **Functions**:
- **Memory**: 1024 MB (default is 1024 on Hobby, but verify)
- **Max Duration**: 60 seconds (Pro plan) or 10 seconds (Hobby — may time out on large templates)

If you want to override per-route, add this at the top of `src/app/api/documents/[id]/download/route.ts` and any route that calls the generator:

```ts
export const maxDuration = 60;
export const runtime = "nodejs";   // not "edge" — Chromium needs Node
```

---

## ⚠️ Storage limitation (must read)

The current codebase writes generated PDFs and uploaded templates/logos to the **local filesystem** under `./uploads/`. This works locally but **breaks on Vercel** because:

- Vercel functions have **ephemeral filesystems** — anything written during a request is gone after the function exits.
- Multiple function instances don't share files.
- A document generated in one request will 404 when the download endpoint hits a different function instance.

### Two options to fix before relying on document generation in production

**Option A — Migrate to Supabase Storage (recommended)**
- Create buckets in Supabase: `templates`, `logos`, `generated`.
- Replace [src/lib/storage/local.ts](../src/lib/storage/local.ts) with a Supabase Storage client.
- Generation writes to Storage; download streams from Storage.
- ~half a day of work; touches `documents.ts` action, the download route, the template upload action, and logo upload.

**Option B — Defer document generation**
- Ship the deploy without working PDF generation (CRUD, config, audit — all fine).
- Add a banner: "Document generation coming soon."
- Migrate storage when you're ready to enable it.

### Current behaviour on Vercel

- ✅ Login (Google + email/password)
- ✅ Customers, configuration, users, audit logs, dashboard — all CRUD works
- ✅ PDF *generation* itself runs (Chromium loads)
- ❌ Generated file persists only for that single request — download will fail seconds later
- ❌ Template uploads will not persist — the file is gone after the next deploy/cold start

Generation works during integration testing but is **not production-ready** until storage migrates off the local filesystem.

---

## Database migrations on deploy

`npm run build` runs `prisma generate` automatically but **does not run migrations**. To apply schema changes:

```bash
# Option 1: run from your machine, hitting the production DB
DATABASE_URL=<prod> DIRECT_URL=<prod> npx prisma migrate deploy

# Option 2: extend the build command in Vercel
prisma migrate deploy && prisma generate && next build
```

For now (no migrations exist, just `db push`):
```bash
DATABASE_URL=<prod> DIRECT_URL=<prod> npx prisma db push
DATABASE_URL=<prod> DIRECT_URL=<prod> npm run db:seed
```

---

## What's *not* covered yet

- Multi-tenancy — see [MULTI_TENANT.md](MULTI_TENANT.md). Until that lands, this is a single-company deployment.
- HMRC submission integration — see "UK / HMRC additions" in `MULTI_TENANT.md`.
- Email delivery of invoices/payslips — needs Resend / Postmark / SES wired up.
