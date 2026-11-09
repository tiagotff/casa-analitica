import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Role, ROLE_HOME } from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
};

/** Usuário logado + perfis de acesso (uma consulta por requisição). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    fullName: profile?.full_name ?? "",
    roles: (roles ?? []).map((r) => r.role as Role),
  };
});

/**
 * Guarda de rota no servidor. O banco (RLS) continua sendo a barreira final;
 * esta checagem só evita renderizar telas para quem não tem o perfil.
 */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  if (!user.roles.some((r) => allowed.includes(r))) redirect(homeFor(user.roles));
  return user;
}

export function homeFor(roles: Role[]): string {
  for (const r of ["admin", "suporte", "professor", "aluno"] as Role[]) if (roles.includes(r)) return ROLE_HOME[r];
  return "/";
}
