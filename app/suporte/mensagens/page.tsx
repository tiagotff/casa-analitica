import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { fmtDate } from "@/lib/student";
import { setMessageStatus } from "./actions";

export const metadata = { title: "Fale Conosco" };

const LABEL = { nova: ["warn", "Nova"], em_atendimento: ["info", "Em atendimento"], resolvida: ["ok", "Resolvida"] } as const;

export default async function Page() {
  await requireRole("suporte", "admin");
  const supabase = await createClient();
  const { data: msgs } = await supabase.from("contact_messages").select("id, name, email, subject, message, status, created_at").order("created_at", { ascending: false }).limit(100);
  return (
    <>
      <h1>Fale Conosco</h1>
      <div className="stack">
        {(msgs ?? []).map((m) => {
          const [cls, label] = LABEL[m.status as keyof typeof LABEL];
          return (
            <article key={m.id} className="card">
              <div className="row between"><h3>{m.subject}</h3><span className={`pill ${cls}`}>{label}</span></div>
              <p className="note">{m.name} · {m.email} · {fmtDate(m.created_at)}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.message}</p>
              <div className="row">
                {m.status === "nova" && <form action={setMessageStatus.bind(null, m.id, "em_atendimento")}><button className="btn ghost">Assumir</button></form>}
                {m.status !== "resolvida" && <form action={setMessageStatus.bind(null, m.id, "resolvida")}><button className="btn ghost">Marcar como resolvida</button></form>}
              </div>
            </article>
          );
        })}
        {!msgs?.length && <p className="muted">Nenhuma mensagem.</p>}
      </div>
    </>
  );
}
