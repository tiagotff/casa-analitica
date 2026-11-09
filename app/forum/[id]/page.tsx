import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { authorInfo, when } from "../data";
import { ReplyForm } from "../ForumForms";
import { hidePost, topicAction } from "../actions";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = (await getSessionUser())!;
  const supabase = await createClient();
  const { data: t } = await supabase.from("forum_topics")
    .select("id, title, body, kind, status, pinned, formation_id, user_id, created_at, edited_at, accepted_post_id, hidden_at, formations(name)").eq("id", id).maybeSingle();
  if (!t) notFound();
  const [{ data: posts }, { data: isMod }] = await Promise.all([
    supabase.from("forum_posts").select("id, user_id, body, created_at, edited_at, hidden_at").eq("topic_id", id).order("created_at"),
    supabase.rpc("is_moderator", { p_formation: t.formation_id }),
  ]);
  const { name, team } = await authorInfo([...new Set([t.user_id, ...(posts ?? []).map((p) => p.user_id)])]);
  const isAuthor = t.user_id === user.id;
  const accepted = (posts ?? []).find((p) => p.id === t.accepted_post_id);
  const ordered = accepted ? [accepted, ...(posts ?? []).filter((p) => p.id !== accepted.id)] : posts ?? [];
  const act = (a: Parameters<typeof topicAction>[1], post?: string) => topicAction.bind(null, id, a, post);

  return (
    <>
      <Link href="/forum" className="note">← Fórum · {(t.formations as unknown as { name: string } | null)?.name ?? "Geral"}</Link>
      <article className="card stack">
        <div className="row" style={{ gap: 8 }}>
          {t.pinned && <span className="pill ai">Fixado</span>}
          <span className={`pill ${t.status === "resolvido" ? "ok" : "warn"}`}>{t.status === "resolvido" ? "Resolvido" : "Em aberto"}</span>
          <span className="pill off">{t.kind === "duvida" ? "Dúvida" : "Discussão"}</span>
          {t.hidden_at && <span className="pill bad">Oculto pela moderação</span>}
        </div>
        <h1 style={{ fontSize: "1.5rem" }}>{t.title}</h1>
        <span className="note">{name.get(t.user_id) ?? "Aluno"}{team.has(t.user_id) ? " (equipe)" : ""} · {when(t.created_at)}{t.edited_at ? " · editado" : ""}</span>
        <p style={{ whiteSpace: "pre-wrap" }}>{t.body}</p>
        <div className="row" style={{ gap: 12 }}>
          {(isAuthor || isMod) && (t.status === "aberto"
            ? <form action={act("resolver")}><button className="link-btn">Marcar como resolvido</button></form>
            : <form action={act("reabrir")}><button className="link-btn">Reabrir</button></form>)}
          {isMod && <form action={act(t.pinned ? "desafixar" : "fixar")}><button className="link-btn">{t.pinned ? "Desafixar" : "Fixar no topo"}</button></form>}
          {isMod && !t.hidden_at && <form action={act("ocultar")}><button className="link-btn">Ocultar tópico</button></form>}
        </div>
      </article>

      <h2 className="section-title">{posts?.length ?? 0} respostas</h2>
      <div className="stack" style={{ gap: 10 }}>
        {ordered.map((p) => (
          <div key={p.id} className="card" style={{ gap: 6, opacity: p.hidden_at ? 0.6 : 1, borderColor: p.id === t.accepted_post_id ? "var(--ok)" : undefined }}>
            <div className="row" style={{ gap: 8 }}>
              <strong>{name.get(p.user_id) ?? "Aluno"}</strong>
              {team.has(p.user_id) && <span className="pill ai">Equipe</span>}
              {p.id === t.accepted_post_id && <span className="pill ok">Melhor resposta</span>}
              {p.hidden_at && <span className="pill warn">Oculto</span>}
              <span className="note">{when(p.created_at)}</span>
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
            <div className="row" style={{ gap: 12 }}>
              {(isAuthor || isMod) && p.id !== t.accepted_post_id && !p.hidden_at && <form action={act("aceitar", p.id)}><button className="link-btn">Marcar como melhor resposta</button></form>}
              {isMod && !p.hidden_at && <form action={hidePost.bind(null, id, p.id)}><button className="link-btn">Ocultar</button></form>}
            </div>
          </div>
        ))}
      </div>
      {!t.hidden_at && <section className="card"><ReplyForm topicId={id} /></section>}
    </>
  );
}
