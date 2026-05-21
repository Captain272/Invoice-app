"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "./auth-helper";
import { logAudit } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const userSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF", "VIEWER"]),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  password: z.string().min(8).optional(),
});

export async function createUser(input: z.input<typeof userSchema>) {
  const session = await requirePerm("users:write");
  const data = userSchema.parse(input);
  if (!data.password) throw new Error("Password is required for new users");

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Server is missing Supabase admin credentials (SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL).");
  }

  const email = data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error("A user with this email already exists");

  const admin = createSupabaseAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.name },
  });
  if (error || !created?.user) {
    const msg = error?.message ?? "Failed to create auth user";
    if (/already.*registered|exists/i.test(msg)) {
      throw new Error("Email already registered in Supabase Auth. Delete it there or use a different email.");
    }
    throw new Error(`Supabase createUser failed: ${msg}`);
  }

  try {
    const u = await prisma.user.create({
      data: {
        id: created.user.id,
        name: data.name,
        email,
        role: data.role,
        status: data.status,
      },
    });
    await logAudit({
      userId: session.user.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: u.id,
      metadata: { email, role: data.role },
    });
    revalidatePath("/users");
    return u;
  } catch (e) {
    // Roll back the orphan Supabase auth user so the email can be reused.
    await admin.auth.admin.deleteUser(created.user.id).catch((cleanupErr) => {
      console.error("Failed to clean up orphan Supabase user", created.user.id, cleanupErr);
    });
    throw new Error(`Database insert failed after auth user was created: ${(e as Error).message}`);
  }
}

export async function updateUser(id: string, input: Partial<z.input<typeof userSchema>>) {
  const session = await requirePerm("users:write");
  const data = userSchema.partial().parse(input);

  const patch: Record<string, unknown> = {};
  if (data.name) patch.name = data.name;
  if (data.email) patch.email = data.email.toLowerCase();
  if (data.role) patch.role = data.role;
  if (data.status) patch.status = data.status;

  if (data.password || data.email) {
    const admin = createSupabaseAdminClient();
    const attrs: { password?: string; email?: string } = {};
    if (data.password) attrs.password = data.password;
    if (data.email) attrs.email = data.email;
    const { error } = await admin.auth.admin.updateUserById(id, attrs);
    if (error) throw new Error(error.message);
  }

  await prisma.user.update({ where: { id }, data: patch });
  await logAudit({ userId: session.user.id, action: "USER_UPDATED", entityType: "User", entityId: id });
  revalidatePath("/users");
}

export async function deleteUser(id: string) {
  const session = await requirePerm("users:write");
  if (id === session.user.id) throw new Error("You cannot delete yourself");

  const admin = createSupabaseAdminClient();
  await admin.auth.admin.deleteUser(id).catch(() => {});

  await prisma.user.delete({ where: { id } });
  await logAudit({ userId: session.user.id, action: "USER_DELETED", entityType: "User", entityId: id });
  revalidatePath("/users");
}
