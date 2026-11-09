import Link from "next/link";
import { ActionForm } from "@/components/AuthForm";
import { signUp } from "@/lib/auth/actions";

export const metadata = { title: "Criar conta" };

export default async function Page({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar = "" } = await searchParams;
  return (
    <div className="container section">
      <h1>Criar conta</h1>
      <ActionForm
        action={signUp}
        submit="Criar conta"
        hidden={{ voltar }}
        fields={[
          { name: "fullName", label: "Nome completo", autoComplete: "name" },
          { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
          { name: "password", label: "Senha (mínimo 8 caracteres)", type: "password", autoComplete: "new-password" },
        ]}
      >
        <label className="row" style={{ alignItems: "flex-start", gap: 8 }}>
          <input type="checkbox" name="terms" style={{ width: "auto", marginTop: 4 }} />
          <span>Li e aceito os <Link href="/termos">Termos de Uso</Link> e a <Link href="/privacidade">Política de Privacidade</Link>.</span>
        </label>
      </ActionForm>
      <p>Já tem conta? <Link href="/entrar">Entrar</Link></p>
    </div>
  );
}
