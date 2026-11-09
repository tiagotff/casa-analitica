"use client";

import { useActionState, useState } from "react";
import { brl } from "@/lib/billing/money";
import { startUpgrade } from "./actions";

export type Quote = {
  code: string; name: string; all_formations: boolean; target_price_cents: number; credit_cents: number;
  pending_cents: number; amount_due_cents: number; new_access_months: number | null;
};

const key = (q: Quote) => `${q.code}|${q.all_formations ? "todas" : "uma"}`;

export function UpgradeForm({ contractId, quotes }: { contractId: string; quotes: Quote[] }) {
  const [state, action, pending] = useActionState(startUpgrade, undefined);
  const [option, setOption] = useState(quotes[0] ? key(quotes[0]) : "");
  const [count, setCount] = useState(12);
  const q = quotes.find((x) => key(x) === option);
  if (!q) return <p className="muted">Você já está no plano mais completo.</p>;

  return (
    <form action={action} className="form" style={{ maxWidth: "none" }}>
      <input type="hidden" name="contract" value={contractId} />
      <div className="field">
        <label htmlFor="option">Novo plano</label>
        <select id="option" name="option" value={option} onChange={(e) => setOption(e.target.value)}>
          {quotes.map((x) => (
            <option key={key(x)} value={key(x)}>{x.name} · {x.all_formations ? "todas as formações" : "mesma formação"} · {brl(x.target_price_cents)}</option>
          ))}
        </select>
      </div>
      <dl className="kv num">
        <dt>Preço vigente do novo plano</dt><dd>{brl(q.target_price_cents)}</dd>
        <dt>Valor já pago (crédito)</dt><dd>− {brl(q.credit_cents)}</dd>
        <dt>Parcelas pendentes do plano atual</dt><dd>{brl(q.pending_cents)} não serão cobradas</dd>
        <dt>Valor a pagar</dt><dd style={{ fontSize: "1.3rem", color: "var(--blue)" }}>{brl(q.amount_due_cents)}</dd>
        <dt>Novo acesso</dt><dd>{q.new_access_months ? `${q.new_access_months} meses a partir da confirmação` : "Vitalício condicionado"}</dd>
      </dl>
      {q.amount_due_cents > 0 ? (
        <div className="row">
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="method">Forma de pagamento</label>
            <select id="method" name="method" defaultValue="cartao"><option value="cartao">Cartão de crédito</option><option value="pix">Pix</option><option value="boleto">Boleto</option></select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="installments">Parcelas</label>
            <select id="installments" name="installments" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} × {brl(Math.floor(q.amount_due_cents / n))}</option>)}
            </select>
          </div>
        </div>
      ) : (
        <><input type="hidden" name="method" value="pix" /><input type="hidden" name="installments" value="1" /></>
      )}
      {state?.error && <p className="alert error" role="alert">{state.error}</p>}
      <div><button className="btn" disabled={pending}>{pending ? "Processando…" : q.amount_due_cents === 0 ? "Confirmar upgrade" : "Fazer upgrade"}</button></div>
    </form>
  );
}
