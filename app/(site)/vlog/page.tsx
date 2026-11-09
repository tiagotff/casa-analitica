import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Vlog" };

export default async function Page() {
  const supabase = await createClient();
  const { data: posts } = await supabase.from("vlog_posts")
    .select("slug, title, excerpt, published_at").eq("status", "publicado").order("published_at", { ascending: false });
  return (
    <div className="container section">
      <h1>Vlog</h1>
      <div className="grid">
        {(posts ?? []).map((p) => (
          <Link key={p.slug} href={`/vlog/${p.slug}`} className="card">
            <span className="note">{new Date(p.published_at!).toLocaleDateString("pt-BR")}</span>
            <h2>{p.title}</h2>
            <p className="muted">{p.excerpt}</p>
          </Link>
        ))}
        {!posts?.length && <p className="muted">Os primeiros episódios chegam em breve.</p>}
      </div>
    </div>
  );
}
