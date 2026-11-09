import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { fmtDate } from "@/lib/student";

export const metadata = { title: "Alunos" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  await requireRole("suporte", "admin");
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, email, created_at, contracts(status, plans(name))").order("created_at", { ascending: false }).limit(50);
  const term = q.trim().replace(/[%,()]/g, "");
  if (term) query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  const { data: people } = await query;

  return (
    <>
      <h1>Alunos</h1>
      <form className="row" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por nome ou e-mail" aria-label="Buscar aluno" style={{ flex: 1, minWidth: 220 }} />
        <button className="btn">Buscar</button>
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Plano</th><th>Cadastro</th></tr></thead>
        <tbody>
          {(people ?? []).map((p) => {
            const c = p.contracts.find((x) => x.status === "ativo") ?? p.contracts.find((x) => x.status === "pendente");
            const plan = c ? (c.plans as unknown as { name: string }).name : null;
            return (
              <tr key={p.id}>
                <td><Link href={`/suporte/alunos/${p.id}`}>{p.full_name || "Sem nome"}</Link></td>
                <td>{p.email}</td>
                <td>{plan ? <span className={`pill ${c!.status === "ativo" ? "ok" : "warn"}`}>{plan}{c!.status === "pendente" ? " · pendente" : ""}</span> : <span className="pill off">Sem plano</span>}</td>
                <td className="num">{fmtDate(p.created_at)}</td>
              </tr>
            );
          })}
          {!people?.length && <tr><td colSpan={4} className="muted">Nenhum aluno encontrado.</td></tr>}
        </tbody>
      </table></div>
    </>
  );
}
