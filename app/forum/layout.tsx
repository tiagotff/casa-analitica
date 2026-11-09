import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSessionUser } from "@/lib/auth/session";
import { AREA_NAV, primaryArea } from "@/lib/auth/nav";

/** Fórum: qualquer usuário logado entra; o que cada um vê é decidido pelo RLS. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?voltar=/forum");
  const area = primaryArea(user.roles);
  return <AppShell user={user} area={area} nav={AREA_NAV[area]}>{children}</AppShell>;
}
