import Link from "next/link";
import { InstitutionalPage } from "@/components/InstitutionalPage";

export const metadata = { title: "Conheça o plano anual" };

export default function Page() {
  return (
    <InstitutionalPage slug="plano-anual">
      <div className="row">
        <Link className="btn" href="/planos">Ver planos e valores</Link>
        <Link className="btn ghost" href="/cursos">Conhecer as formações</Link>
      </div>
    </InstitutionalPage>
  );
}
