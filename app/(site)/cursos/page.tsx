import Link from "next/link";
import { getFormations } from "@/lib/content";

export const metadata = { title: "Todos os Cursos" };

export default async function Page() {
  const formations = await getFormations();
  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Todos os Cursos</h1>
        <p className="muted">40 horas por formação, com conteúdo liberado semanalmente e projetos aplicados. O módulo 1 de cada formação é aberto para avaliação.</p>
      </div>
      <div className="grid f3">
        {formations.map((f) => {
          const lessons = f.modules.flatMap((m) => m.lessons);
          return (
            <Link key={f.id} href={`/cursos/${f.slug}`} className="card" style={{ borderTop: `4px solid ${f.accent_color}` }}>
              <h2>{f.name}</h2>
              <p className="muted">{f.summary}</p>
              <p className="note">{f.modules.length} módulos · {lessons.length} aulas · {lessons.filter((l) => l.kind === "projeto").length} projetos aplicados</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
