import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Retorno dos links de confirmação de e-mail e recuperação de senha. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("voltar") ?? "/aluno";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/aluno";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safe, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
}
