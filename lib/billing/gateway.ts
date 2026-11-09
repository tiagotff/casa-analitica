/**
 * Contrato do gateway de pagamento. O app só conversa com esta interface;
 * trocar Asaas por outro gateway é escrever outra implementação.
 */
export type Method = "pix" | "boleto" | "cartao";

export type GatewayCustomerInput = { name: string; email: string; cpfCnpj: string; phone?: string; externalReference: string };

export type GatewayPayment = {
  id: string;
  number: number;
  amountCents: number;
  dueDate: string;        // AAAA-MM-DD
  invoiceUrl: string | null;
  status: string;
};

export type InstallmentChargeInput = {
  customerId: string;
  totalCents: number;
  installments: number;
  method: Method;
  dueDate: string;
  description: string;
  externalReference: string; // id do contrato
};

export type SubscriptionInput = {
  customerId: string;
  monthlyCents: number;
  method: Method;
  nextDueDate: string;
  description: string;
  externalReference: string; // id da assinatura do complemento
};

/** Evento normalizado vindo do webhook. */
export type GatewayEvent = {
  eventId: string;
  type: "paid" | "overdue" | "canceled" | "refunded" | "created" | "other";
  rawType: string;
  paymentId: string | null;
  subscriptionId: string | null;
  externalReference: string | null;
  paidAt: string | null;
  invoiceUrl: string | null;
};

export interface PaymentGateway {
  readonly name: string;
  ensureCustomer(input: GatewayCustomerInput): Promise<string>;
  /** Cria a cobrança (à vista ou parcelada) e devolve todas as parcelas geradas. */
  createInstallmentCharge(input: InstallmentChargeInput): Promise<{ groupId: string | null; payments: GatewayPayment[] }>;
  /** Cancela cobranças ainda não pagas (usado no upgrade e no reembolso). */
  cancelPayment(paymentId: string): Promise<void>;
  /** Estorna integralmente uma cobrança já paga (garantia de 7 dias). */
  refundPayment(paymentId: string): Promise<void>;
  createSubscription(input: SubscriptionInput): Promise<{ subscriptionId: string; firstInvoiceUrl: string | null }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  /** Valida a origem do webhook e converte o corpo em evento normalizado. */
  parseWebhook(headers: Headers, body: unknown): GatewayEvent;
}
