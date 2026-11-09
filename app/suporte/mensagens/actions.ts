"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

export async function setMessageStatus(id: string, status: "em_atendimento" | "resolvida") {
  const staff = await requireRole("suporte", "admin");
  const supabase = await createClient();
  await supabase.from("contact_messages").update({ status, handled_by: staff.id }).eq("id", id);
  revalidatePath("/suporte/mensagens");
}
