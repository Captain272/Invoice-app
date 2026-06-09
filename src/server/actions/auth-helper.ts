import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { can, type Permission } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type CurrentSession = { user: CurrentUser };

function parseAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function ensureUserProvisioned(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser?.email) return null;

  const email = authUser.email.toLowerCase();
  const adminEmails = parseAdminEmails();
  const isAdminEmail = adminEmails.includes(email);
  const displayName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    (authUser.user_metadata?.name as string | undefined) ??
    authUser.email.split("@")[0];

  const existing =
    (await prisma.user.findUnique({ where: { id: authUser.id } })) ??
    (await prisma.user.findUnique({ where: { email } }));

  if (!existing) {
    const created = await prisma.user.create({
      data: {
        id: authUser.id,
        email,
        name: displayName,
        role: isAdminEmail ? "SUPER_ADMIN" : "VIEWER",
        status: "ACTIVE",
        lastLoginAt: new Date(),
      },
    });
    return { id: created.id, email: created.email, name: created.name, role: created.role };
  }

  const patch: { id?: string; lastLoginAt: Date; role?: Role } = {
    lastLoginAt: new Date(),
  };
  if (existing.id !== authUser.id) patch.id = authUser.id;
  if (isAdminEmail && existing.role !== "SUPER_ADMIN") patch.role = "SUPER_ADMIN";

  const updated = await prisma.user.update({
    where: { email },
    data: patch,
  });
  return { id: updated.id, email: updated.email, name: updated.name, role: updated.role };
}

// Wrapped in React cache() so the auth.getUser() network call + user lookup run
// once per request, even though the layout and the page both call getSession().
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const row = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (row && row.status === "ACTIVE") {
    // Promote on every load if the allowlist says they should be SUPER_ADMIN.
    const isAdminEmail = parseAdminEmails().includes(row.email.toLowerCase());
    if (isAdminEmail && row.role !== "SUPER_ADMIN") {
      const promoted = await prisma.user.update({
        where: { id: row.id },
        data: { role: "SUPER_ADMIN" },
      });
      return { id: promoted.id, email: promoted.email, name: promoted.name, role: promoted.role };
    }
    return { id: row.id, email: row.email, name: row.name, role: row.role };
  }
  return ensureUserProvisioned();
});

export async function getSession(): Promise<CurrentSession | null> {
  const user = await getCurrentUser();
  return user ? { user } : null;
}

export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requirePerm(permission: Permission): Promise<CurrentSession> {
  const session = await requireSession();
  if (!can(session.user.role, permission)) {
    throw new Error(`Forbidden: missing ${permission}`);
  }
  return session;
}
