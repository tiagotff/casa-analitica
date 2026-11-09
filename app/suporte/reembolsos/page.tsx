import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { fmtDate } from "@/lib/student";
import { brl } from "@/lib/billing/money";
import { approveRefund, denyRefund } from "./actions";

export const metadata = { title: "Reembolsos" };

export default async function Page() {
  await requireRole("suporte", "admin");
  const supabase = await createClient();
  const { data: rows } = await supabase.from("refund_requests")
    .select("id, status, reason, requested_at, refunded_cents, staff_note, user_id, contracts(activated_at, all_formations, previous_contract_id, plans(name), installments(amount_cents, status)), profiles!refund_requests_user_id_fkey(full_name, email)")
    .order("requested_at", { ascending: false });

  return (
    <>
      <h1>Reembolsos da garantia</h1>
      <p className="muted">Pedidos feitos em até 7 dias da liberação do acesso. Ao aprovar, o app estorna o que foi pago, cancela o que estava a vencer e encerra o acesso.</p>
      <div className="stack">
        {(rows ?? []).map((r) => {
          const c = r.contracts as unknown as { activated_at: string; all_formations: boolean; previous_contract_id: string | null; plans: { name: string }; installments: { amount_cents: number; status: string }[] };
          const p = r.profiles as unknown as { full_name: string; email: string };
          const paid = c.installments.filter((i) => i.status === "paga").reduce((s, i) => s + i.amount_cents, 0);
          return (
            <article key={r.id} className="card">
              <div className="row between">
                <h3><Link href={`/suporte/alunos/${r.user_id}`}>{p.full_name || p.email}</Link> · {c.plans.name}{c.all_formations ? " (todas as formações)" : ""}</h3>
                <span className={`pill ${r.status === "concluido" ? "ok" : r.status === "recusado" ? "bad" : "warn"}`}>{r.status}</span>
              </div>
              <p className="note num">Acesso liberado em {fmtDate(c.activated_at)} · pedido em {fmtDate(r.requested_at)} · pago até agora {brl(paid)}{r.refunded_cents != null && ` · devolvido ${brl(r.refunded_cents)}`}</p>
              {r.reason && <p>“{r.reason}”</p>}
              {r.staff_note && <p className="note">Nota da equipe: {r.staff_note}</p>}
              {r.status === "solicitado" && (c.previous_contract_id
                ? <p className="alert error">Este plano veio de um upgrade. Trate o estorno no painel do Asaas e registre a decisão com o administrador.</p>
                : (
                  <div className="row">
                    <form action={approveRefund.bind(null, r.id)}><button className="btn">Aprovar e estornar</button></form>
                    <form action={denyRefund.bind(null, r.id)} className="row">
                      <input name="note" placeholder="Motivo da recusa" aria-label="Motivo da recusa" style={{ minWidth: 220 }} />
                      <button className="btn ghost">Recusar</button>
                    </form>
                  </div>
                ))}
            </article>
          );
        })}
        {!rows?.length && <p className="muted">Nenhum pedido de reembolso.</p>}
      </div>
    </>
  );
}
