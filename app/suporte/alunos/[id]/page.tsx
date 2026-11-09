import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { fmtDate, INSTALLMENT_PILL } from "@/lib/student";
import { brl } from "@/lib/billing/money";
import { staffCancelAddon } from "./actions";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole("suporte", "admin");
  const supabase = await createClient();
  const [{ data: p }, { data: roles }, { data: billing }, { data: contracts }, { data: subs }, { count: lessonsDone }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone, created_at").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase.from("billing_customers").select("cpf_cnpj, gateway_customer_id").eq("user_id", id).maybeSingle(),
    supabase.from("contracts").select("id, status, list_price_cents, upgrade_credit_cents, amount_due_cents, installments_count, payment_method, created_at, access_starts_at, access_ends_at, plans(name), contract_formations(formations(name)), installments(id, number, amount_cents, due_date, status, invoice_url, paid_at, gateway_payment_id)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("addon_subscriptions").select("id, status, monthly_price_cents, started_at, addons(name)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("lesson_progress").select("lesson_id", { count: "exact", head: true }).eq("user_id", id).not("completed_at", "is", null),
  ]);
  if (!p) notFound();
  const maskedCpf = billing?.cpf_cnpj ? billing.cpf_cnpj.replace(/^(\d{3})\d+(\d{2})$/, "$1.***.***-$2") : "—";

  return (
    <>
      <Link href="/suporte" className="note">← Alunos</Link>
      <div className="row between">
        <h1>{p.full_name || p.email}</h1>
        <div className="row">{(roles ?? []).map((r) => <span key={r.role} className="pill info">{ROLE_LABEL[r.role as Role]}</span>)}</div>
      </div>
      <dl className="kv card num" style={{ maxWidth: 560 }}>
        <dt>E-mail</dt><dd>{p.email}</dd>
        <dt>Celular</dt><dd>{p.phone ?? "—"}</dd>
        <dt>CPF</dt><dd>{maskedCpf}</dd>
        <dt>Cliente no Asaas</dt><dd>{billing?.gateway_customer_id ?? "—"}</dd>
        <dt>Cadastro</dt><dd>{fmtDate(p.created_at)}</dd>
        <dt>Aulas concluídas</dt><dd>{lessonsDone ?? 0}</dd>
      </dl>

      <h2>Contratos</h2>
      {(contracts ?? []).map((c) => (
        <section key={c.id} className="card">
          <div className="row between">
            <h3>{(c.plans as unknown as { name: string }).name} · {c.contract_formations.map((cf) => (cf.formations as unknown as { name: string }).name).join(", ") || "todas as formações"}</h3>
            <span className={`pill ${c.status === "ativo" ? "ok" : c.status === "pendente" ? "warn" : "off"}`}>{c.status}</span>
          </div>
          <p className="note num">
            Preço {brl(c.list_price_cents)}{c.upgrade_credit_cents > 0 && ` − crédito ${brl(c.upgrade_credit_cents)}`} = {brl(c.amount_due_cents)} em {c.installments_count}× ({c.payment_method}) ·
            {c.access_starts_at ? ` acesso ${fmtDate(c.access_starts_at)} → ${c.access_ends_at ? fmtDate(c.access_ends_at) : "vitalício"}` : ` criado em ${fmtDate(c.created_at)}`}
          </p>
          <div className="table-wrap"><table>
            <thead><tr><th>Nº</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Pago em</th><th>Fatura</th></tr></thead>
            <tbody>{[...c.installments].sort((a, b) => a.number - b.number).map((i) => {
              const [cls, label] = INSTALLMENT_PILL[i.status];
              return <tr key={i.id}><td className="num">{i.number}</td><td className="num">{fmtDate(i.due_date)}</td><td className="num">{brl(i.amount_cents)}</td><td><span className={`pill ${cls}`}>{label}</span></td><td className="num">{fmtDate(i.paid_at)}</td><td>{i.invoice_url ? <a href={i.invoice_url} target="_blank" rel="noopener noreferrer">Abrir</a> : "—"}</td></tr>;
            })}</tbody>
          </table></div>
        </section>
      ))}

      <h2>Complementos</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Complemento</th><th>Valor</th><th>Situação</th><th>Início</th><th></th></tr></thead>
        <tbody>{(subs ?? []).map((s) => (
          <tr key={s.id}>
            <td>{(s.addons as unknown as { name: string }).name}</td><td className="num">{brl(s.monthly_price_cents)}/mês</td>
            <td><span className="pill info">{s.status}</span></td><td className="num">{fmtDate(s.started_at)}</td>
            <td>{s.status !== "cancelada" && <form action={staffCancelAddon.bind(null, id, s.id)}><button className="btn ghost">Cancelar</button></form>}</td>
          </tr>
        ))}
        {!subs?.length && <tr><td colSpan={5} className="muted">Nenhum complemento.</td></tr>}</tbody>
      </table></div>
    </>
  );
}
