"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { chargeContract, subscribeAddon, cancelAddon } from "@/lib/billing/service";
import { friendlyError } from "@/lib/billing/errors";
import type { FormState } from "@/lib/auth/actions";

export async function startUpgrade(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const parsed = z.object({
    contract: z.uuid(), option: z.string().regex(/^[a-z0-9]+\|(uma|todas)$/),
    method: z.enum(["pix", "boleto", "cartao"]), installments: z.coerce.number().int().min(1).max(12),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Confira os dados do upgrade." };

  const [target, scope] = parsed.data.option.split("|");
  const supabase = await createClient();
  const { data: newContract, error } = await supabase.rpc("start_upgrade", {
    p_contract: parsed.data.contract, p_target_code: target,
    p_method: parsed.data.method, p_installments: parsed.data.installments,
    p_all_formations: scope === "todas",
  });
  if (error) return { error: friendlyError(error) };

  let invoiceUrl: string | null;
  try {
    ({ invoiceUrl } = await chargeContract(newContract as string, { id: user.id, email: user.email, fullName: user.fullName }));
  } catch (e) {
    return { error: friendlyError(e) };
  }
  redirect(invoiceUrl ?? "/aluno/plano?status=upgrade");
}

export async function subscribe(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const addon = String(form.get("addon") ?? "");
  const method = z.enum(["pix", "boleto", "cartao"]).safeParse(form.get("method"));
  if (!method.success) return { error: "Escolha a forma de pagamento." };
  let url: string | null;
  try {
    url = await subscribeAddon({ id: user.id, email: user.email, fullName: user.fullName }, addon, method.data);
  } catch (e) {
    return { error: friendlyError(e) };
  }
  redirect(url ?? "/aluno/plano");
}

export async function unsubscribe(subscriptionId: string) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  await cancelAddon(user.id, subscriptionId, user.id);
  revalidatePath("/aluno/plano");
  revalidatePath("/aluno/resumao");
}

export async function askRefund(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const contract = z.uuid().safeParse(form.get("contract"));
  if (!contract.success) return { error: "Contrato inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_refund", { p_contract: contract.data, p_reason: String(form.get("reason") ?? "").slice(0, 1000) });
  if (error) return { error: friendlyError(error) };
  revalidatePath("/aluno/plano");
  return { success: "Pedido registrado. A equipe confirma em até 2 dias úteis e o estorno sai pela mesma forma de pagamento." };
}
