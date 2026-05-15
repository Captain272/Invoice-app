# Multi-Tenant Migration Plan

Target shape: **one app instance, many companies**. Each company has its own users, customers, employees, templates, invoices, and payslips. Built for UK MTD (Making Tax Digital) compliance use cases.

---

## Why multi-tenant matters here

UK companies are legally required to keep digital records for VAT (MTD) and RTI payroll. The product opportunity is to serve **multiple companies from one platform** — accountants, bookkeeping agencies, or a SaaS where each company is a tenant. The current code assumes one company; retrofitting tenancy after launch is much more painful than building it in now.

---

## Target data model

```
Company  ────┬──── CompanyFieldValue
             ├──── Customer ──── Invoice ──── InvoiceLineItem
             ├──── Employee ──── Payslip
             ├──── ReportTemplate
             ├──── CustomerFieldConfig
             ├──── CompanyFieldConfig
             ├──── OptionMapper
             ├──── GeneratedDocument
             └──── AuditLog

User  ────  Membership  ────  Company       (user ↔ company with role)
```

Key change: **every table that today references a company implicitly now carries an explicit `companyId` foreign key**, and `User` becomes a global identity that can belong to many companies via `Membership`.

---

## Step-by-step

### 1. Schema changes

In [prisma/schema.prisma](../prisma/schema.prisma):

- **Rename `CompanyProfile` → `Company`**, add UK-specific columns:
  ```prisma
  model Company {
    id                    String    @id @default(cuid())
    name                  String
    legalName             String?
    companiesHouseNumber  String?   @unique
    vatNumber             String?
    payeReference         String?
    accountsOfficeRef     String?
    address               String?
    logoPath              String?
    defaultCurrency       String    @default("GBP")
    vatScheme             String?   // STANDARD, FLAT_RATE, CASH, ANNUAL
    isActive              Boolean   @default(true)
    createdAt             DateTime  @default(now())
    updatedAt             DateTime  @updatedAt

    customers             Customer[]
    employees             Employee[]
    invoices              Invoice[]
    payslips              Payslip[]
    templates             ReportTemplate[]
    customerFieldConfigs  CustomerFieldConfig[]
    companyFieldConfigs   CompanyFieldConfig[]
    optionMappers         OptionMapper[]
    fieldValues           CompanyFieldValue[]
    documents             GeneratedDocument[]
    memberships           Membership[]
  }
  ```

- **Add `Membership`** (User ↔ Company with per-company role):
  ```prisma
  model Membership {
    id        String   @id @default(cuid())
    userId    String   @db.Uuid
    user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
    companyId String
    company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
    role      Role     @default(STAFF)
    createdAt DateTime @default(now())

    @@unique([userId, companyId])
  }
  ```

- **Add `Employee`** (separate from Customer):
  ```prisma
  model Employee {
    id              String   @id @default(cuid())
    companyId       String
    company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
    firstName       String
    lastName        String
    email           String?
    niNumber        String?   // UK National Insurance number
    taxCode         String?   // e.g. 1257L
    payrollNumber   String?
    annualSalary    Decimal?  @db.Decimal(12, 2)
    payFrequency    String?   // MONTHLY, WEEKLY, FORTNIGHTLY
    startDate       DateTime?
    endDate         DateTime?
    status          String    @default("ACTIVE")
    payslips        Payslip[]
    createdAt       DateTime  @default(now())
    updatedAt       DateTime  @updatedAt
  }
  ```

- **Add `Payslip`** (the payroll equivalent of Invoice):
  ```prisma
  model Payslip {
    id            String     @id @default(cuid())
    companyId     String
    company       Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
    employeeId    String
    employee      Employee   @relation(fields: [employeeId], references: [id])
    periodStart   DateTime
    periodEnd     DateTime
    grossPay      Decimal    @db.Decimal(12, 2)
    incomeTax     Decimal    @db.Decimal(12, 2) @default(0)
    nationalIns   Decimal    @db.Decimal(12, 2) @default(0)
    pension       Decimal    @db.Decimal(12, 2) @default(0)
    studentLoan   Decimal    @db.Decimal(12, 2) @default(0)
    otherDeducts  Decimal    @db.Decimal(12, 2) @default(0)
    netPay        Decimal    @db.Decimal(12, 2)
    ytdGross      Decimal    @db.Decimal(12, 2) @default(0)
    ytdTax        Decimal    @db.Decimal(12, 2) @default(0)
    ytdNi         Decimal    @db.Decimal(12, 2) @default(0)
    status        String     @default("DRAFT")  // DRAFT, FINALISED
    createdAt     DateTime   @default(now())
    updatedAt     DateTime   @updatedAt
  }
  ```

- **Add `companyId` to every existing tenant-scoped table**: `Customer`, `Invoice`, `ReportTemplate`, `CustomerFieldConfig`, `CompanyFieldConfig`, `OptionMapper`, `GeneratedDocument`, `CompanyFieldValue`. Each gets `companyId String + company Company @relation(...)`.

- **Drop the global `role` column on `User`** — role now lives on `Membership`. Keep `User` minimal: `id, name, email, status, lastLoginAt, createdAt, updatedAt`.

### 2. Tenant context

Add the concept of an **active company** to every authenticated request. Options (pick one):

- **A. Subdomain-based** (`acme.invoiceapp.com`) — proper SaaS feel, needs Vercel custom-domain plumbing
- **B. URL-prefix-based** (`/c/[companyId]/customers/...`) — simpler, no DNS work, easier for dev
- **C. Cookie-based "current company"** — flat URLs, switcher in the header
- **Recommended: B + C** — URL path for shareable links, cookie for "last-used" memory.

Implement:
- New helper `requireCompany(companyId)` in `auth-helper.ts` that checks the current user has a `Membership` for that company.
- All `getCurrentUser` calls become `getCurrentMembership` returning `{ user, company, role }`.
- A `<CompanySwitcher />` in the header that lists the user's memberships.

### 3. Scope every query

This is the biggest mechanical change. Every Prisma read/write in [src/server/actions/](../src/server/actions/) and every server-component DB call needs `where: { companyId }` (for reads) or `data: { companyId }` (for writes).

Recommended pattern: a thin Prisma extension or per-action wrapper that injects `companyId` automatically and throws if missing — prevents cross-tenant leaks. Example:

```ts
// src/lib/tenant-prisma.ts
export function scopedPrisma(companyId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query, model }) {
          if (MODELS_WITH_COMPANY.has(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },
        // …repeat for findFirst/findUnique/update/delete/create…
      },
    },
  });
}
```

### 4. Middleware + UI

- [middleware.ts](../middleware.ts) extracts `companyId` from URL or cookie, validates the user's membership, attaches it to the request via header.
- Sidebar updates to be company-aware (links become `/c/[companyId]/...`).
- Add a **company-creation flow** for new orgs (first user becomes `SUPER_ADMIN` of the new company).
- Add an **invite-users flow** per company (sends Supabase magic link with metadata).

### 5. Storage & file paths

Generated files and logos must be **partitioned by company** so one tenant can't access another's files:
- `uploads/companies/[companyId]/logos/...`
- `uploads/companies/[companyId]/generated/...`
- `uploads/companies/[companyId]/templates/...`

The download API ([src/app/api/documents/[id]/download/route.ts](../src/app/api/documents/[id]/download/route.ts)) must verify the requested document belongs to the user's active company before serving the file.

**On Vercel**, local filesystem won't work — migrate uploads to **Supabase Storage** with one bucket per company or path-based partitioning. See [docs/DEPLOY.md](DEPLOY.md).

### 6. Seed & migration of existing data

If you already have one company's data:
```sql
-- Create the default company
INSERT INTO "Company" (id, name, "defaultCurrency", "isActive", "createdAt", "updatedAt")
VALUES ('default-co', 'Default Company', 'GBP', true, now(), now());

-- Backfill companyId on every tenant-scoped table
UPDATE "Customer" SET "companyId" = 'default-co';
-- …repeat for Invoice, ReportTemplate, etc.

-- Create memberships from existing User.role
INSERT INTO "Membership" (id, "userId", "companyId", role, "createdAt")
SELECT gen_random_uuid(), id, 'default-co', role, now() FROM "User";
```

Then `ALTER TABLE … ALTER COLUMN "companyId" SET NOT NULL` on every newly added column.

### 7. UK / HMRC additions (after multi-tenant works)

These are follow-on work, not part of the tenancy migration itself:
- **VAT return submission** — HMRC MTD VAT API (needs OAuth app registration, sandbox account)
- **RTI submissions** — HMRC PAYE/RTI API (FPS, EPS) for each pay run
- **Pension auto-enrolment** export (NEST / The People's Pension formats)
- **P45 / P60 / P11D** document templates
- **Bank-feed integration** (TrueLayer, Plaid UK) for reconciliation

Each is a multi-week project. Build the tenancy first, ship a usable single-company-per-tenant MVP, then add HMRC modules.

---

## Effort estimate

| Phase | Scope | Effort |
|---|---|---|
| Phase 1 | Schema + migration + tenant context + scoped queries | **2–3 days** |
| Phase 2 | Company switcher UI, invite flow, signup-creates-company | **1–2 days** |
| Phase 3 | Storage partitioning + Supabase Storage migration | **1 day** |
| Phase 4 | Employee + Payslip CRUD + payslip template | **2 days** |
| Phase 5 | HMRC MTD VAT submission (sandbox first) | **1–2 weeks** |
| Phase 6 | HMRC RTI submission | **2–3 weeks** |

Aim to get Phase 1–4 done before showing it to any potential customer; Phases 5–6 are what make it actually compliant and saleable to UK accountancies.
