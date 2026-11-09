import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Espaços do fórum que o usuário pode ver: Geral + formações com acesso (ou que modera). */
export async function forumSpaces() {
  const supabase = await createClient();
  const { data: formations } = await supabase.from("formations").select("id, slug, name").eq("status", "publicado").order("position");
  const allowed = await Promise.all((formations ?? []).map(async (f) => {
    const { data } = await supabase.rpc("can_access_forum", { p_formation: f.id });
    return data ? f : null;
  }));
  return [{ id: null as string | null, slug: "geral", name: "Geral" }, ...allowed.filter(Boolean).map((f) => ({ id: f!.id as string | null, slug: f!.slug, name: f!.name }))];
}

export async function authorInfo(ids: string[]) {
  const supabase = await createClient();
  if (!ids.length) return { name: new Map<string, string>(), team: new Set<string>() };
  const [{ data: names }, { data: flags }] = await Promise.all([
    supabase.rpc("public_names", { p_users: ids }),
    supabase.rpc("staff_flags", { p_users: ids }),
  ]);
  return {
    name: new Map((names as { user_id: string; name: string }[] ?? []).map((n) => [n.user_id, n.name])),
    team: new Set((flags as { user_id: string; is_team: boolean }[] ?? []).filter((f) => f.is_team).map((f) => f.user_id)),
  };
}

export const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
