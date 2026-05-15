import Link from "next/link";
import {
  Sparkles,
  FileText,
  Settings2,
  ShieldCheck,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/server/actions/auth-helper";

const FEATURES = [
  {
    icon: FileText,
    title: "Dynamic templates",
    body: "HTML & XML templates with placeholders, loops, conditionals, and formulas — edit without touching code.",
  },
  {
    icon: Settings2,
    title: "Configurable fields",
    body: "Add customer and company fields on the fly. They appear instantly in forms and templates.",
  },
  {
    icon: Layers,
    title: "Invoices, payroll & quotes",
    body: "One engine, many document types. Generate PDF, XML, or PDF/A-3 from the same data.",
  },
  {
    icon: ShieldCheck,
    title: "RBAC & audit log",
    body: "Four roles, granular permissions, and every meaningful action recorded for compliance.",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  const isAuthed = !!session?.user;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-amber/5">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">Invoice Generator</span>
        </Link>
        <nav className="flex items-center gap-2">
          {isAuthed ? (
            <Button asChild>
              <Link href="/dashboard">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="amber">
                <Link href="/login">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-amber" />
          Dynamic invoices · payroll · quotes
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Generate business documents <span className="text-amber">without touching code</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Configure dynamic fields, upload HTML or XML templates, and produce invoices,
          payroll docs, and quotes in seconds. Everything is audited, permissioned, and yours.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {isAuthed ? (
            <Button asChild size="lg" variant="amber">
              <Link href="/dashboard">
                Open dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" variant="amber">
                <Link href="/login">
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber/15 text-amber-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Invoice Generator</span>
          <span>Built with Next.js · Supabase · Prisma</span>
        </div>
      </footer>
    </div>
  );
}
