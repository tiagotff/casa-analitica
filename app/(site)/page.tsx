import Link from "next/link";
import { getFormations } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/billing/money";
import { HeroChart, HeroWaves } from "@/components/HeroArt";
import { BrandLockup } from "@/components/Logo";

export default async function Home() {
  const supabase = await createClient();
  const [formations, { data: offers }] = await Promise.all([
    getFormations(),
    supabase.from("plan_availability").select("code, name, kind, price_cents, all_formations_price_cents, seats, seats_left, on_sale").order("rank"),
  ]);
  const open = offers?.find((o) => o.kind === "lote" && o.on_sale) ?? offers?.find((o) => o.on_sale);

  return (
    <>
      <section className="hero">
        <HeroWaves />
        <div className="container">
          <div className="hero-copy">
            <h1>Dados, estratégia e resultados reais para a sua carreira.</h1>
            <p>Formações completas, práticas e conectadas com o mercado. Conteúdo liberado toda semana, com projetos aplicados.</p>
            <div className="row">
              <Link className="btn" href="/cursos">Conheça as formações</Link>
              <Link className="btn on-dark" href="/cadastrar">Assista ao módulo 1 grátis</Link>
            </div>
            {open && (
              <p className="num" style={{ fontSize: ".9rem" }}>
                {open.name}: {brl(open.price_cents)} por formação ou {brl(open.all_formations_price_cents)} todas
                {open.seats_left != null && ` · ${open.seats_left} de ${open.seats} vagas`}
              </p>
            )}
          </div>
          <HeroChart />
        </div>
      </section>

      <div className="container section">
        <div className="row between"><h2 className="section-title">Formações</h2><Link href="/cursos">Todos os cursos</Link></div>
        <div className="grid f3">
          {formations.map((f) => (
            <Link key={f.id} href={`/cursos/${f.slug}`} className="card" style={{ borderTop: `4px solid ${f.accent_color}` }}>
              <h3>{f.name}</h3>
              <p className="muted">{f.summary}</p>
              <p className="note">{f.hours_planned} h · {f.modules.length} módulos · módulo 1 aberto para avaliação</p>
            </Link>
          ))}
        </div>

        <h2 className="section-title">Como funciona</h2>
        <div className="grid">
          <div className="card">
            <svg className="icon-line" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
            <h3>Conteúdo liberado toda semana</h3>
            <p className="muted">Uma aula nova toda segunda-feira e um projeto aplicado ao fim de cada módulo.</p>
          </div>
          <div className="card">
            <svg className="icon-line" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="13" rx="2" /><path d="M8 21h8M10 9.5l5 2.5-5 2.5z" /></svg>
            <h3>Módulo 1 para avaliar</h3>
            <p className="muted">Crie sua conta e assista ao primeiro módulo de qualquer formação para conhecer o curso e a didática.</p>
          </div>
          <div className="card">
            <svg className="icon-line" viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
            <h3>Garantia de 7 dias</h3>
            <p className="muted">Não gostou? Peça a devolução integral em até 7 dias depois da liberação do acesso.</p>
          </div>
          <div className="card">
            <svg className="icon-line" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
            <h3>Valor por formação</h3>
            <p className="muted">Pague só pela formação que escolher, ou leve todas com uma condição especial.</p>
          </div>
        </div>
      </div>

      <section className="brand-band">
        <HeroWaves />
        <div className="container"><BrandLockup /></div>
      </section>
    </>
  );
}
