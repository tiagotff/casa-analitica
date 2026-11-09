import Link from "next/link";
import { duration } from "@/lib/billing/money";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getMyFormations, fmtDate } from "@/lib/student";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireRole("aluno", "admin");
  const f = (await getMyFormations(user.id)).find((x) => x.slug === slug);
  if (!f) notFound();
  const now = Date.now();
  const openModule = (f.next ?? f.lessons[0])?.id;

  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <Link href="/aluno" className="note">← Início</Link>
        <h1>{f.name}</h1>
        {f.owned ? (
          <div className="row"><div className="bar" style={{ flex: 1, minWidth: 160, maxWidth: 360 }}><i style={{ width: `${f.progress}%` }} /></div><span className="note num">{f.completed} de {f.lessons.length} aulas · {f.progress}%</span></div>
        ) : (
          <div className="card" style={{ background: "var(--teal-soft)", borderColor: "transparent" }}>
            <strong>Módulo 1 aberto para avaliação</strong>
            <p className="muted">Assista ao primeiro módulo inteiro para conhecer o curso e a didática. Os demais módulos são liberados semanalmente depois da matrícula.</p>
            <div className="row"><Link className="btn" href={`/checkout/essencial?formacao=${f.id}`}>Matricular nesta formação</Link><Link className="btn ghost" href="/planos">Ver planos</Link></div>
          </div>
        )}
      </div>
      <div className="stack">
        {f.modules.map((m) => (
          <details key={m.id} className="module" open={m.lessons.some((l) => l.id === openModule)}>
            <summary><h3>Módulo {m.position}: {m.title}{m.is_preview && <span className="pill ok" style={{ marginLeft: 8 }}>Aberto para avaliação</span>}</h3><span className="note num">{m.lessons.filter((l) => f.done.has(l.id)).length}/{m.lessons.length}</span></summary>
            <div>
              {m.lessons.map((l) => {
                const preview = f.previewIds.has(l.id);
                const released = preview || new Date(l.release_at).getTime() <= now;
                const canOpen = released && (f.owned || preview);
                const done = f.done.has(l.id);
                const pill = !canOpen && !f.owned ? ["off", "Exige matrícula"] : done ? ["ok", "Concluída"] : released ? ["info", "Disponível"] : ["off", `Libera ${fmtDate(l.release_at, { day: "2-digit", month: "2-digit" })}`];
                const content = (<><span>{l.title}<span className="note"> · {l.kind === "projeto" ? "Projeto aplicado · " : ""}{duration(l.duration_min)}</span></span><span className={`pill ${pill[0]}`}>{pill[1]}</span></>);
                return canOpen
                  ? <Link key={l.id} className="lesson-row" href={`/aluno/aula/${l.id}`}>{content}</Link>
                  : <div key={l.id} className="lesson-row">{content}</div>;
              })}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
