# Invoice Generator — Dynamic Payroll & Invoice Platform

A premium SaaS application for generating invoices, payroll documents, quotes, and reports using **dynamic, configurable templates**. Built with Next.js 15, TypeScript, Tailwind, Prisma, Supabase Postgres, Auth.js v5, and Puppeteer.

Administrators can configure dynamic customer/company fields, dropdown option mappers, HTML/XML templates, filename formulas, tax rules, and formula expressions — all without touching code. Every important action is captured in the audit log.

## Tech stack

| Layer       | Stack                                                       |
|-------------|-------------------------------------------------------------|
| Frontend    | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · shadcn/ui · Framer Motion |
| Forms       | React Hook Form · Zod                                       |
| Auth        | Auth.js v5 (credentials) · bcrypt · JWT sessions            |
| DB / ORM    | Supabase PostgreSQL · Prisma 5                              |
| Documents   | Custom safe template engine · Puppeteer (HTML → PDF) · XML  |
| Storage     | Local filesystem under `./uploads` (templates, logos, generated files) |
| Audit       | Postgres-backed audit log on every meaningful action        |

## Features

- 🔐 **Authentication & RBAC** — `SUPER_ADMIN`, `ADMIN`, `STAFF`, `VIEWER` with permission-gated routes and server actions
- 👥 **Customers** — list, search, filter, 3-tab detail (Details · Invoice · Documents), dynamic fields, invoice header + editable line items, one-click document generation
- 🏢 **Company** — single company profile with logo upload and dynamic fields
- 📄 **Documents** — global registry of every generated file with download, format/customer filters, generation metadata
- ⚙️ **Configuration** — 4 tabs: Customer Fields, Company Fields, Option Mappers, Report Mappings
- 🧠 **Template engine** — placeholders `{{var}}`, raw `{{{var}}}`, loops `{{#items}}…{{/items}}`, conditionals `{{if cond}}…{{else}}…{{/if}}`, formulas `{{formula: a * b}}`, function calls `IF(...)`, `ROUND(...)`, `SUM(...)`, etc. — implemented as a hand-written parser/evaluator. **No `eval`, no `Function` constructor.**
- 📁 **Templates** — upload HTML / XML, validate extension and size, versioning ready
- 🧾 **Filename formulas** — `invoice_{{invoice_number}}_{{customer_name}}_{{today}}` with filesystem sanitization
- 📋 **Audit logs** — every login, customer change, template upload, generation, and download
- 🪪 **PDF/A-3** — architectural placeholder; see "PDF/A-3" below

## Getting started

### 1. Install dependencies

```bash
cd ~/Documents/invoice-generator
npm install
```

> `postinstall` runs `prisma generate` automatically.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in:

```env
DATABASE_URL="postgresql://...supabase..."
DIRECT_URL="postgresql://...supabase..."   # used by prisma migrate; can match DATABASE_URL
AUTH_SECRET="$(openssl rand -base64 32)"
NEXTAUTH_URL="http://localhost:3000"
```

Get the Supabase connection string from **Project Settings → Database → Connection string**. For Supabase, use the *session pooler* for `DATABASE_URL` and the *direct* connection for `DIRECT_URL` so migrations work.

### 3. Apply schema and seed

```bash
npx prisma migrate dev --name init   # creates migrations and applies them
npm run db:seed                       # seeds super admin, company, fields, mapper, sample templates and customer
```

If you prefer to skip migration files and push the schema directly (e.g. early prototyping):

```bash
npm run db:push
npm run db:seed
```

### 4. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. Sign in with:

- **Email:** `admin@example.com`
- **Password:** `Admin@12345`

> Change this password immediately under **Settings → Profile** in production.

## Common workflows

### Generating a document

1. Go to **Customers** and pick a customer (or create one).
2. Open the **Invoice Details** tab — fill in invoice header, then switch to **Variables / Line Items** and add rows. Descriptions can contain placeholders like `{{customer_name}}`.
3. Click **Save & Generate**. Choose a template (from Configuration → Report Mappings) and an export format (PDF / XML / PDF-A-3).
4. The document appears in the customer's **Documents** tab and in the global **Documents** view, with a download button.

### Adding a custom field

1. Go to **Configuration → Customer Fields** (or Company Fields).
2. **Add field** — pick a `key` (snake_case, e.g. `purchase_order`), display name, and type.
3. Save. The field immediately appears on every customer's Details tab and is available in templates as `{{purchase_order}}`.

### Uploading a template

1. **Configuration → Report Mappings → Upload template**.
2. Pick an HTML or XML file (max 2 MB). Provide a filename formula such as `invoice_{{invoice_number}}_{{today}}`.
3. The template is stored under `uploads/templates/`. Use any placeholder, loop, conditional, or formula.

## Template syntax reference

| Syntax | Purpose | Example |
|--------|---------|---------|
| `{{var}}` | Simple placeholder, HTML-escaped | `{{customer_name}}` |
| `{{{var}}}` | Raw (no escape) — use for HTML fragments like `{{{company_logo}}}` | `{{{company_logo}}}` |
| `{{#items}}…{{/items}}` | Loop over an array | `{{#line_items}}<tr>…</tr>{{/line_items}}` |
| `{{if cond}}…{{else}}…{{/if}}` | Conditional block | `{{if tax_mode == "19"}}…{{/if}}` |
| `{{formula: expr}}` | Evaluate expression | `{{formula: quantity * unit_price}}` |
| `IF(cond, a, b)` | Function-style ternary | `{{formula: IF(tax_mode == "19", amount * 0.19, 0)}}` |

Built-in functions: `IF`, `AND`, `OR`, `NOT`, `MIN`, `MAX`, `ROUND`, `SUM`, `ABS`, `COALESCE`, `CONCAT`, `UPPER`, `LOWER`, `LEN`.

Available data in template scope (top-level keys):

- `customer_name`, `customer_email`, `customer_address` + every active dynamic customer field by its `key`
- `company_name`, `company_logo`, `company.*` + every active dynamic company field
- `invoice.*`, `invoice_number`, `invoice_date`, `tax_rate`, `currency`
- `line_items` (array of `{pos, key, label, description, quantity, unit, unit_price, tax_type, amount, value}`)
- `subtotal`, `today`, `generated_at`

## PDF/A-3 — current state & how to enable

PDF/A-3 conformance requires embedded ICC profiles, full-subset fonts, and an XMP metadata block. Implementing this from scratch is significant — production deployments typically wire one of:

1. **Adobe PDF Services API** (paid, certified PDF/A-3 conformance)
2. **veraPDF + Ghostscript** pipeline (open source; requires system binaries)
3. **Mustang / Factur-X** (Java; embeds invoice XML for European e-invoice compliance)

The UI fully supports PDF/A-3 selection. When chosen, generation routes through [`src/lib/document-generation/pdfa3.ts`](src/lib/document-generation/pdfa3.ts), which currently delegates to the standard PDF renderer and returns a warning. Replace the body of `convertToPdfA3()` with a real provider — the rest of the application reads only the returned `Buffer`, so no other code changes are required.

## Security model

- All routes outside `/login` and `/api/auth/*` are gated by middleware.
- Server actions check permissions on every call via `requirePerm(...)`.
- Passwords are bcrypt-hashed (10 rounds); plaintext never stored.
- The template engine is a hand-written parser/evaluator. It does **not** use `eval` or `Function`. Variable resolution is whitelisted and prototype-pollution-safe (`__proto__`, `constructor`, `prototype` are blocked).
- Uploads validate extension (`.html`/`.xml`/`.jpg`/`.jpeg`/`.png`) and enforce a size cap.
- File downloads validate that the resolved path is inside the configured `UPLOAD_DIR`; path traversal is rejected.
- Every important action writes to `AuditLog` (login, CRUD on customers/fields/templates, generation, download, deletion, failed generations).

## Folder structure

```
src/
  app/
    (app)/                 # authenticated routes share this layout
      dashboard/
      customers/
      company/
      documents/
      configuration/
      users/
      audit-logs/
      settings/
    login/
    api/auth/[...nextauth]/
    api/documents/[id]/download/
  components/
    layout/                # Sidebar, Header, PageHeader, EmptyState
    ui/                    # shadcn primitives
    forms/                 # DynamicFieldRenderer
  lib/
    audit.ts
    permissions.ts
    prisma.ts
    utils.ts
    validators/
    storage/local.ts
    template-engine/       # expression.ts (parser/evaluator), render.ts
    document-generation/   # generate.ts, pdf.ts, pdfa3.ts
  server/actions/          # customers.ts, configuration.ts, documents.ts, company.ts, users.ts, settings.ts
  types/next-auth.d.ts
auth.ts                    # Auth.js v5 setup
middleware.ts              # route protection
prisma/
  schema.prisma
  seed.ts
uploads/                   # templates/, logos/, generated/ (gitignored)
```

## Roles & permissions

| Action | SUPER_ADMIN | ADMIN | STAFF | VIEWER |
|--------|-------------|-------|-------|--------|
| Manage users | ✓ | — | — | — |
| Manage customers | ✓ | ✓ | ✓ | read |
| Delete customers / documents | ✓ | ✓ | — | — |
| Manage company | ✓ | ✓ | read | read |
| Manage configuration | ✓ | ✓ | read | — |
| Generate documents | ✓ | ✓ | ✓ | — |
| View documents | ✓ | ✓ | ✓ | ✓ |
| View audit logs | ✓ | ✓ | — | — |

## Notes

- Default admin (`admin@example.com` / `Admin@12345`) is created by `npm run db:seed`. **Rotate the password before deploying.**
- Puppeteer downloads a Chromium binary on first install. If you deploy to a serverless platform, swap to `@sparticuz/chromium` + `puppeteer-core`.
- Logos and generated files are stored on the local filesystem. For multi-instance deployments, move uploads to Supabase Storage by replacing `src/lib/storage/local.ts` — its interface is the only contract.
