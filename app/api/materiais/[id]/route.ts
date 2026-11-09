import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { looksLikePdf, stampPdf, watermarkText } from "@/lib/watermark";

export const runtime = "nodejs";

/**
 * Download de material com marca d'água.
 * 1. O RLS só devolve o material se o usuário puder ver a aula.
 * 2. Sem CPF cadastrado, o usuário é levado a "Meus dados" para informar.
 * 3. O PDF é carimbado com nome + CPF + e-mail + data e o download fica registrado.
 * O arquivo limpo nunca sai do bucket privado.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL(`/entrar?voltar=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));

  const supabase = await createClient();
  const { data: material } = await supabase.from("lesson_materials").select("id, title, storage_path, lesson_id").eq("id", id).maybeSingle();
  if (!material) return NextResponse.json({ error: "Você não tem acesso a este material." }, { status: 403 });

  const { data: doc } = await supabase.from("profile_documents").select("cpf").eq("user_id", user.id).maybeSingle();
  if (!doc) {
    const back = request.headers.get("referer") ?? `/aluno/aula/${material.lesson_id}`;
    return NextResponse.redirect(new URL(`/aluno/perfil?cpf=obrigatorio&voltar=${encodeURIComponent(new URL(back, request.url).pathname)}`, request.url));
  }

  const admin = createAdminClient();
  const { data: file, error } = await admin.storage.from("materiais").download(material.storage_path);
  if (error || !file) return NextResponse.json({ error: "Arquivo indisponível. Avise o suporte." }, { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return NextResponse.json({ error: "Arquivo inválido." }, { status: 422 });

  const owner = { name: user.fullName || user.email, cpf: doc.cpf, email: user.email, issuedAt: new Date() };
  const stamped = await stampPdf(bytes, owner);
  await admin.from("material_downloads").insert({ material_id: material.id, user_id: user.id, watermark: watermarkText(owner) });

  const filename = `${material.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(0, 80) || "material"}.pdf`;
  return new NextResponse(Buffer.from(stamped), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
