"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { chargeContract } from "@/lib/billing/service";
import { friendlyError } from "@/lib/billing/errors";
import { isValidCpf } from "@/lib/watermark";
import type { FormState } from "@/lib/auth/actions";

const Schema = z.object({
  plan: z.string().min(1),
  scope: z.enum(["uma", "todas"]).default("uma"),
  formation: z.uuid().optional(),
  method: z.enum(["pix", "boleto", "cartao"]),
  installments: z.coerce.number().int().min(1).max(12),
  cpf: z.string().transform((v) => v.replace(/\D/g, "")).optional(),
  phone: z.string().transform((v) => v.replace(/\D/g, "")).optional(),
});

export async function startCheckout(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const parsed = Schema.safeParse(Object.fromEntries([...form].filter(([, v]) => v !== "")));
  if (!parsed.success) return { error: "Confira os dados do formulário." };
  const d = parsed.data;
  if (d.cpf && !isValidCpf(d.cpf)) return { error: "CPF inválido. Confira os números." };
  if (d.scope === "uma" && !d.formation) return { error: "Escolha a formação." };

  const supabase = await createClient();
  const { data: contractId, error } = await supabase.rpc("start_checkout", {
    p_plan_code: d.plan, p_formations: d.scope === "uma" ? [d.formation] : [], p_method: d.method, p_installments: d.installments,
    p_all_formations: d.scope === "todas",
  });
  if (error) return { error: friendlyError(error) };

  let invoiceUrl: string | null;
  try {
    ({ invoiceUrl } = await chargeContract(contractId as string, { id: user.id, email: user.email, fullName: user.fullName, cpfCnpj: d.cpf, phone: d.phone }));
  } catch (e) {
    return { error: friendlyError(e) };
  }
  redirect(invoiceUrl ?? "/aluno/plano?status=ativado");
}
