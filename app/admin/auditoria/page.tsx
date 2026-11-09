import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

export const metadata = { title: "Auditoria" };

export default async function Page() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: rows } = await supabase.from("audit_log").select("id, action, entity, entity_id, data, created_at, profiles(email)").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <h1>Auditoria</h1>
      <div className="table-wrap"><table>
        <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Registro</th><th>Detalhes</th></tr></thead>
        <tbody>{(rows ?? []).map((r) => (
          <tr key={r.id}>
            <td className="num">{new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
            <td>{(r.profiles as unknown as { email: string } | null)?.email ?? "sistema"}</td>
            <td>{r.action}</td><td className="note">{r.entity} {r.entity_id?.slice(0, 8)}</td>
            <td><code style={{ fontSize: ".75rem", wordBreak: "break-all" }}>{JSON.stringify(r.data)}</code></td>
          </tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
