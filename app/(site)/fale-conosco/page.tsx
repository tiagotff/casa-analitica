import { ActionForm } from "@/components/AuthForm";
import { getSetting } from "@/lib/content";
import { sendContact } from "./actions";

export const metadata = { title: "Fale Conosco" };

export default async function Page() {
  const email = await getSetting("contact_email", "contato@casaanalitica.com.br");
  return (
    <div className="container section">
      <h1>Fale Conosco</h1>
      <p className="muted">Dúvidas sobre formações, planos ou pagamentos. Também atendemos por {email}.</p>
      <ActionForm
        action={sendContact}
        submit="Enviar mensagem"
        fields={[
          { name: "name", label: "Nome", autoComplete: "name" },
          { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
          { name: "subject", label: "Assunto" },
          { name: "message", label: "Mensagem", type: "textarea" },
        ]}
      />
    </div>
  );
}
