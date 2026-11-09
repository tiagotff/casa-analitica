export type Role = "aluno" | "professor" | "suporte" | "admin";

export const ROLE_LABEL: Record<Role, string> = {
  aluno: "Aluno",
  professor: "Professor",
  suporte: "Suporte e financeiro",
  admin: "Administrador",
};

export const ROLE_HOME: Record<Role, string> = {
  aluno: "/aluno",
  professor: "/professor",
  suporte: "/suporte",
  admin: "/admin",
};

/** Quem pode abrir cada área do app. Admin entra em todas. */
export const AREA_ACCESS: Record<string, Role[]> = {
  "/aluno": ["aluno", "admin"],
  "/professor": ["professor", "admin"],
  "/suporte": ["suporte", "admin"],
  "/admin": ["admin"],
};
