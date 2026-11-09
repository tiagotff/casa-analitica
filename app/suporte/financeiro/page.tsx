import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { fmtDate } from "@/lib/student";
import { brl } from "@/lib/billing/money";

export const metadata = { title: "Cobranças" };

export default async function Page() {
  await requireRole("suporte", "admin");
  const supabase = await createClient();
  const { data: overdue } = await supabase.from("installments")
    .select("id, number, amount_cents, due_date, invoice_url, contracts!inner(user_id, plans(name), profiles(full_name, email))")
    .eq("status", "vencida").order("due_date").limit(200);
  const total = (overdue ?? []).reduce((s, i) => s + i.amount_cents, 0);

  return (
    <>
      <div className="row between"><h1>Parcelas vencidas</h1><span className="pill bad num">{overdue?.length ?? 0} parcelas · {brl(total)}</span></div>
      <p className="muted">O acesso do aluno continua ativo enquanto a política de inadimplência não for aplicada. Envie o link da fatura para regularizar.</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Aluno</th><th>Plano</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Fatura</th></tr></thead>
        <tbody>{(overdue ?? []).map((i) => {
          const c = i.contracts as unknown as { user_id: string; plans: { name: string }; profiles: { full_name: string; email: string } };
          return <tr key={i.id}><td><Link href={`/suporte/alunos/${c.user_id}`}>{c.profiles.full_name || c.profiles.email}</Link></td><td>{c.plans.name}</td><td className="num">{i.number}</td><td className="num">{fmtDate(i.due_date)}</td><td className="num">{brl(i.amount_cents)}</td><td>{i.invoice_url ? <a href={i.invoice_url} target="_blank" rel="noopener noreferrer">Abrir</a> : "—"}</td></tr>;
        })}
        {!overdue?.length && <tr><td colSpan={6} className="muted">Nenhuma parcela vencida.</td></tr>}</tbody>
      </table></div>
    </>
  );
}
