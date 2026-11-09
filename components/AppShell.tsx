import Link from "next/link";
import { Brand } from "@/components/Logo";
import { signOut } from "@/lib/auth/actions";
import { ROLE_HOME, ROLE_LABEL, type Role } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";

export function AppShell({ user, area, nav, children }: {
  user: SessionUser;
  area: Role;
  nav: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const otherAreas = (["aluno", "professor", "suporte", "admin"] as Role[]).filter((r) => r !== area && user.roles.includes(r));
  return (
    <div className="app-shell">
      <aside className="app-side">
        <Link href="/" className="brand" aria-label="Casa Analítica, site"><Brand /></Link>
        <nav aria-label={ROLE_LABEL[area]}>
          {nav.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
        </nav>
        <div className="who">
          <strong>{user.fullName || user.email}</strong>
          <span>{ROLE_LABEL[area]}</span>
          {otherAreas.map((r) => <Link key={r} href={ROLE_HOME[r]}>Ir para {ROLE_LABEL[r]}</Link>)}
          <form action={signOut}><button type="submit">Sair</button></form>
        </div>
      </aside>
      <main className="app-main"><div className="wrap">{children}</div></main>
    </div>
  );
}
