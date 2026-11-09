import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signedOriginalUrl } from "@/lib/video";

/**
 * Download do vídeo original: só professor da formação e admin.
 * O RLS de lesson_media só devolve a linha para eles; aluno recebe 403.
 */
export async function GET(_: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const supabase = await createClient();
  const { data: media } = await supabase.from("lesson_media").select("video_ref").eq("lesson_id", lessonId).maybeSingle();
  if (!media) return NextResponse.json({ error: "Sem permissão para baixar este vídeo." }, { status: 403 });
  const url = signedOriginalUrl(media.video_ref);
  if (!url) return NextResponse.json({ error: "Download de original não configurado (BUNNY_CDN_HOST/BUNNY_CDN_TOKEN_KEY)." }, { status: 501 });
  return NextResponse.redirect(url);
}
