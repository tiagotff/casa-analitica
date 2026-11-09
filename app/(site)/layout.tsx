import Link from "next/link";
import { Brand } from "@/components/Logo";
import { getSessionUser, homeFor } from "@/lib/auth/session";
import { getSetting } from "@/lib/content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, whatsapp] = await Promise.all([
    getSessionUser(),
    getSetting("whatsapp_community_url", "#"),
  ]);

  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link href="/" className="brand" aria-label="Casa Analítica, página inicial"><Brand /></Link>
          <nav className="site-nav" aria-label="Principal">
            <Link href="/cursos">Formações</Link>
            <Link href="/planos">Planos</Link>
            <Link href="/vlog">Conteúdos</Link>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">Comunidade</a>
          </nav>
          {user ? (
            <Link href={homeFor(user.roles)} className="btn purple header-cta">Minha área</Link>
          ) : (
            <Link href="/entrar" className="btn purple header-cta">Entrar</Link>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="cols">
            <section>
              <h2>Conteúdo</h2>
              <ul>
                <li><Link href="/cursos">Todos os Cursos</Link></li>
                <li><Link href="/trilhas">Trilhas de Carreira</Link></li>
                <li><Link href="/vlog">Vlog</Link></li>
                <li><Link href="/ebooks">E-books</Link></li>
              </ul>
            </section>
            <section>
              <h2>Sobre</h2>
              <ul>
                <li><Link href="/quem-somos">Quem Somos</Link></li>
                <li><Link href="/por-onde-comecar">Por onde começar em dados</Link></li>
                <li><Link href="/plano-anual">Conheça o plano anual</Link></li>
                <li><Link href="/fale-conosco">Fale Conosco</Link></li>
                <li><Link href="/privacidade">Política de Privacidade</Link></li>
                <li><Link href="/termos">Termos de Uso</Link></li>
              </ul>
            </section>
            <section>
              <h2>Saiba mais</h2>
              <ul>
                <li><Link href="/aluno">Meus Cursos</Link></li>
                <li><Link href="/garantia">Garantia de 7 dias</Link></li>
                <li><a href={whatsapp} target="_blank" rel="noopener noreferrer">Comunidade no WhatsApp</a></li>
              </ul>
            </section>
          </div>
          <div className="legal">
            <span>© {new Date().getFullYear()} Casa Analítica</span>
            <span>Conhecimento que se transforma em resultado.</span>
          </div>
        </div>
      </footer>
    </>
  );
}
