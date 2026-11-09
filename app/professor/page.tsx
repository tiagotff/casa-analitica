import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { myTeachingFormations } from "./data";

export default async function Page() {
  const user = await requireRole("professor", "admin");
  const supabase = await createClient();
  const formations = await myTeachingFormations(user);
  const stats = await Promise.all(formations.map(async (f) => {
    const { data } = await supabase.rpc("instructor_formation_stats", { p_formation: f.id });
    return (Array.isArray(data) ? data[0] : data) as { students: number; avg_progress: number } | null;
  }));

  return (
    <>
      <h1>Minhas formações</h1>
      {!formations.length && <p className="muted">Nenhuma formação atribuída a você ainda. O administrador faz essa atribuição.</p>}
      <div className="grid">
        {formations.map((f, i) => (
          <Link key={f.id} href={`/professor/formacoes/${f.slug}`} className="card">
            <h2>{f.name}</h2>
            <span className="note num">{stats[i]?.students ?? 0} alunos com progresso · média {stats[i]?.avg_progress ?? 0}%</span>
            <span className={`pill ${f.status === "publicado" ? "ok" : "off"}`} style={{ alignSelf: "flex-start" }}>{f.status}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
