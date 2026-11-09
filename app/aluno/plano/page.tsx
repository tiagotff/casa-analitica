import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { getMyContracts, fmtDate, INSTALLMENT_PILL } from "@/lib/student";
import { brl } from "@/lib/billing/money";
import { UpgradeForm, type Quote } from "./UpgradeForm";
import { AddonForm } from "./AddonForm";
import { RefundForm } from "./RefundForm";
import { unsubscribe } from "./actions";

export const metadata = { title: "Meu plano" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const user = await requireRole("aluno", "admin");
  const supabase = await createClient();
  const { active, pending } = await getMyContracts(user.id);
  const [{ data: plans }, { data: addons }, { data: subs }] = await Promise.all([
    supabase.from("plan_availability").select("code, name, rank, on_sale").eq("kind", "plano").order("rank"),
    supabase.from("addons").select("id, code, name, description, monthly_price_cents, available_from").order("monthly_price_cents"),
    supabase.from("addon_subscriptions").select("id, addon_id, status, monthly_price_cents, started_at").eq("user_id", user.id).neq("status", "cancelada"),
  ]);

  const plan = active?.plans as unknown as { code: string; name: string; rank: number } | null;
  let quotes: Quote[] = [];
  if (active && plan) {
    // Opções: ampliar para todas as formações na mesma oferta; planos superiores com o mesmo escopo ou ampliando.
    const options: { code: string; name: string; all: boolean }[] = [];
    if (!active.all_formations) options.push({ code: plan.code, name: plan.name, all: true });
    for (const t of (plans ?? []).filter((p) => p.on_sale && p.rank > plan.rank)) {
      if (!active.all_formations) options.push({ code: t.code, name: t.name, all: false });
      options.push({ code: t.code, name: t.name, all: true });
    }
    quotes = (await Promise.all(options.map(async (o) => {
      const { data } = await supabase.rpc("upgrade_quote", { p_contract: active.id, p_target_code: o.code, p_all_formations: o.all });
      const row = Array.isArray(data) ? data[0] : data;
      return row ? ({ ...row, code: o.code, name: o.name } as Quote) : null;
    }))).filter(Boolean) as Quote[];
  }
  const refund = active ? ([] as unknown[]).concat(active.refund_requests ?? [])[0] as { status: string; requested_at: string; staff_note: string | null } | undefined : undefined;
  const deadline = active?.activated_at ? new Date(new Date(active.activated_at).getTime() + 7 * 86400000) : null;
  const inGuarantee = deadline ? deadline.getTime() > Date.now() : false;
  const formationNames = active?.all_formations ? "Todas as formações" : active?.contract_formations.map((cf) => (cf.formations as unknown as { name: string }).name).join(", ");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <h1>Meu plano</h1>
        {status && <p className="alert success">Recebemos sua solicitação. O plano é atualizado assim que o pagamento é confirmado.</p>}
      </div>

      {!active && !pending && <div className="card"><p>Você ainda não tem um plano.</p><div><Link className="btn" href="/planos">Ver planos</Link></div></div>}

      {active && plan && (
        <section className="card">
          <span className="eyebrow">Plano atual</span>
          <h2>{plan.name}</h2>
          <p className="muted">{formationNames} · conteúdo liberado semanalmente</p>
          <dl className="kv num">
            <dt>Preço total contratado</dt><dd>{brl(active.list_price_cents)}</dd>
            {active.upgrade_credit_cents > 0 && <><dt>Crédito de upgrade aplicado</dt><dd>− {brl(active.upgrade_credit_cents)}</dd></>}
            <dt>Parcelado em</dt><dd>{active.installments_count}×</dd>
            <dt>Acesso</dt><dd>{fmtDate(active.access_starts_at)} → {active.access_ends_at ? fmtDate(active.access_ends_at) : "vitalício condicionado"}</dd>
          </dl>
        </section>
      )}

      {[pending, active].filter(Boolean).map((c) => (
        <section key={c!.id} className="stack">
          <h2>Parcelas {c!.status === "pendente" ? "da nova contratação" : "do plano atual"}</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {c!.installments.map((i) => {
                const [cls, label] = INSTALLMENT_PILL[i.status];
                return (
                  <tr key={i.id}>
                    <td className="num">{i.number}</td><td className="num">{fmtDate(i.due_date)}</td><td className="num">{brl(i.amount_cents)}</td>
                    <td><span className={`pill ${cls}`}>{label}</span></td>
                    <td>{i.invoice_url && (i.status === "pendente" || i.status === "vencida") && <a href={i.invoice_url} target="_blank" rel="noopener noreferrer">Pagar</a>}</td>
                  </tr>
                );
              })}
              {!c!.installments.length && <tr><td colSpan={5} className="muted">Sem parcelas (upgrade coberto pelo crédito).</td></tr>}
            </tbody>
          </table></div>
        </section>
      ))}

      {active && (refund || inGuarantee) && (
        <section className="card">
          <h2>Garantia de 7 dias</h2>
          {refund ? (
            <p>
              <span className={`pill ${refund.status === "concluido" ? "ok" : refund.status === "recusado" ? "bad" : "warn"}`}>
                {refund.status === "solicitado" ? "Reembolso em análise" : refund.status === "concluido" ? "Reembolso concluído" : "Reembolso recusado"}
              </span>{" "}
              <span className="note">pedido em {fmtDate(refund.requested_at)}{refund.staff_note ? ` · ${refund.staff_note}` : ""}</span>
            </p>
          ) : (
            <RefundForm contractId={active.id} deadline={deadline!.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} />
          )}
        </section>
      )}

      {active && !pending && (
        <section className="card">
          <h2>Fazer upgrade</h2>
          <p className="muted">O valor já pago é descontado do preço do novo plano e o acesso recomeça a contar na confirmação.</p>
          {refund?.status === "solicitado"
            ? <p className="alert error">Há um pedido de reembolso em análise. O upgrade fica disponível depois que ele for concluído ou recusado.</p>
            : <UpgradeForm contractId={active.id} quotes={quotes} />}
        </section>
      )}

      <section className="stack">
        <h2>Complementos</h2>
        <div className="grid">
          {(addons ?? []).map((a) => {
            const sub = subs?.find((s) => s.addon_id === a.id);
            const soon = a.available_from && a.available_from > today;
            return (
              <div key={a.id} className="card">
                <div className="row between"><h3>{a.name}</h3>
                  {sub ? <span className={`pill ${sub.status === "ativa" ? "ai" : sub.status === "inadimplente" ? "bad" : "warn"}`}>{sub.status === "ativa" ? "Ativo" : sub.status === "inadimplente" ? "Pagamento em atraso" : "Aguardando pagamento"}</span>
                       : soon ? <span className="pill off">Em breve</span> : null}
                </div>
                <p className="muted">{a.description}</p>
                <span className="num" style={{ fontWeight: 600 }}>{brl(a.monthly_price_cents)}/mês</span>
                {sub ? (
                  <form action={unsubscribe.bind(null, sub.id)}><button className="btn ghost">Cancelar complemento</button></form>
                ) : !soon && active ? (
                  <AddonForm code={a.code} label="Contratar" />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
