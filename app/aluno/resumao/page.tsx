import Link from "next/link";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { signedEmbedUrl } from "@/lib/video";
import { fmtDate } from "@/lib/student";

export const metadata = { title: "Resumão Guiado" };

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const user = await requireRole("aluno", "admin");
  const supabase = await createClient();
  const { data: has } = await supabase.rpc("has_addon_benefit", { p_user: user.id, p_benefit: "resumao" });

  if (!has) {
    return (
      <>
        <h1>Resumão Guiado</h1>
        <p className="muted" style={{ maxWidth: "62ch" }}>Uma gravação semanal de 1h30 que vai além do gabarito: resolve os exercícios passo a passo, explicando o raciocínio, a execução e os erros mais comuns.</p>
        <div><Link className="btn" href="/aluno/plano">Contratar por R$ 149/mês</Link></div>
      </>
    );
  }

  // O RLS só devolve sessões liberadas das formações do aluno.
  const { data: sessions } = await supabase.from("resumao_sessions")
    .select("id, week_number, title, duration_min, release_at, formations(name)")
    .order("release_at", { ascending: false });
  const current = sessions?.find((x) => x.id === s) ?? sessions?.[0];
  // A sessão já passou pelo RLS (can_view_resumao); o id do vídeo é lido só no servidor.
  const { data: media } = current ? await createAdminClient().from("resumao_sessions").select("video_ref").eq("id", current.id).single() : { data: null };
  const embed = media?.video_ref ? signedEmbedUrl(media.video_ref) : null;

  return (
    <>
      <h1>Resumão Guiado</h1>
      {current && (
        <section className="stack">
          <div className="player">{embed ? <iframe src={embed} title={current.title} allowFullScreen loading="lazy" /> : <div className="empty">Gravação em publicação.</div>}</div>
          <h2>Semana {current.week_number}: {current.title}</h2>
        </section>
      )}
      <div className="table-wrap"><table>
        <thead><tr><th>Semana</th><th>Formação</th><th>Gravação</th><th>Publicada em</th></tr></thead>
        <tbody>
          {(sessions ?? []).map((x) => (
            <tr key={x.id}>
              <td className="num">{x.week_number}</td>
              <td>{(x.formations as unknown as { name: string }).name}</td>
              <td><Link href={`/aluno/resumao?s=${x.id}`}>{x.title}</Link></td>
              <td className="num">{fmtDate(x.release_at)}</td>
            </tr>
          ))}
          {!sessions?.length && <tr><td colSpan={4} className="muted">A primeira gravação sai na quinta-feira depois da primeira aula.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
