import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { savePlan } from "../actions";

export const metadata = { title: "Planos e lotes" };

const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 16).replace(" ", "T") : "");

export default async function Page() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("*").order("rank");
  return (
    <>
      <h1>Planos e lotes</h1>
      <p className="muted">Mudanças de preço valem para novas contratações e novos upgrades. Contratos existentes guardam o preço da época.</p>
      <div className="stack">
        {(plans ?? []).map((p) => (
          <form key={p.id} action={savePlan} className="card">
            <input type="hidden" name="id" value={p.id} />
            <div className="row between"><h3>{p.name} <span className="note">({p.code} · {p.access_months ? `${p.access_months} meses` : "vitalício"})</span></h3>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" name="active" defaultChecked={p.active} style={{ width: "auto" }} /> Ativo</label></div>
            <div className="row">
              <div className="field" style={{ flex: 1, minWidth: 140 }}><label htmlFor={`p-${p.id}`}>Preço total (R$)</label><input id={`p-${p.id}`} name="price" defaultValue={(p.price_cents / 100).toFixed(2).replace(".", ",")} inputMode="decimal" /></div>
              {p.kind === "lote" && <div className="field" style={{ flex: 1, minWidth: 100 }}><label htmlFor={`v-${p.id}`}>Vagas</label><input id={`v-${p.id}`} name="seats" type="number" min={1} defaultValue={p.seats ?? ""} /></div>}
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor={`i-${p.id}`}>Início da venda</label><input id={`i-${p.id}`} name="sale_starts_at" type="datetime-local" defaultValue={toLocalInput(p.sale_starts_at)} /></div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label htmlFor={`f-${p.id}`}>Fim da venda</label><input id={`f-${p.id}`} name="sale_ends_at" type="datetime-local" defaultValue={toLocalInput(p.sale_ends_at)} /></div>
            </div>
            <div><button className="btn">Salvar</button></div>
          </form>
        ))}
      </div>
    </>
  );
}
