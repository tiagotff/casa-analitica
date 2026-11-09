import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Meus dados" };

export default async function Page({ searchParams }: { searchParams: Promise<{ cpf?: string; voltar?: string }> }) {
  const { cpf, voltar } = await searchParams;
  const user = await requireRole("aluno", "admin");
  const supabase = await createClient();
  const [{ data: p }, { data: doc }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single(),
    supabase.from("profile_documents").select("cpf").eq("user_id", user.id).maybeSingle(),
  ]);
  const masked = doc ? doc.cpf.replace(/^(\d{3})\d{6}(\d{2})$/, "$1.***.***-$2") : null;
  return (
    <>
      <h1>Meus dados</h1>
      {cpf === "obrigatorio" && !doc && <p className="alert error">Para baixar materiais, informe seu CPF. Ele vai na marca d&apos;água dos PDFs.</p>}
      <p className="muted">E-mail de acesso: {p?.email}.</p>
      <ProfileForm fullName={p?.full_name ?? ""} phone={p?.phone ?? ""} maskedCpf={masked} voltar={cpf === "obrigatorio" ? voltar : undefined} />
    </>
  );
}
