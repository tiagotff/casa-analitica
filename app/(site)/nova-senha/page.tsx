import { ActionForm } from "@/components/AuthForm";
import { updatePassword } from "@/lib/auth/actions";

export const metadata = { title: "Nova senha" };

export default function Page() {
  return (
    <div className="container section">
      <h1>Criar nova senha</h1>
      <ActionForm action={updatePassword} submit="Salvar senha" fields={[{ name: "password", label: "Nova senha (mínimo 8 caracteres)", type: "password", autoComplete: "new-password" }]} />
    </div>
  );
}
