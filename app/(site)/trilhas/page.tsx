import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Trilhas de Carreira" };

export default async function Page() {
  const supabase = await createClient();
  const { data: tracks } = await supabase.from("career_tracks")
    .select("slug, title, summary, target_role, level, career_track_steps(id)").eq("status", "publicado").order("position");
  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Trilhas de Carreira</h1>
        <p className="muted">Caminhos prontos que combinam módulos das formações para chegar a um cargo.</p>
      </div>
      <div className="grid">
        {(tracks ?? []).map((t) => (
          <Link key={t.slug} href={`/trilhas/${t.slug}`} className="card">
            <span className="eyebrow">{t.level}</span>
            <h2>{t.title}</h2>
            <p className="muted">{t.summary}</p>
            <p className="note">{t.career_track_steps.length} etapas · destino: {t.target_role}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
