import type { Role } from "@/lib/auth/roles";

/** Menu lateral de cada área. O fórum é compartilhado por todos os perfis. */
export const AREA_NAV: Record<Role, { href: string; label: string }[]> = {
  aluno: [
    { href: "/aluno", label: "Início" },
    { href: "/forum", label: "Fórum" },
    { href: "/aluno/resumao", label: "Resumão Guiado" },
    { href: "/aluno/plano", label: "Meu plano" },
    { href: "/aluno/perfil", label: "Meus dados" },
    { href: "/trilhas", label: "Trilhas de Carreira" },
  ],
  professor: [
    { href: "/professor", label: "Minhas formações" },
    { href: "/forum", label: "Fórum" },
    { href: "/professor/resumao", label: "Resumão Guiado" },
  ],
  suporte: [
    { href: "/suporte", label: "Alunos" },
    { href: "/forum", label: "Fórum" },
    { href: "/suporte/financeiro", label: "Cobranças" },
    { href: "/suporte/reembolsos", label: "Reembolsos" },
    { href: "/suporte/mensagens", label: "Fale Conosco" },
  ],
  admin: [
    { href: "/admin", label: "Visão geral" },
    { href: "/forum", label: "Fórum" },
    { href: "/admin/usuarios", label: "Usuários e perfis" },
    { href: "/admin/planos", label: "Planos e lotes" },
    { href: "/admin/conteudo", label: "Conteúdo do site" },
    { href: "/admin/auditoria", label: "Auditoria" },
  ],
};

export function primaryArea(roles: Role[]): Role {
  return (["admin", "suporte", "professor", "aluno"] as Role[]).find((r) => roles.includes(r)) ?? "aluno";
}
