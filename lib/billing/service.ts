import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { gateway } from "@/lib/billing/asaas";
import { dueDate } from "@/lib/billing/money";
import type { GatewayEvent, Method } from "@/lib/billing/gateway";

type Buyer = { id: string; email: string; fullName: string; cpfCnpj?: string; phone?: string };

/** Garante o cliente no gateway e guarda o vínculo (CPF fica só em billing_customers). */
export async function ensureBillingCustomer(buyer: Buyer): Promise<string> {
  const db = createAdminClient();
  const { data: existing } = await db.from("billing_customers").select("gateway_customer_id").eq("user_id", buyer.id).maybeSingle();
  if (existing) return existing.gateway_customer_id;
  // Reaproveita o CPF de "Meus dados"; um CPF novo informado no checkout também vai para lá.
  const { data: doc } = await db.from("profile_documents").select("cpf").eq("user_id", buyer.id).maybeSingle();
  if (!buyer.cpfCnpj && doc) buyer = { ...buyer, cpfCnpj: doc.cpf };
  if (!buyer.cpfCnpj) throw new Error("cpf_obrigatorio");
  if (!doc && buyer.cpfCnpj.length === 11) await db.from("profile_documents").insert({ user_id: buyer.id, cpf: buyer.cpfCnpj });

  const customerId = await gateway.ensureCustomer({
    name: buyer.fullName || buyer.email, email: buyer.email, cpfCnpj: buyer.cpfCnpj, phone: buyer.phone, externalReference: buyer.id,
  });
  await db.from("billing_customers").insert({ user_id: buyer.id, gateway: gateway.name, gateway_customer_id: customerId, cpf_cnpj: buyer.cpfCnpj });
  if (buyer.phone) await db.from("profiles").update({ phone: buyer.phone }).eq("id", buyer.id);
  return customerId;
}

/**
 * Gera a cobrança de um contrato pendente (matrícula ou upgrade) e devolve o link
 * da fatura. Os dados do cartão são digitados na fatura do gateway, nunca neste app.
 */
export async function chargeContract(contractId: string, buyer: Buyer): Promise<{ invoiceUrl: string | null; activated: boolean }> {
  const db = createAdminClient();
  const { data: c, error } = await db
    .from("contracts")
    .select("id, user_id, status, amount_due_cents, installments_count, payment_method, plans(name)")
    .eq("id", contractId)
    .single();
  if (error || !c) throw new Error("contrato_nao_encontrado");
  if (c.user_id !== buyer.id || c.status !== "pendente") throw new Error("contrato_invalido");

  // Upgrade totalmente coberto pelo crédito: ativa sem cobrança.
  if (c.amount_due_cents === 0) {
    await activateContract(contractId);
    return { invoiceUrl: null, activated: true };
  }

  const customerId = await ensureBillingCustomer(buyer);
  const planName = (c.plans as unknown as { name: string } | null)?.name ?? "Plano";
  const charge = await gateway.createInstallmentCharge({
    customerId,
    totalCents: c.amount_due_cents,
    installments: c.installments_count,
    method: c.payment_method as Method,
    dueDate: dueDate(2),
    description: `Casa Analítica · ${planName}`,
    externalReference: contractId,
  });

  const { error: insErr } = await db.from("installments").insert(
    charge.payments.map((p) => ({
      contract_id: contractId, number: p.number, amount_cents: p.amountCents, due_date: p.dueDate,
      gateway_payment_id: p.id, invoice_url: p.invoiceUrl,
    })),
  );
  if (insErr) throw new Error("falha_ao_registrar_parcelas: " + insErr.message);
  await db.from("contracts").update({ gateway: gateway.name, gateway_ref: charge.groupId ?? charge.payments[0]?.id }).eq("id", contractId);

  return { invoiceUrl: charge.payments[0]?.invoiceUrl ?? null, activated: false };
}

/**
 * Ativa o contrato e, se for upgrade, cancela no gateway as parcelas que estavam
 * pendentes no contrato anterior (o banco já as marca como canceladas).
 */
export async function activateContract(contractId: string) {
  const db = createAdminClient();
  const { data: c } = await db.from("contracts").select("previous_contract_id").eq("id", contractId).single();

  let toCancel: string[] = [];
  if (c?.previous_contract_id) {
    const { data } = await db.from("installments").select("gateway_payment_id")
      .eq("contract_id", c.previous_contract_id).in("status", ["pendente", "vencida"]);
    toCancel = (data ?? []).map((i) => i.gateway_payment_id).filter(Boolean) as string[];
  }

  const { error } = await db.rpc("activate_contract", { p_contract: contractId });
  if (error) throw new Error("falha_ao_ativar: " + error.message);

  for (const paymentId of toCancel) {
    try {
      await gateway.cancelPayment(paymentId);
    } catch (e) {
      // Fica registrado para o suporte resolver manualmente no painel do gateway.
      await db.from("audit_log").insert({
        action: "falha_cancelar_parcela_upgrade", entity: "installment", entity_id: paymentId,
        data: { contract_id: contractId, erro: String(e) },
      });
    }
  }
}

/** Processa um evento do webhook uma única vez (tabela gateway_events). */
export async function processGatewayEvent(event: GatewayEvent, payload: unknown) {
  const db = createAdminClient();
  const { data: inserted } = await db.from("gateway_events")
    .upsert({ gateway: gateway.name, event_id: event.eventId, event_type: event.rawType, payload }, { onConflict: "gateway,event_id", ignoreDuplicates: true })
    .select("id");
  if (!inserted?.length) return { duplicate: true };
  const eventRowId = inserted[0].id;

  try {
    if (event.subscriptionId) await handleSubscriptionEvent(event);
    else if (event.paymentId) await handleInstallmentEvent(event);
    await db.from("gateway_events").update({ processed_at: new Date().toISOString() }).eq("id", eventRowId);
    return { duplicate: false };
  } catch (e) {
    await db.from("gateway_events").update({ error: String(e) }).eq("id", eventRowId);
    throw e;
  }
}

async function handleInstallmentEvent(event: GatewayEvent) {
  const db = createAdminClient();
  const { data: inst } = await db.from("installments").select("id, contract_id, status").eq("gateway_payment_id", event.paymentId!).maybeSingle();
  if (!inst) return; // cobrança criada fora do app

  const status =
    event.type === "paid" ? "paga" : event.type === "overdue" ? "vencida"
    : event.type === "canceled" ? "cancelada" : event.type === "refunded" ? "estornada" : null;
  if (!status || inst.status === status) return;
  if (inst.status === "cancelada" && status !== "paga") return; // cancelada por upgrade continua cancelada

  await db.from("installments").update({
    status,
    paid_at: status === "paga" ? (event.paidAt ? new Date(event.paidAt).toISOString() : new Date().toISOString()) : null,
    ...(event.invoiceUrl ? { invoice_url: event.invoiceUrl } : {}),
  }).eq("id", inst.id);

  if (status === "paga") {
    const { data: c } = await db.from("contracts").select("status").eq("id", inst.contract_id).single();
    if (c?.status === "pendente") await activateContract(inst.contract_id);
  }
}

async function handleSubscriptionEvent(event: GatewayEvent) {
  const db = createAdminClient();
  const { data: sub } = await db.from("addon_subscriptions").select("id, status").eq("gateway_subscription_id", event.subscriptionId!).maybeSingle();
  if (!sub || sub.status === "cancelada") return;
  if (event.type === "paid") {
    await db.from("addon_subscriptions").update({ status: "ativa", started_at: sub.status === "pendente" ? new Date().toISOString() : undefined }).eq("id", sub.id);
  } else if (event.type === "overdue") {
    await db.from("addon_subscriptions").update({ status: "inadimplente" }).eq("id", sub.id);
  }
}

/** Assina um complemento mensal (Resumão, Inglês, combo). */
export async function subscribeAddon(buyer: Buyer, addonCode: string, method: Method) {
  const db = createAdminClient();
  const { data: addon } = await db.from("addons").select("id, name, monthly_price_cents, available_from, active").eq("code", addonCode).single();
  if (!addon?.active) throw new Error("complemento_indisponivel");
  if (addon.available_from && addon.available_from > dueDate(0)) throw new Error("complemento_ainda_nao_disponivel");

  const { data: active } = await db.rpc("active_contract", { p_user: buyer.id });
  if (!active) throw new Error("exige_matricula_ativa");

  const { data: sub, error } = await db.from("addon_subscriptions")
    .insert({ user_id: buyer.id, addon_id: addon.id, monthly_price_cents: addon.monthly_price_cents })
    .select("id").single();
  if (error) throw new Error(error.code === "23505" ? "complemento_ja_contratado" : error.message);

  const customerId = await ensureBillingCustomer(buyer);
  const created = await gateway.createSubscription({
    customerId, monthlyCents: addon.monthly_price_cents, method, nextDueDate: dueDate(1),
    description: `Casa Analítica · ${addon.name}`, externalReference: sub.id,
  });
  await db.from("addon_subscriptions").update({ gateway_subscription_id: created.subscriptionId }).eq("id", sub.id);
  return created.firstInvoiceUrl;
}

export async function cancelAddon(userId: string, subscriptionId: string, actorId: string) {
  const db = createAdminClient();
  const { data: sub } = await db.from("addon_subscriptions").select("id, user_id, gateway_subscription_id, status").eq("id", subscriptionId).single();
  if (!sub || sub.user_id !== userId || sub.status === "cancelada") throw new Error("assinatura_invalida");
  if (sub.gateway_subscription_id) await gateway.cancelSubscription(sub.gateway_subscription_id);
  await db.from("addon_subscriptions").update({ status: "cancelada", canceled_at: new Date().toISOString() }).eq("id", sub.id);
  await db.from("audit_log").insert({ actor_id: actorId, action: "complemento_cancelado", entity: "addon_subscription", entity_id: sub.id });
}

/**
 * Conclui um pedido da garantia de 7 dias: estorna o que foi pago, cancela o que
 * estava a vencer, cancela complementos e encerra o acesso (finalize_refund).
 * Reembolso de um contrato vindo de upgrade exige análise manual: devolver o
 * upgrade não restaura sozinho as parcelas já canceladas do plano anterior.
 */
export async function processRefund(requestId: string, staffId: string) {
  const db = createAdminClient();
  const { data: r } = await db.from("refund_requests")
    .select("id, status, user_id, contract_id, contracts(previous_contract_id)").eq("id", requestId).single();
  if (!r || r.status !== "solicitado") throw new Error("pedido_invalido");
  if ((r.contracts as unknown as { previous_contract_id: string | null }).previous_contract_id) throw new Error("reembolso_de_upgrade_manual");

  const { data: inst } = await db.from("installments").select("gateway_payment_id, status").eq("contract_id", r.contract_id);
  for (const i of inst ?? []) {
    if (!i.gateway_payment_id) continue;
    if (i.status === "paga") await gateway.refundPayment(i.gateway_payment_id);
    else if (i.status === "pendente" || i.status === "vencida") await gateway.cancelPayment(i.gateway_payment_id);
  }

  const { data: subs } = await db.from("addon_subscriptions").select("id").eq("user_id", r.user_id).in("status", ["pendente", "ativa", "inadimplente"]);
  for (const s of subs ?? []) await cancelAddon(r.user_id, s.id, staffId);

  const { error } = await db.rpc("finalize_refund", { p_request: requestId, p_staff: staffId });
  if (error) throw new Error("falha_ao_concluir_reembolso: " + error.message);
}

export async function refuseRefund(requestId: string, staffId: string, note: string) {
  const db = createAdminClient();
  await db.from("refund_requests").update({ status: "recusado", staff_note: note, handled_by: staffId, handled_at: new Date().toISOString() })
    .eq("id", requestId).eq("status", "solicitado");
  await db.from("audit_log").insert({ actor_id: staffId, action: "reembolso_recusado", entity: "refund_request", entity_id: requestId, data: { motivo: note } });
}
