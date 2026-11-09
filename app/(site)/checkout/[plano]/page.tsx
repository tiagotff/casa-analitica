import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { brl } from "@/lib/billing/money";
import { CheckoutForm } from "./CheckoutForm";

export const metadata = { title: "Matrícula" };

export default async function Page({ params, searchParams }: { params: Promise<{ plano: string }>; searchParams: Promise<{ escopo?: string; formacao?: string }> }) {
  const { plano } = await params;
  const { escopo, formacao } = await searchParams;
  const user = await requireRole("aluno", "admin");
  const supabase = await createClient();
  const [{ data: plan }, { data: formations }, { data: billing }, { data: active }, { data: doc }] = await Promise.all([
    supabase.from("plan_availability").select("*").eq("code", plano).maybeSingle(),
    supabase.from("formations").select("id, name").eq("status", "publicado").order("position"),
    supabase.from("billing_customers").select("user_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("contracts").select("id").eq("user_id", user.id).eq("status", "ativo").maybeSingle(),
    supabase.from("profile_documents").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!plan) notFound();

  return (
    <div className="container section">
      <div className="stack" style={{ gap: 6 }}>
        <Link href="/planos" className="note">← Planos</Link>
        <h1>{plan.name}</h1>
        <p className="muted num">{brl(plan.price_cents)} por formação · {plan.access_months ? `${plan.access_months} meses de acesso` : "vitalício condicionado"}{plan.seats_left != null && ` · ${plan.seats_left} vagas restantes`}</p>
      </div>
      {active ? (
        <div className="card"><p>Você já tem um plano ativo. Para mudar de plano sem perder o que já pagou, use o upgrade.</p><div><Link className="btn" href="/aluno/plano">Ver opções de upgrade</Link></div></div>
      ) : !plan.on_sale ? (
        <p className="alert error">Esta oferta não está disponível agora.</p>
      ) : (
        <CheckoutForm
          planCode={plan.code}
          priceCents={plan.price_cents}
          allPriceCents={plan.all_formations_price_cents}
          maxInstallments={plan.max_installments}
          formations={formations ?? []}
          needsCpf={!billing && !doc}
          initialScope={escopo === "todas" ? "todas" : "uma"}
          initialFormation={formations?.find((f) => f.id === formacao)?.id}
        />
      )}
    </div>
  );
}
