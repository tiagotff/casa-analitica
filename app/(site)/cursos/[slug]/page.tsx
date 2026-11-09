import Link from "next/link";
import { duration } from "@/lib/billing/money";
import { notFound } from "next/navigation";
import { getFormationBySlug } from "@/lib/content";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = await getFormationBySlug(slug);
  if (!f) notFound();

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <Link href="/cursos" className="note">← Todos os cursos</Link>
        <h1>{f.name}</h1>
        <p className="muted">{f.description}</p>
        <p className="note">{f.hours_planned} horas de conteúdo previstas · conteúdo liberado semanalmente, uma aula nova toda segunda-feira</p>
      </div>
      <div className="row">
        <Link className="btn" href={`/checkout/essencial?formacao=${f.id}`}>Matricule-se nesta formação</Link>
        <Link className="btn ghost" href={`/aluno/formacoes/${f.slug}`}>Assistir ao módulo 1 grátis</Link>
      </div>
      <p className="note">Módulo 1 aberto para avaliação com cadastro gratuito · garantia de 7 dias</p>
      <div className="stack">
        {f.modules.map((m, i) => (
          <details key={m.id} className="module" open={i === 0}>
            <summary><h3>Módulo {m.position}: {m.title}</h3><span className="note">{i === 0 ? "Aberto para avaliação · " : ""}{m.lessons.length} aulas</span></summary>
            <div>
              {m.lessons.map((l) => (
                <div key={l.id} className="lesson-row">
                  <span>{l.title}</span>
                  <span className={`pill ${l.kind === "projeto" ? "ai" : "off"}`}>{l.kind === "projeto" ? `Projeto aplicado · ${duration(l.duration_min)}` : duration(l.duration_min)}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
