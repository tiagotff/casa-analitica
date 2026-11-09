import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { savePage, saveSetting, createVlogPost } from "../actions";

export const metadata = { title: "Conteúdo do site" };

export default async function Page() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: pages }, { data: settings }] = await Promise.all([
    supabase.from("site_pages").select("slug, title, body_md").order("slug"),
    supabase.from("site_settings").select("key, value").order("key"),
  ]);
  return (
    <>
      <h1>Conteúdo do site</h1>

      <section className="stack">
        <h2>Configurações</h2>
        {(settings ?? []).map((s) => (
          <form key={s.key} action={saveSetting} className="row">
            <input type="hidden" name="key" value={s.key} />
            <label htmlFor={`s-${s.key}`} style={{ minWidth: 200, fontWeight: 600 }}>{s.key}</label>
            <input id={`s-${s.key}`} name="value" defaultValue={String(s.value)} style={{ flex: 1, minWidth: 220 }} />
            <button className="btn ghost">Salvar</button>
          </form>
        ))}
      </section>

      <section className="stack">
        <h2>Páginas institucionais</h2>
        {(pages ?? []).map((p) => (
          <details key={p.slug} className="module">
            <summary><h3>{p.title}</h3><span className="note">/{p.slug}</span></summary>
            <form action={savePage} className="stack" style={{ padding: 16 }}>
              <input type="hidden" name="slug" value={p.slug} />
              <div className="field"><label htmlFor={`t-${p.slug}`}>Título</label><input id={`t-${p.slug}`} name="title" defaultValue={p.title} /></div>
              <div className="field"><label htmlFor={`b-${p.slug}`}>Texto (parágrafos separados por linha em branco)</label><textarea id={`b-${p.slug}`} name="body_md" defaultValue={p.body_md} style={{ minHeight: 220 }} /></div>
              <div><button className="btn">Salvar página</button></div>
            </form>
          </details>
        ))}
      </section>

      <section className="stack">
        <h2>Novo episódio do vlog</h2>
        <form action={createVlogPost} className="form">
          <div className="field"><label htmlFor="v-title">Título</label><input id="v-title" name="title" required /></div>
          <div className="field"><label htmlFor="v-excerpt">Resumo</label><input id="v-excerpt" name="excerpt" required /></div>
          <div className="field"><label htmlFor="v-url">Link do vídeo</label><input id="v-url" name="video_url" type="url" /></div>
          <div className="field"><label htmlFor="v-body">Texto</label><textarea id="v-body" name="body_md" /></div>
          <div><button className="btn">Publicar episódio</button></div>
        </form>
      </section>
    </>
  );
}
