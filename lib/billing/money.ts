/** Duração em minutos no formato da plataforma: 100 → "1h40", 180 → "3h", 45 → "45 min". */
export function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Formata centavos como reais: 99900 → "R$ 999,00". */
export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Divide um total em parcelas sem perder centavos.
 * A diferença do arredondamento vai para a última parcela (mesma regra do Asaas).
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error("total inválido");
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error("parcelas inválidas");
  const base = Math.floor(totalCents / count);
  const parts = Array.from({ length: count }, () => base);
  parts[count - 1] += totalCents - base * count;
  return parts;
}

/**
 * Regra de upgrade da Casa Analítica (espelha a função SQL upgrade_quote,
 * usada aqui para pré-visualização e testes).
 */
export function upgradeAmount(input: { targetPriceCents: number; carriedCreditCents: number; paidInstallmentsCents: number }) {
  const credit = input.carriedCreditCents + input.paidInstallmentsCents;
  return { creditCents: credit, amountDueCents: Math.max(input.targetPriceCents - credit, 0) };
}

/** Vencimento padrão de Pix/boleto: hoje + N dias, em AAAA-MM-DD (fuso de São Paulo). */
export function dueDate(daysAhead = 2, now = new Date()): string {
  const d = new Date(now.getTime() + daysAhead * 86400000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
