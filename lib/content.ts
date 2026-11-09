import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function getSetting<T = string>(key: string, fallback: T): Promise<T> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

export async function getPage(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("site_pages").select("slug, title, body_md, updated_at").eq("slug", slug).maybeSingle();
  return data;
}

/** Markdown simples das páginas institucionais: parágrafos separados por linha em branco. */
export function paragraphs(md: string): string[] {
  return md.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export async function getFormations() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("formations")
    .select("id, slug, name, summary, accent_color, hours_planned, modules(id, lessons(id, kind))")
    .eq("status", "publicado")
    .order("position");
  return data ?? [];
}

export async function getFormationBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("formations")
    .select("id, slug, name, summary, description, accent_color, hours_planned, modules(id, position, title, lessons(id, position, title, kind, duration_min, release_at, status))")
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  data.modules.sort((a, b) => a.position - b.position);
  data.modules.forEach((m) => m.lessons.sort((a, b) => a.position - b.position));
  return data;
}
