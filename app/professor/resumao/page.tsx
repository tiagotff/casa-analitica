import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { fmtDate } from "@/lib/student";
import { myTeachingFormations } from "../data";
import { saveSession } from "./actions";

export const metadata = { title: "Resumão Guiado" };

export default async function Page() {
  const user = await requireRole("professor", "admin");
  const supabase = await createClient();
  const formations = await myTeachingFormations(user);
  const { data: sessions } = await supabase.from("resumao_sessions")
    .select("id, week_number, title, release_at, status, formations(name)").order("release_at", { ascending: false });

  return (
    <>
      <h1>Resumão Guiado</h1>
      <form action={saveSession} className="card stack">
        <h2>Publicar gravação da semana</h2>
        <div className="row">
          <div className="field" style={{ flex: 2, minWidth: 220 }}><label htmlFor="formation_id">Formação</label>
            <select id="formation_id" name="formation_id">{formations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          <div className="field" style={{ flex: 1, minWidth: 100 }}><label htmlFor="week_number">Semana</label><input id="week_number" name="week_number" type="number" min={1} required /></div>
          <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor="release_at">Publicação</label><input id="release_at" name="release_at" type="datetime-local" required /></div>
        </div>
        <div className="field"><label htmlFor="title">Título</label><input id="title" name="title" required /></div>
        <div className="row">
          <div className="field" style={{ flex: 2, minWidth: 220 }}><label htmlFor="video_ref">ID do vídeo</label><input id="video_ref" name="video_ref" /></div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}><label htmlFor="status">Status</label><select id="status" name="status"><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option></select></div>
        </div>
        <div><button className="btn">Salvar gravação</button></div>
        <p className="note">A mesma semana da mesma formação é atualizada em vez de duplicada.</p>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>Semana</th><th>Formação</th><th>Título</th><th>Publicação</th><th>Status</th></tr></thead>
        <tbody>{(sessions ?? []).map((s) => (
          <tr key={s.id}><td className="num">{s.week_number}</td><td>{(s.formations as unknown as { name: string }).name}</td><td>{s.title}</td><td className="num">{fmtDate(s.release_at)}</td><td><span className={`pill ${s.status === "publicado" ? "ok" : "off"}`}>{s.status}</span></td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
