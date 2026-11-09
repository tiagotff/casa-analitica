import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Lesson = { id: string; title: string; kind: string; duration_min: number; release_at: string; position: number };
export type Module = { id: string; position: number; title: string; lessons: Lesson[] };

/** Contrato ativo (ou o pendente mais recente) do aluno logado, com plano e formações. */
export async function getMyContracts(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contracts")
    .select("id, status, all_formations, list_price_cents, upgrade_credit_cents, amount_due_cents, installments_count, payment_method, access_starts_at, access_ends_at, activated_at, created_at, previous_contract_id, plans(code, name, kind, rank, access_months, includes_future_formations), contract_formations(formation_id, formations(name)), installments(id, number, amount_cents, due_date, status, invoice_url, paid_at), refund_requests(id, status, requested_at, refunded_cents, staff_note)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const all = data ?? [];
  all.forEach((c) => c.installments.sort((a, b) => a.number - b.number));
  return {
    active: all.find((c) => c.status === "ativo") ?? null,
    pending: all.find((c) => c.status === "pendente") ?? null,
    history: all.filter((c) => c.status !== "ativo" && c.status !== "pendente"),
  };
}

/** Formações a que o aluno tem direito, com módulos, aulas e progresso. */
export async function getMyFormations(userId: string) {
  const supabase = await createClient();
  const [{ data: formations }, { data: progress }] = await Promise.all([
    supabase.from("formations").select("id, slug, name, summary, accent_color, launched_at, modules(id, position, title, is_preview, lessons(id, title, kind, duration_min, release_at, position))").eq("status", "publicado").order("position"),
    supabase.from("lesson_progress").select("lesson_id, completed_at").eq("user_id", userId),
  ]);
  const done = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));

  const checks = await Promise.all((formations ?? []).map(async (f) => {
    const { data } = await supabase.rpc("user_has_formation", { p_user: userId, p_formation: f.id });
    return Boolean(data);
  }));

  return (formations ?? []).map((f, i) => {
    const modules = [...f.modules].sort((a, b) => a.position - b.position)
      .map((m) => ({ ...m, lessons: [...m.lessons].sort((a, b) => a.position - b.position) }));
    const lessons = modules.flatMap((m) => m.lessons);
    const previewIds = new Set(modules.filter((m) => m.is_preview).flatMap((m) => m.lessons.map((l) => l.id)));
    const completed = lessons.filter((l) => done.has(l.id)).length;
    const now = Date.now();
    return {
      ...f, modules, owned: checks[i], lessons, done, previewIds,
      progress: lessons.length ? Math.round((100 * completed) / lessons.length) : 0,
      completed,
      next: lessons.find((l) => new Date(l.release_at).getTime() <= now && !done.has(l.id)) ?? null,
      upcoming: lessons.filter((l) => new Date(l.release_at).getTime() > now).slice(0, 3),
    };
  });
}

export const fmtDate = (d: string | null, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }) =>
  d ? new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }) : "—";

export const INSTALLMENT_PILL: Record<string, [string, string]> = {
  paga: ["ok", "Paga"], pendente: ["info", "A vencer"], vencida: ["bad", "Vencida"], cancelada: ["off", "Cancelada"], estornada: ["warn", "Estornada"],
};
