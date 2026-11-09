import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { brl } from "@/lib/billing/money";

export const metadata = { title: "Visão geral" };

export default async function Page() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: offers }, { data: contracts }, { data: inst }, { data: subs }, { count: students }] = await Promise.all([
    supabase.from("plan_availability").select("id, code, name, kind, seats, seats_left, on_sale, price_cents").order("rank"),
    supabase.from("contracts").select("plan_id, status"),
    supabase.from("installments").select("amount_cents, status"),
    supabase.from("addon_subscriptions").select("monthly_price_cents, status"),
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "aluno"),
  ]);
  const sum = (s: string) => (inst ?? []).filter((i) => i.status === s).reduce((a, i) => a + i.amount_cents, 0);
  const mrr = (subs ?? []).filter((s) => s.status === "ativa").reduce((a, s) => a + s.monthly_price_cents, 0);
  const tiles = [
    ["Recebido", brl(sum("paga"))], ["A receber", brl(sum("pendente"))], ["Vencido", brl(sum("vencida"))],
    ["Complementos (mensal)", brl(mrr)], ["Contas de aluno", String(students ?? 0)],
  ];

  return (
    <>
      <h1>Visão geral</h1>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))" }}>
        {tiles.map(([k, v]) => <div key={k} className="card"><span className="eyebrow">{k}</span><span className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.4rem" }}>{v}</span></div>)}
      </div>
      <h2>Ofertas</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Oferta</th><th>Preço</th><th>Ativos</th><th>Pendentes</th><th>Vagas</th><th>Venda</th></tr></thead>
        <tbody>{(offers ?? []).map((o) => {
          const cs = (contracts ?? []).filter((c) => c.plan_id === o.id);
          return (
            <tr key={o.code}>
              <td>{o.name}</td><td className="num">{brl(o.price_cents)}</td>
              <td className="num">{cs.filter((c) => c.status === "ativo").length}</td>
              <td className="num">{cs.filter((c) => c.status === "pendente").length}</td>
              <td className="num">{o.seats ? `${o.seats - (o.seats_left ?? 0)} / ${o.seats}` : "—"}</td>
              <td><span className={`pill ${o.on_sale ? "ok" : "off"}`}>{o.on_sale ? "Aberta" : "Fechada"}</span></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </>
  );
}
