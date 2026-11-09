import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { paragraphs } from "@/lib/content";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase.from("vlog_posts").select("title, excerpt, body_md, video_url, published_at").eq("slug", slug).maybeSingle();
  if (!p) notFound();
  return (
    <article className="container section">
      <Link href="/vlog" className="note">← Vlog</Link>
      <h1>{p.title}</h1>
      <p className="note">{p.published_at && new Date(p.published_at).toLocaleDateString("pt-BR")}</p>
      {p.video_url && <p><a href={p.video_url} target="_blank" rel="noopener noreferrer" className="btn">Assistir ao episódio</a></p>}
      <div className="prose">
        <p className="muted">{p.excerpt}</p>
        {paragraphs(p.body_md).map((t, i) => <p key={i}>{t}</p>)}
      </div>
    </article>
  );
}
