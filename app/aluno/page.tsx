import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getMyContracts, getMyFormations, fmtDate } from "@/lib/student";

export default async function Page() {
  const user = await requireRole("aluno", "admin");
  const [{ active, pending }, formations] = await Promise.all([getMyContracts(user.id), getMyFormations(user.id)]);
  const mine = formations.filter((f) => f.owned);
  const others = formations.filter((f) => !f.owned);
  const current = mine.find((f) => f.next) ?? mine[0];
  const plan = active?.plans as unknown as { name: string } | null;
  const firstOpen = pending?.installments.find((i) => i.status === "pendente");

  return (
    <>
      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="eyebrow">Meus cursos</span>
          <h1>Olá, {user.fullName.split(" ")[0] || "aluno"}.</h1>
        </div>
        {active && <span className="pill info">{plan?.name} · {active.access_ends_at ? `acesso até ${fmtDate(active.access_ends_at)}` : "vitalício condicionado"}</span>}
      </div>

      {pending && (
        <div className="card" style={{ borderColor: "var(--warn)" }}>
          <h2>Pagamento pendente</h2>
          <p className="muted">Sua matrícula é liberada assim que o primeiro pagamento for confirmado.</p>
          {firstOpen?.invoice_url && <div><a className="btn" href={firstOpen.invoice_url} target="_blank" rel="noopener noreferrer">Abrir fatura</a></div>}
        </div>
      )}

      {!active && !pending && (
        <div className="card">
          <h2>Avalie antes de contratar</h2>
          <p className="muted">O módulo 1 de cada formação está aberto para você conhecer o curso e a didática. Depois da matrícula, os demais módulos são liberados semanalmente, e você tem 7 dias de garantia.</p>
          <div className="grid">
            {formations.map((f) => (
              <Link key={f.id} href={`/aluno/formacoes/${f.slug}`} className="card" style={{ borderTop: `4px solid ${f.accent_color}` }}>
                <h3>{f.name}</h3>
                <span className="note">{f.modules[0]?.title} · {f.modules[0]?.lessons.length} aulas abertas</span>
              </Link>
            ))}
          </div>
          <div><Link className="btn ghost" href="/planos">Ver planos</Link></div>
        </div>
      )}

      {current && (
        <section className="card">
          <span className="eyebrow">Continue de onde parou · {current.name}</span>
          <h2>{current.next ? current.next.title : "Tudo em dia por aqui"}</h2>
          <div className="row"><div className="bar" style={{ flex: 1, minWidth: 160 }}><i style={{ width: `${current.progress}%` }} /></div><span className="note num">{current.progress}% da formação</span></div>
          {current.next && <div><Link className="btn" href={`/aluno/aula/${current.next.id}`}>Assistir aula</Link></div>}
        </section>
      )}

      {mine.length > 0 && (
        <section className="stack">
          <h2>Minhas formações</h2>
          <div className="grid">
            {mine.map((f) => (
              <Link key={f.id} href={`/aluno/formacoes/${f.slug}`} className="card" style={{ borderTop: `4px solid ${f.accent_color}` }}>
                <h3>{f.name}</h3>
                <div className="bar"><i style={{ width: `${f.progress}%` }} /></div>
                <span className="note num">{f.completed} de {f.lessons.length} aulas</span>
                {f.upcoming[0] && <span className="note">Próxima liberação: {fmtDate(f.upcoming[0].release_at, { day: "2-digit", month: "short" })}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && active && (
        <section className="stack">
          <h2>Outras formações</h2>
          <div className="grid">
            {others.map((f) => (
              <Link key={f.id} href={`/cursos/${f.slug}`} className="card">
                <h3>{f.name}</h3><p className="muted">{f.summary}</p>
                <span className="pill off" style={{ alignSelf: "flex-start" }}>Não incluída no seu plano</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
