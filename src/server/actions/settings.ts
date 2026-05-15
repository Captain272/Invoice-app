"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "./auth-helper";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function updateProfile(input: { name: string; password?: string }) {
  const session = await requireSession();
  if (input.password) {
    if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.updateUserById(session.user.id, {
      password: input.password,
    });
    if (error) throw new Error(error.message);
  }
  if (input.name) {
    await prisma.user.update({ where: { id: session.user.id }, data: { name: input.name } });
  }
  revalidatePath("/settings");
}

export async function updateAppSetting(key: string, value: string) {
  await requireSession();
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  revalidatePath("/settings");
}
