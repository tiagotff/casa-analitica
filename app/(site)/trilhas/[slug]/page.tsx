import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: t } = await supabase.from("career_tracks")
    .select("title, summary, target_role, level, career_track_steps(position, title, description, formations(slug, name))")
    .eq("slug", slug).maybeSingle();
  if (!t) notFound();
  const steps = [...t.career_track_steps].sort((a, b) => a.position - b.position);

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <Link href="/trilhas" className="note">← Trilhas de Carreira</Link>
        <h1>{t.title}</h1>
        <p className="muted">{t.summary}</p>
      </div>
      <ol className="stack" style={{ paddingLeft: 20 }}>
        {steps.map((s) => {
          const f = s.formations as unknown as { slug: string; name: string } | null;
          return (
            <li key={s.position} className="card">
              <h3>{s.title}</h3>
              <p className="muted">{s.description}</p>
              {f && <Link href={`/cursos/${f.slug}`} className="note">Na formação {f.name}</Link>}
            </li>
          );
        })}
      </ol>
      <div><Link className="btn" href="/planos">Começar esta trilha</Link></div>
    </div>
  );
}
