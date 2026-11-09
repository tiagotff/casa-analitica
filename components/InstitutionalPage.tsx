import { notFound } from "next/navigation";
import { getPage, paragraphs } from "@/lib/content";

export async function InstitutionalPage({ slug, children }: { slug: string; children?: React.ReactNode }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <div className="container section">
      <h1>{page.title}</h1>
      <div className="prose">
        {paragraphs(page.body_md).map((p, i) => <p key={i}>{p}</p>)}
      </div>
      {children}
      <p className="note">Atualizado em {new Date(page.updated_at).toLocaleDateString("pt-BR")}</p>
    </div>
  );
}
