import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "E-books" };

export default async function Page() {
  const supabase = await createClient();
  const { data: ebooks } = await supabase.from("ebooks")
    .select("slug, title, summary, requires_login").eq("status", "publicado").order("published_at", { ascending: false });
  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <h1>E-books</h1>
        <p className="muted">Materiais gratuitos para começar. Basta criar sua conta para baixar.</p>
      </div>
      <div className="grid">
        {(ebooks ?? []).map((e) => (
          <div key={e.slug} className="card">
            <h2>{e.title}</h2>
            <p className="muted">{e.summary}</p>
            <div><a className="btn" href={`/api/ebooks/${e.slug}`}>Baixar e-book</a></div>
          </div>
        ))}
      </div>
    </div>
  );
}
