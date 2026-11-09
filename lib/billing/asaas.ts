import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import type { GatewayEvent, GatewayPayment, Method, PaymentGateway } from "@/lib/billing/gateway";

const BILLING_TYPE: Record<Method, string> = { pix: "PIX", boleto: "BOLETO", cartao: "CREDIT_CARD" };

type AsaasPayment = {
  id: string; value: number; dueDate: string; status: string; invoiceUrl?: string;
  installment?: string; installmentNumber?: number; subscription?: string;
  externalReference?: string; paymentDate?: string; clientPaymentDate?: string; confirmedDate?: string;
};

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(env.asaasUrl() + path, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: env.asaasKey(), "User-Agent": "casa-analitica", ...init.headers },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try { detail = JSON.parse(text).errors?.map((e: { description: string }) => e.description).join("; ") ?? text; } catch {}
    throw new Error(`Asaas ${res.status} em ${path}: ${detail}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

const toCents = (v: number) => Math.round(v * 100);
const toReais = (c: number) => Number((c / 100).toFixed(2));

function toPayment(p: AsaasPayment): GatewayPayment {
  return {
    id: p.id, number: p.installmentNumber ?? 1, amountCents: toCents(p.value),
    dueDate: p.dueDate, invoiceUrl: p.invoiceUrl ?? null, status: p.status,
  };
}

function sameSecret(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const asaas: PaymentGateway = {
  name: "asaas",

  async ensureCustomer(input) {
    const found = await call<{ data: { id: string }[] }>(`/customers?cpfCnpj=${encodeURIComponent(input.cpfCnpj)}`);
    if (found.data?.[0]) return found.data[0].id;
    const created = await call<{ id: string }>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name, email: input.email, cpfCnpj: input.cpfCnpj,
        mobilePhone: input.phone, externalReference: input.externalReference,
        notificationDisabled: false,
      }),
    });
    return created.id;
  },

  async createInstallmentCharge(input) {
    const body: Record<string, unknown> = {
      customer: input.customerId,
      billingType: BILLING_TYPE[input.method],
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
    };
    if (input.installments > 1) {
      body.installmentCount = input.installments;
      body.totalValue = toReais(input.totalCents);
    } else {
      body.value = toReais(input.totalCents);
    }
    const first = await call<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify(body) });
    if (!first.installment) return { groupId: null, payments: [toPayment(first)] };

    const all = await call<{ data: AsaasPayment[] }>(`/installments/${first.installment}/payments`);
    const payments = all.data.map(toPayment).sort((a, b) => a.number - b.number);
    return { groupId: first.installment, payments };
  },

  async cancelPayment(paymentId) {
    await call(`/payments/${paymentId}`, { method: "DELETE" });
  },

  async refundPayment(paymentId) {
    await call(`/payments/${paymentId}/refund`, { method: "POST", body: JSON.stringify({}) });
  },

  async createSubscription(input) {
    const sub = await call<{ id: string }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: input.customerId,
        billingType: BILLING_TYPE[input.method],
        value: toReais(input.monthlyCents),
        nextDueDate: input.nextDueDate,
        cycle: "MONTHLY",
        description: input.description,
        externalReference: input.externalReference,
      }),
    });
    const payments = await call<{ data: AsaasPayment[] }>(`/subscriptions/${sub.id}/payments`);
    return { subscriptionId: sub.id, firstInvoiceUrl: payments.data?.[0]?.invoiceUrl ?? null };
  },

  async cancelSubscription(subscriptionId) {
    await call(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
  },

  parseWebhook(headers, body) {
    const token = headers.get("asaas-access-token") ?? "";
    if (!sameSecret(token, env.asaasWebhookToken())) throw new Error("webhook_nao_autorizado");

    const b = body as { id?: string; event?: string; payment?: AsaasPayment };
    const rawType = b.event ?? "UNKNOWN";
    const p = b.payment;
    const type: GatewayEvent["type"] =
      rawType === "PAYMENT_CONFIRMED" || rawType === "PAYMENT_RECEIVED" ? "paid"
      : rawType === "PAYMENT_OVERDUE" ? "overdue"
      : rawType === "PAYMENT_DELETED" ? "canceled"
      : rawType === "PAYMENT_REFUNDED" || rawType === "PAYMENT_CHARGEBACK_REQUESTED" ? "refunded"
      : rawType === "PAYMENT_CREATED" ? "created" : "other";

    // Asaas envia um id por evento; sem ele, uma chave derivada mantém a idempotência.
    const eventId = b.id ?? `${rawType}:${p?.id ?? "?"}:${p?.status ?? "?"}`;
    return {
      eventId, type, rawType,
      paymentId: p?.id ?? null,
      subscriptionId: p?.subscription ?? null,
      externalReference: p?.externalReference ?? null,
      paidAt: p?.confirmedDate ?? p?.paymentDate ?? p?.clientPaymentDate ?? null,
      invoiceUrl: p?.invoiceUrl ?? null,
    };
  },
};

export const gateway: PaymentGateway = asaas;
