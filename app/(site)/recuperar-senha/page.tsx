import { ActionForm } from "@/components/AuthForm";
import { requestPasswordReset } from "@/lib/auth/actions";

export const metadata = { title: "Recuperar senha" };

export default function Page() {
  return (
    <div className="container section">
      <h1>Recuperar senha</h1>
      <p className="muted">Enviamos um link para você criar uma nova senha.</p>
      <ActionForm action={requestPasswordReset} submit="Enviar link" fields={[{ name: "email", label: "E-mail", type: "email", autoComplete: "email" }]} />
    </div>
  );
}
