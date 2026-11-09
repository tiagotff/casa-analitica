import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { saveLesson, addLesson, uploadMaterial, removeMaterial, removeVideo } from "./actions";
import { VideoUploader } from "./VideoUploader";

const toLocalInput = (iso: string) => new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 16).replace(" ", "T");

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireRole("professor", "admin");
  const supabase = await createClient();
  const { data: f } = await supabase.from("formations")
    .select("id, name, modules(id, position, title, lessons(id, position, title, summary, release_at, status, lesson_media(video_ref), lesson_materials(id, title)))")
    .eq("slug", slug).maybeSingle();
  if (!f) notFound();
  const { data: canEdit } = await supabase.rpc("is_instructor_of", { p_formation: f.id });
  const { data: isAdmin } = await supabase.rpc("has_role", { p_role: "admin" });
  if (!canEdit && !isAdmin) notFound();

  const modules = [...f.modules].sort((a, b) => a.position - b.position);
  return (
    <>
      <div className="stack" style={{ gap: 6 }}>
        <Link href="/professor" className="note">← Minhas formações</Link>
        <h1>{f.name}</h1>
        <p className="muted">Datas no horário de Brasília. Aulas em rascunho não aparecem para os alunos.</p>
      </div>
      {modules.map((m) => (
        <details key={m.id} className="module" open={m.position === 1}>
          <summary><h3>Módulo {m.position}: {m.title}</h3><span className="note">{m.lessons.length} aulas</span></summary>
          <div className="stack" style={{ padding: 16 }}>
            {[...m.lessons].sort((a, b) => a.position - b.position).map((l) => {
              const media = (l.lesson_media as unknown as { video_ref: string } | null);
              return (
                <div key={l.id} className="card">
                  <form action={saveLesson.bind(null, slug)} className="stack">
                    <input type="hidden" name="id" value={l.id} />
                    <div className="row">
                      <div className="field" style={{ flex: 2, minWidth: 220 }}><label htmlFor={`t-${l.id}`}>Aula {l.position}</label><input id={`t-${l.id}`} name="title" defaultValue={l.title} /></div>
                      <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor={`r-${l.id}`}>Liberação</label><input id={`r-${l.id}`} type="datetime-local" name="release_at" defaultValue={toLocalInput(l.release_at)} /></div>
                      <div className="field" style={{ flex: 1, minWidth: 140 }}><label htmlFor={`s-${l.id}`}>Status</label>
                        <select id={`s-${l.id}`} name="status" defaultValue={l.status}><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="arquivado">Arquivado</option></select></div>
                    </div>
                    <div className="field"><label htmlFor={`d-${l.id}`}>Resumo</label><textarea id={`d-${l.id}`} name="summary" defaultValue={l.summary} style={{ minHeight: 70 }} /></div>
                    <div><button className="btn">Salvar aula</button></div>
                  </form>
                  <div className="stack" style={{ gap: 8 }}>
                    <span className="eyebrow">Vídeo · só professor e admin enviam, editam e baixam</span>
                    <div className="row">
                      <span className={`pill ${media ? "ok" : "warn"}`}>{media ? "Vídeo publicado" : "Sem vídeo"}</span>
                      <VideoUploader slug={slug} lessonId={l.id} lessonTitle={l.title} hasVideo={Boolean(media)} />
                      {media && <a className="btn ghost sm" href={`/api/videos/${l.id}/original`}>Baixar original</a>}
                      {media && <form action={removeVideo.bind(null, slug, l.id)}><button className="link-btn">Remover vídeo</button></form>}
                    </div>
                  </div>
                  <div className="stack" style={{ gap: 8 }}>
                    <span className="eyebrow">Materiais em PDF (o aluno baixa com marca d&apos;água)</span>
                    {l.lesson_materials.map((mat) => (
                      <div key={mat.id} className="row between"><span className="pill info">{mat.title}</span>
                        <form action={removeMaterial.bind(null, slug, mat.id)}><button className="link-btn">Remover</button></form></div>
                    ))}
                    <form action={uploadMaterial.bind(null, slug, l.id)} className="row">
                      <input name="title" placeholder="Nome do material" aria-label="Nome do material" required style={{ flex: 1, minWidth: 160 }} />
                      <input type="file" name="file" accept="application/pdf,.pdf" aria-label="Arquivo PDF" required style={{ flex: 1, minWidth: 180 }} />
                      <button className="btn ghost sm">Anexar PDF</button>
                    </form>
                  </div>
                </div>
              );
            })}
            <form action={addLesson.bind(null, slug, m.id)} className="row">
              <input name="title" placeholder="Título da nova aula" aria-label="Título da nova aula" style={{ flex: 1, minWidth: 200 }} />
              <button className="btn ghost">Adicionar aula</button>
            </form>
          </div>
        </details>
      ))}
    </>
  );
}
