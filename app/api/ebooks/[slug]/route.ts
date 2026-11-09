import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Download de e-book: exige login (captação de lead) e entrega URL assinada por 10 minutos. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: ebook } = await supabase.from("ebooks").select("id, file_path, requires_login").eq("slug", slug).maybeSingle();
  if (!ebook) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const { data: { user } } = await supabase.auth.getUser();
  if (ebook.requires_login && !user) {
    return NextResponse.redirect(new URL(`/cadastrar?voltar=${encodeURIComponent("/ebooks")}`, request.url));
  }
  if (user) await supabase.from("ebook_downloads").insert({ ebook_id: ebook.id, user_id: user.id });

  const { data: signed } = await createAdminClient().storage.from("ebooks").createSignedUrl(ebook.file_path, 600, { download: true });
  if (!signed) return NextResponse.json({ error: "arquivo_indisponivel" }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
