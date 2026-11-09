import { test } from "node:test";
import assert from "node:assert/strict";
import { splitInstallments, upgradeAmount, brl } from "./money.ts";

test("divide R$ 999,00 em 12 sem perder centavos", () => {
  const parts = splitInstallments(99900, 12);
  assert.equal(parts.length, 12);
  assert.equal(parts.reduce((a, b) => a + b, 0), 99900);
  assert.deepEqual(parts.slice(0, 11), Array(11).fill(8325));
});

test("divide valor que não fecha: diferença vai para a última", () => {
  const parts = splitInstallments(100000, 3);
  assert.deepEqual(parts, [33333, 33333, 33334]);
});

test("upgrade do 1º lote com 3 parcelas pagas para Continuidade", () => {
  const r = upgradeAmount({ targetPriceCents: 562800, carriedCreditCents: 0, paidInstallmentsCents: 3 * 8325 });
  assert.equal(r.creditCents, 24975);
  assert.equal(r.amountDueCents, 537825);
});

test("upgrade em cadeia carrega o crédito anterior", () => {
  // Essencial pago com crédito de 99900 do lote + 2 parcelas de 39900, indo para Legado
  const r = upgradeAmount({ targetPriceCents: 838800, carriedCreditCents: 99900, paidInstallmentsCents: 2 * 39900 });
  assert.equal(r.amountDueCents, 838800 - 99900 - 79800);
});

test("valor a pagar nunca fica negativo", () => {
  assert.equal(upgradeAmount({ targetPriceCents: 100, carriedCreditCents: 500, paidInstallmentsCents: 0 }).amountDueCents, 0);
});

test("formata em reais", () => {
  assert.match(brl(99900), /999,00/);
});

test("formata a duração das aulas", async () => {
  const { duration } = await import("./money.ts");
  assert.equal(duration(100), "1h40");
  assert.equal(duration(180), "3h");
  assert.equal(duration(45), "45 min");
});
