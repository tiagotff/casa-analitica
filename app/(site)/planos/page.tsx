import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/billing/money";

export const metadata = { title: "Planos" };

export default async function Page() {
  const supabase = await createClient();
  const [{ data: offers }, { data: addons }] = await Promise.all([
    supabase.from("plan_availability").select("*").order("rank"),
    supabase.from("addons").select("code, name, description, monthly_price_cents, available_from").order("monthly_price_cents"),
  ]);
  const lots = (offers ?? []).filter((o) => o.kind === "lote");
  const plans = (offers ?? []).filter((o) => o.kind === "plano");
  const access = (m: number | null) => (m ? `${m} meses de acesso` : "Vitalício condicionado");

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Planos</h1>
        <p className="muted">O valor é por formação: cada plano dá acesso apenas à formação contratada. Para levar todas as formações, há uma condição especial em cada plano. Preços totais, em até 12 vezes.</p>
      </div>

      <div className="grid">
        <div className="card"><h3>Conteúdo liberado toda semana</h3><p className="muted">Uma aula nova toda segunda-feira, com projeto aplicado ao fim de cada módulo.</p></div>
        <div className="card"><h3>Módulo 1 para avaliar</h3><p className="muted">Crie sua conta e assista ao primeiro módulo de qualquer formação antes de contratar.</p><Link href="/cadastrar">Criar conta grátis</Link></div>
        <div className="card"><h3>Garantia de 7 dias</h3><p className="muted">Não gostou? Peça a devolução integral em até 7 dias depois da liberação do acesso.</p><Link href="/garantia">Como funciona</Link></div>
      </div>

      {lots.length > 0 && (
        <section className="stack">
          <h2>Lançamento de janeiro de 2027</h2>
          <div className="grid">
            {lots.map((l) => (
              <div key={l.code} className="card">
                <div className="row between">
                  <h3>{l.name}</h3>
                  <span className={`pill ${l.on_sale ? "ok" : "off"}`}>{l.on_sale ? `${l.seats_left} vagas` : l.seats_left === 0 ? "Esgotado" : "Fechado"}</span>
                </div>
                <span className="eyebrow">Por formação</span>
                <span className="num price">{brl(l.price_cents)}</span>
                <span className="note num">12 × {brl(Math.round(l.price_cents / 12))} · {access(l.access_months)}</span>
                <span className="note num">Todas as formações: <strong>{brl(l.all_formations_price_cents)}</strong></span>
                {l.on_sale ? (
                  <div className="row"><Link className="btn" href={`/checkout/${l.code}`}>Uma formação</Link><Link className="btn purple" href={`/checkout/${l.code}?escopo=todas`}>Todas</Link></div>
                ) : <button className="btn" disabled>Indisponível</button>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="stack">
        <h2>Planos regulares</h2>
        <div className="grid">
          {plans.map((p) => (
            <div key={p.code} className="card">
              <span className="eyebrow">{access(p.access_months)}</span>
              <h3>{p.name}</h3>
              <span className="eyebrow">Por formação</span>
              <span className="num price">{brl(p.price_cents)}</span>
              <span className="note num">12 × {brl(Math.round(p.price_cents / 12))}</span>
              <span className="note num">Todas as formações: <strong>{brl(p.all_formations_price_cents)}</strong></span>
              {p.includes_future_formations && <span className="pill ai" style={{ alignSelf: "flex-start" }}>Inclui formações futuras</span>}
              {p.on_sale ? (
                <div className="row"><Link className="btn" href={`/checkout/${p.code}`}>Uma formação</Link><Link className="btn purple" href={`/checkout/${p.code}?escopo=todas`}>Todas</Link></div>
              ) : <button className="btn" disabled>Disponível após o lançamento</button>}
            </div>
          ))}
        </div>
        <p className="note">Todos os planos incluem atualizações e novos conteúdos das formações adquiridas durante o acesso. O acesso vitalício não inclui suporte permanente nem encontros futuros gratuitos.</p>
      </section>

      <section className="stack">
        <h2>Complementos</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Produto</th><th>O que inclui</th><th>Preço</th></tr></thead>
          <tbody>
            {(addons ?? []).map((a) => (
              <tr key={a.code}><td>{a.name}</td><td>{a.description}{a.available_from && <span className="note"> · a partir de {new Date(a.available_from + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>}</td><td className="num">{brl(a.monthly_price_cents)}/mês</td></tr>
            ))}
          </tbody>
        </table></div>
      </section>

      <section className="card">
        <h2>Evolua de plano sem perder o valor já investido</h2>
        <p className="muted">O valor efetivamente pago no plano anterior é descontado do preço vigente do novo plano, e o acesso recomeça a contar na confirmação do upgrade. Parcelas pendentes do plano anterior não são cobradas.</p>
      </section>
    </div>
  );
}
