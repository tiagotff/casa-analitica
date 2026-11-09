"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { cancelAddon } from "@/lib/billing/service";

export async function staffCancelAddon(userId: string, subscriptionId: string) {
  const staff = await requireRole("suporte", "admin");
  await cancelAddon(userId, subscriptionId, staff.id);
  revalidatePath(`/suporte/alunos/${userId}`);
}
