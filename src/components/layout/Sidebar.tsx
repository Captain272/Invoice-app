"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  Settings2,
  ScrollText,
  ShieldCheck,
  Settings,
  Sparkles,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/permissions";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: null as Permission | null },
  { href: "/customers", label: "Customers", icon: Users, perm: "customers:read" as const },
  { href: "/company", label: "Company", icon: Building2, perm: "company:read" as const },
  { href: "/documents", label: "Documents", icon: FileText, perm: "documents:read" as const },
  { href: "/configuration", label: "Configuration", icon: Settings2, perm: "config:read" as const },
  { href: "/users", label: "Users", icon: ShieldCheck, perm: "users:read" as const },
  { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, perm: "audit:read" as const },
  { href: "/settings", label: "Settings", icon: Settings, perm: null as Permission | null },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-card/60 backdrop-blur-sm">
      <div className="flex h-16 items-center gap-2 px-6 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Invoice Gen</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Dynamic Platform</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {NAV.filter((item) => !item.perm || can(role, item.perm)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="rounded-lg bg-amber/10 border border-amber/20 p-3 text-xs">
          <p className="font-medium text-foreground/80 mb-1">Need a template?</p>
          <p className="text-muted-foreground leading-relaxed">
            Upload HTML or XML templates from Configuration → Report Mappings.
          </p>
        </div>
      </div>
    </aside>
  );
}
