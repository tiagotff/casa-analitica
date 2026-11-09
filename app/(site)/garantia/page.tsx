import Link from "next/link";
import { InstitutionalPage } from "@/components/InstitutionalPage";

export const metadata = { title: "Garantia de 7 dias" };

export default function Page() {
  return (
    <InstitutionalPage slug="garantia">
      <div className="row">
        <Link className="btn" href="/cadastrar">Criar conta e avaliar o módulo 1</Link>
        <Link className="btn ghost" href="/planos">Ver planos</Link>
      </div>
    </InstitutionalPage>
  );
}
