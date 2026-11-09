import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";

/** Formações que o usuário leciona (admin vê todas). */
export async function myTeachingFormations(user: SessionUser) {
  const supabase = await createClient();
  if (user.roles.includes("admin")) {
    const { data } = await supabase.from("formations").select("id, slug, name, status").order("position");
    return data ?? [];
  }
  const { data } = await supabase.from("formation_instructors").select("formations(id, slug, name, status)").eq("user_id", user.id);
  return (data ?? []).map((r) => r.formations as unknown as { id: string; slug: string; name: string; status: string });
}
