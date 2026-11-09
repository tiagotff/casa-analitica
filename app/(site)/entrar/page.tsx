import Link from "next/link";
import { ActionForm } from "@/components/AuthForm";
import { signIn } from "@/lib/auth/actions";

export const metadata = { title: "Entrar" };

export default async function Page({ searchParams }: { searchParams: Promise<{ voltar?: string }> }) {
  const { voltar = "" } = await searchParams;
  return (
    <div className="container section">
      <h1>Entrar</h1>
      <ActionForm
        action={signIn}
        submit="Entrar"
        hidden={{ voltar }}
        fields={[
          { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
          { name: "password", label: "Senha", type: "password", autoComplete: "current-password" },
        ]}
      />
      <div className="row">
        <Link href={`/cadastrar${voltar ? `?voltar=${encodeURIComponent(voltar)}` : ""}`}>Criar conta</Link>
        <Link href="/recuperar-senha">Esqueci a senha</Link>
      </div>
    </div>
  );
}
