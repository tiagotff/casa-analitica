"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/auth/actions";

export async function sendContact(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({
    name: z.string().trim().min(2, "Informe seu nome."),
    email: z.email("E-mail inválido."),
    subject: z.string().trim().min(2, "Informe o assunto."),
    message: z.string().trim().min(5, "Escreva sua mensagem.").max(4000),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("contact_messages").insert({ ...parsed.data, user_id: user?.id ?? null });
  if (error) return { error: "Não foi possível enviar agora. Tente de novo em alguns minutos." };
  return { success: "Mensagem enviada. Respondemos por e-mail em até 2 dias úteis." };
}
