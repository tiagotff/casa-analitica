import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { grantRole, revokeRole, setInstructor } from "../actions";

export const metadata = { title: "Usuários e perfis" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  await requireRole("admin");
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, email, user_roles(role), formation_instructors(formations(name))").order("created_at", { ascending: false }).limit(50);
  const term = q.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const [{ data: people }, { data: formations }] = await Promise.all([query, supabase.from("formations").select("id, name").order("position")]);

  return (
    <>
      <h1>Usuários e perfis</h1>
      <p className="muted">Todo cadastro novo recebe o perfil Aluno. Conceda os demais perfis aqui; cada mudança fica na auditoria.</p>
      <form className="row" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar usuário" style={{ flex: 1, minWidth: 220 }} />
        <button className="btn">Buscar</button>
      </form>
      <div className="stack">
        {(people ?? []).map((p) => {
          const roles = p.user_roles.map((r) => r.role as Role);
          const teaches = p.formation_instructors.map((fi) => (fi.formations as unknown as { name: string }).name);
          return (
            <div key={p.id} className="card">
              <div className="row between">
                <div><strong>{p.full_name || "Sem nome"}</strong> <span className="note">{p.email}</span></div>
                <Link className="note" href={`/suporte/alunos/${p.id}`}>Ver ficha</Link>
              </div>
              <div className="row">
                {roles.map((r) => (
                  <form key={r} action={revokeRole.bind(null, p.id, r)} className="row" style={{ gap: 4 }}>
                    <span className="pill info">{ROLE_LABEL[r]}</span>
                    <button className="btn ghost" style={{ padding: "2px 8px" }} aria-label={`Remover perfil ${ROLE_LABEL[r]}`}>×</button>
                  </form>
                ))}
              </div>
              {teaches.length > 0 && <p className="note">Leciona: {teaches.join(", ")}</p>}
              <div className="row">
                <form action={grantRole.bind(null, p.id)} className="row">
                  <select name="role" aria-label="Perfil" style={{ width: "auto" }}>
                    {(["aluno", "professor", "suporte", "admin"] as Role[]).filter((r) => !roles.includes(r)).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button className="btn ghost">Conceder perfil</button>
                </form>
                <form action={setInstructor.bind(null, p.id)} className="row">
                  <select name="formation" aria-label="Formação" style={{ width: "auto" }}>{(formations ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
                  <button className="btn ghost">Atribuir como professor</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
