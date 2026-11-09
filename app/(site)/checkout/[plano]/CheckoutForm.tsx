"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { brl, splitInstallments } from "@/lib/billing/money";
import { startCheckout } from "./actions";

type Props = {
  planCode: string;
  priceCents: number;      // uma formação
  allPriceCents: number;   // todas as formações (multiplicador definido no admin)
  maxInstallments: number;
  formations: { id: string; name: string }[];
  needsCpf: boolean;
  initialScope: "uma" | "todas";
  initialFormation?: string;
};

export function CheckoutForm(p: Props) {
  const [state, action, pending] = useActionState(startCheckout, undefined);
  const [scope, setScope] = useState(p.initialScope);
  const [method, setMethod] = useState("cartao");
  const [count, setCount] = useState(p.maxInstallments);
  const total = scope === "todas" ? p.allPriceCents : p.priceCents;
  const parts = splitInstallments(total, count);
  const separate = p.priceCents * p.formations.length;

  return (
    <form action={action} className="form">
      <input type="hidden" name="plan" value={p.planCode} />
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field" style={{ fontWeight: 600, marginBottom: 8 }}>O que você quer contratar?</legend>
        <label className="card" style={{ flexDirection: "row", gap: 10, cursor: "pointer", borderColor: scope === "uma" ? "var(--blue)" : undefined }}>
          <input type="radio" name="scope" value="uma" checked={scope === "uma"} onChange={() => setScope("uma")} style={{ width: "auto" }} />
          <span><strong>Uma formação</strong> · {brl(p.priceCents)}<br /><span className="note">Acesso apenas à formação escolhida.</span></span>
        </label>
        <label className="card" style={{ flexDirection: "row", gap: 10, cursor: "pointer", borderColor: scope === "todas" ? "var(--blue)" : undefined }}>
          <input type="radio" name="scope" value="todas" checked={scope === "todas"} onChange={() => setScope("todas")} style={{ width: "auto" }} />
          <span><strong>Todas as {p.formations.length} formações</strong> · {brl(p.allPriceCents)}<br />
            <span className="note">Condição especial para levar todas, em vez de {brl(separate)} separadas.</span></span>
        </label>
      </fieldset>

      {scope === "uma" && (
        <div className="field">
          <label htmlFor="formation">Formação</label>
          <select id="formation" name="formation" required defaultValue={p.initialFormation ?? ""}>
            <option value="" disabled>Escolha a formação</option>
            {p.formations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      {p.needsCpf && (
        <>
          <div className="field"><label htmlFor="cpf">CPF</label><input id="cpf" name="cpf" inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" /></div>
          <div className="field"><label htmlFor="phone">Celular</label><input id="phone" name="phone" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" /></div>
        </>
      )}
      <div className="field">
        <label htmlFor="method">Forma de pagamento</label>
        <select id="method" name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cartao">Cartão de crédito</option>
          <option value="pix">Pix</option>
          <option value="boleto">Boleto</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="installments">Parcelas</label>
        <select id="installments" name="installments" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {Array.from({ length: p.maxInstallments }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n === 1 ? `À vista: ${brl(total)}` : `${n} × ${brl(Math.floor(total / n))}`}</option>
          ))}
        </select>
        {method !== "cartao" && count > 1 && <span className="note">Você recebe uma cobrança de {method === "pix" ? "Pix" : "boleto"} por mês, a primeira com vencimento em 2 dias.</span>}
      </div>
      <dl className="kv num">
        <dt>Preço total</dt><dd>{brl(total)}</dd>
        <dt>{count} parcela{count > 1 ? "s" : ""}</dt><dd>{count > 1 ? `${count - 1} × ${brl(parts[0])} + ${brl(parts[count - 1])}` : brl(parts[0])}</dd>
      </dl>
      <ul className="note" style={{ margin: 0, paddingLeft: 18 }}>
        <li>O conteúdo é liberado semanalmente: uma aula nova toda segunda-feira.</li>
        <li>Garantia de 7 dias: peça a devolução integral em até 7 dias depois da liberação do acesso. <Link href="/garantia">Como funciona</Link></li>
      </ul>
      {state?.error && <p className="alert error" role="alert">{state.error}</p>}
      <div><button className="btn" disabled={pending}>{pending ? "Gerando cobrança…" : "Ir para o pagamento"}</button></div>
      <p className="note">Você conclui o pagamento na página segura do Asaas. Os dados do cartão não passam pela Casa Analítica.</p>
    </form>
  );
}
