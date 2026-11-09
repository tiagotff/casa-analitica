import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { signedEmbedUrl } from "@/lib/video";
import { fmtDate } from "@/lib/student";
import { duration } from "@/lib/billing/money";
import { LessonComments } from "@/components/comments/LessonComments";
import { toggleLessonDone } from "./actions";

const kb = (b: number | null) => (b ? (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`) : "PDF");

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("aluno", "admin");
  const supabase = await createClient();

  const { data: canView } = await supabase.rpc("can_view_lesson", { p_lesson: id });
  const { data: lesson } = await supabase.from("lessons")
    .select("id, title, summary, kind, duration_min, release_at, position, modules(id, position, title, is_preview, formation_id, formations(id, slug, name))")
    .eq("id", id).maybeSingle();
  if (!lesson) notFound();
  const mod = lesson.modules as unknown as { id: string; position: number; title: string; is_preview: boolean; formation_id: string; formations: { id: string; slug: string; name: string } };

  if (!canView) {
    return (
      <div className="card">
        <h1>{lesson.title}</h1>
        <p className="muted">{new Date(lesson.release_at) > new Date() ? `Esta aula será liberada em ${fmtDate(lesson.release_at)}.` : "Esta aula não está incluída no seu plano."}</p>
        <div><Link className="btn ghost" href={`/aluno/formacoes/${mod.formations.slug}`}>Voltar para a formação</Link></div>
      </div>
    );
  }

  // O id do vídeo é lido só no servidor (service role), depois da checagem acima.
  const [{ data: media }, { data: materials }, { data: progress }, { data: siblings }, { data: hasResumao }, { data: owns }] = await Promise.all([
    createAdminClient().from("lesson_media").select("video_ref").eq("lesson_id", id).maybeSingle(),
    supabase.from("lesson_materials").select("id, title, size_bytes").eq("lesson_id", id).order("created_at"),
    supabase.from("lesson_progress").select("completed_at").eq("lesson_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("lessons").select("id, position, module_id, release_at, modules!inner(position, formation_id)").eq("modules.formation_id", mod.formation_id).eq("status", "publicado"),
    supabase.rpc("has_addon_benefit", { p_user: user.id, p_benefit: "resumao" }),
    supabase.rpc("user_has_formation", { p_user: user.id, p_formation: mod.formation_id }),
  ]);

  const ordered = (siblings ?? []).map((s) => ({ ...s, mpos: (s.modules as unknown as { position: number }).position }))
    .sort((a, b) => a.mpos - b.mpos || a.position - b.position);
  const idx = ordered.findIndex((s) => s.id === id);
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];
  const nextModulePreview = next && next.module_id === mod.id && mod.is_preview;
  const nextOpen = next && (nextModulePreview || (owns && new Date(next.release_at) <= new Date()));
  const embed = media ? signedEmbedUrl(media.video_ref) : null;
  const done = Boolean(progress?.completed_at);

  return (
    <>
      <Link href={`/aluno/formacoes/${mod.formations.slug}`} className="note">← {mod.formations.name} · Módulo {mod.position}: {mod.title}</Link>
      {mod.is_preview && !owns && (
        <div className="card row between" style={{ background: "var(--teal-soft)", borderColor: "transparent" }}>
          <span><strong>Você está no módulo de avaliação.</strong> Gostou da didática? Matricule-se para liberar os próximos módulos, uma aula nova por semana.</span>
          <Link className="btn" href={`/checkout/essencial?formacao=${mod.formations.id}`}>Matricular</Link>
        </div>
      )}
      {/* Player sem download: embed assinado e temporário; MP4 desligado no Bunny. */}
      <div className="player">
        {embed
          ? <iframe src={embed} title={lesson.title} allow="accelerometer; gyroscope; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin" loading="lazy" />
          : <div className="empty">O vídeo desta aula ainda está sendo publicado.</div>}
      </div>
      <div className="row between">
        <h1 style={{ fontSize: "1.5rem" }}>{lesson.title}</h1>
        <form action={toggleLessonDone.bind(null, id, !done)}>
          <button className={`btn ${done ? "ghost" : "teal"}`}>{done ? "Marcar como não concluída" : "Marcar como concluída"}</button>
        </form>
      </div>
      {lesson.summary && <p className="muted">{lesson.summary}</p>}

      <section className="card stack" aria-labelledby="materiais">
        <h2 id="materiais" className="section-title">Materiais da aula</h2>
        {(materials ?? []).length ? (
          <div className="stack" style={{ gap: 8 }}>
            {materials!.map((m) => (
              <div key={m.id} className="material">
                <span className="row" style={{ gap: 10 }}><span className="ic">PDF</span><span>{m.title}<br /><span className="note">{kb(m.size_bytes)}</span></span></span>
                <a className="btn ghost sm" href={`/api/materiais/${m.id}`}>Baixar PDF</a>
              </div>
            ))}
            <p className="note">Os PDFs saem com marca d&apos;água com seu nome e CPF. O material é de uso pessoal.</p>
          </div>
        ) : <p className="muted">Esta aula não tem materiais anexos.</p>}
      </section>

      <section className="card" style={{ background: "var(--purple-soft)", borderColor: "transparent" }}>
        <span className="eyebrow">Resumão Guiado</span>
        {hasResumao
          ? <><h3>Resolução comentada dos exercícios desta semana</h3><div><Link href="/aluno/resumao">Abrir gravações</Link></div></>
          : <><p>Resolução passo a passo dos exercícios, com raciocínio e erros comuns, no complemento mensal.</p><div><Link href="/aluno/resumao">Conhecer o Resumão</Link></div></>}
      </section>

      <div className="row between">
        {prev ? <Link className="btn ghost" href={`/aluno/aula/${prev.id}`}>← Aula anterior</Link> : <span />}
        {next && (nextOpen ? <Link className="btn ghost" href={`/aluno/aula/${next.id}`}>Próxima aula →</Link> : <span className="note">{owns ? `Próxima aula libera em ${fmtDate(next.release_at, { day: "2-digit", month: "2-digit" })}` : "Próximo módulo exige matrícula"}</span>)}
      </div>
      <p className="note">{duration(lesson.duration_min)} de conteúdo</p>

      <LessonComments lessonId={id} formationId={mod.formation_id} userId={user.id} />
    </>
  );
}
