import { createClient } from "@/lib/supabase/server";
import { addComment, deleteOwnComment, hideComment } from "@/app/aluno/aula/[id]/actions";
import { CommentForm } from "./CommentForm";

type Row = { id: string; user_id: string; parent_id: string | null; body: string; created_at: string; edited_at: string | null; hidden_at: string | null };
const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Comentários da aula com respostas (um nível). Professor, suporte e admin moderam. */
export async function LessonComments({ lessonId, formationId, userId }: { lessonId: string; formationId: string; userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_comments")
    .select("id, user_id, parent_id, body, created_at, edited_at, hidden_at").eq("lesson_id", lessonId).order("created_at");
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: names }, { data: flags }, { data: isMod }] = await Promise.all([
    ids.length ? supabase.rpc("public_names", { p_users: ids }) : Promise.resolve({ data: [] }),
    ids.length ? supabase.rpc("staff_flags", { p_users: ids }) : Promise.resolve({ data: [] }),
    supabase.rpc("is_moderator", { p_formation: formationId }),
  ]);
  const name = new Map((names as { user_id: string; name: string }[] ?? []).map((n) => [n.user_id, n.name]));
  const team = new Set((flags as { user_id: string; is_team: boolean }[] ?? []).filter((f) => f.is_team).map((f) => f.user_id));
  const roots = rows.filter((r) => !r.parent_id);
  const replies = (id: string) => rows.filter((r) => r.parent_id === id);

  const Item = ({ c, reply }: { c: Row; reply?: boolean }) => (
    <div className="comment" style={{ marginLeft: reply ? 24 : 0, opacity: c.hidden_at ? 0.55 : 1 }}>
      <div className="row" style={{ gap: 8 }}>
        <strong>{name.get(c.user_id) ?? "Aluno"}</strong>
        {team.has(c.user_id) && <span className="pill ai">Equipe</span>}
        <span className="note">{when(c.created_at)}{c.edited_at ? " · editado" : ""}</span>
        {c.hidden_at && <span className="pill warn">Oculto pela moderação</span>}
      </div>
      <p style={{ whiteSpace: "pre-wrap" }}>{c.body}</p>
      <div className="row" style={{ gap: 12 }}>
        {c.user_id === userId && <form action={deleteOwnComment.bind(null, lessonId, c.id)}><button className="link-btn">Excluir</button></form>}
        {isMod && !c.hidden_at && <form action={hideComment.bind(null, lessonId, c.id)}><button className="link-btn">Ocultar</button></form>}
      </div>
    </div>
  );

  return (
    <section className="card stack" aria-labelledby="comentarios">
      <h2 id="comentarios" className="section-title">Comentários ({rows.filter((r) => !r.hidden_at).length})</h2>
      <CommentForm action={addComment} lessonId={lessonId} placeholder="Deixe um comentário ou dúvida sobre esta aula" submit="Comentar" />
      {roots.map((c) => (
        <div key={c.id} className="stack" style={{ gap: 10, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <Item c={c} />
          {replies(c.id).map((r) => <Item key={r.id} c={r} reply />)}
          <details style={{ marginLeft: 24 }}>
            <summary className="note" style={{ cursor: "pointer" }}>Responder</summary>
            <div style={{ marginTop: 8 }}><CommentForm action={addComment} lessonId={lessonId} parentId={c.id} placeholder="Sua resposta" submit="Responder" /></div>
          </details>
        </div>
      ))}
      {!roots.length && <p className="muted">Nenhum comentário ainda. Seja o primeiro.</p>}
      <p className="note">Dúvida mais longa ou que vale para a turma toda? Abra um tópico no <a href="/forum">fórum</a>.</p>
    </section>
  );
}
