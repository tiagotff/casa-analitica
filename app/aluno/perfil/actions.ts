"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { isValidCpf } from "@/lib/watermark";
import type { FormState } from "@/lib/auth/actions";

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Entre novamente." };
  const parsed = z.object({ full_name: z.string().trim().min(3, "Informe o nome completo."), phone: z.string().trim().max(20).optional() })
    .safeParse({ full_name: form.get("full_name"), phone: form.get("phone") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: "Não foi possível salvar agora." };

  // CPF: informado uma única vez (vai na marca d'água dos materiais). Troca só pelo suporte.
  const cpf = String(form.get("cpf") ?? "").replace(/\D/g, "");
  if (cpf) {
    if (!isValidCpf(cpf)) return { error: "CPF inválido. Confira os números." };
    const { data: existing } = await supabase.from("profile_documents").select("cpf").eq("user_id", user.id).maybeSingle();
    if (!existing) {
      const { error: e } = await supabase.from("profile_documents").insert({ user_id: user.id, cpf });
      if (e) return { error: "Não foi possível salvar o CPF." };
    }
  }
  revalidatePath("/aluno/perfil");
  const back = String(form.get("voltar") ?? "");
  if (cpf && back.startsWith("/") && !back.startsWith("//")) redirect(back);
  return { success: "Dados salvos." };
}
