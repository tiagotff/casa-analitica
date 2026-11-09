import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { authorInfo, forumSpaces, when } from "./data";
import { NewTopicForm } from "./ForumForms";

export const metadata = { title: "Fórum" };

export default async function Page({ searchParams }: { searchParams: Promise<{ espaco?: string; status?: string; novo?: string }> }) {
  const { espaco = "todos", status = "todos", novo } = await searchParams;
  const supabase = await createClient();
  const spaces = await forumSpaces();
  let q = supabase.from("forum_topics")
    .select("id, title, kind, status, pinned, formation_id, user_id, created_at, last_activity_at, hidden_at, forum_posts(count)")
    .order("pinned", { ascending: false }).order("last_activity_at", { ascending: false }).limit(100);
  const space = spaces.find((s) => s.slug === espaco);
  if (space) q = space.id ? q.eq("formation_id", space.id) : q.is("formation_id", null);
  if (status === "aberto" || status === "resolvido") q = q.eq("status", status);
  const { data: topics } = await q;
  const { name, team } = await authorInfo([...new Set((topics ?? []).map((t) => t.user_id))]);
  const spaceName = (id: string | null) => spaces.find((s) => s.id === id)?.name ?? "Geral";
  const link = (patch: Record<string, string>) => `/forum?${new URLSearchParams({ espaco, status, ...patch })}`;

  return (
    <>
      <div className="row between">
        <div className="stack" style={{ gap: 4 }}><h1>Fórum</h1><p className="muted">Dúvidas e discussões com a turma e a equipe. Você vê o espaço Geral e o das suas formações.</p></div>
        <Link className="btn" href={link({ novo: "1" })}>Novo tópico</Link>
      </div>
      {novo && <section className="card"><h2 className="section-title">Novo tópico</h2><NewTopicForm spaces={spaces} initial={space?.slug ?? "geral"} /></section>}
      <nav className="row" aria-label="Espaços do fórum">
        <Link className={`pill ${espaco === "todos" ? "info" : "off"}`} href={link({ espaco: "todos" })}>Todos</Link>
        {spaces.map((s) => <Link key={s.slug} className={`pill ${espaco === s.slug ? "info" : "off"}`} href={link({ espaco: s.slug })}>{s.name}</Link>)}
      </nav>
      <nav className="row" aria-label="Situação">
        {[["todos", "Todos"], ["aberto", "Em aberto"], ["resolvido", "Resolvidos"]].map(([v, l]) => <Link key={v} className={`note ${status === v ? "" : ""}`} style={{ fontWeight: status === v ? 700 : 400 }} href={link({ status: v })}>{l}</Link>)}
      </nav>
      <div className="stack" style={{ gap: 10 }}>
        {(topics ?? []).map((t) => (
          <Link key={t.id} href={`/forum/${t.id}`} className="card" style={{ gap: 6, opacity: t.hidden_at ? 0.6 : 1 }}>
            <div className="row" style={{ gap: 8 }}>
              {t.pinned && <span className="pill ai">Fixado</span>}
              <span className={`pill ${t.status === "resolvido" ? "ok" : "warn"}`}>{t.status === "resolvido" ? "Resolvido" : "Em aberto"}</span>
              <span className="pill off">{t.kind === "duvida" ? "Dúvida" : "Discussão"}</span>
              <span className="note">{spaceName(t.formation_id)}</span>
            </div>
            <h3>{t.title}</h3>
            <span className="note">{name.get(t.user_id) ?? "Aluno"}{team.has(t.user_id) ? " (equipe)" : ""} · {(t.forum_posts as unknown as { count: number }[])[0]?.count ?? 0} respostas · atividade {when(t.last_activity_at)}</span>
          </Link>
        ))}
        {!topics?.length && <p className="muted">Nenhum tópico por aqui ainda.</p>}
      </div>
    </>
  );
}
