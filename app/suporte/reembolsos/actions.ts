"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { processRefund, refuseRefund } from "@/lib/billing/service";

export async function approveRefund(requestId: string) {
  const staff = await requireRole("suporte", "admin");
  await processRefund(requestId, staff.id);
  revalidatePath("/suporte/reembolsos");
}

export async function denyRefund(requestId: string, form: FormData) {
  const staff = await requireRole("suporte", "admin");
  const note = String(form.get("note") ?? "").trim() || "Fora das condições da garantia.";
  await refuseRefund(requestId, staff.id, note);
  revalidatePath("/suporte/reembolsos");
}
