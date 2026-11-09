import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/session";
import { AREA_NAV } from "@/lib/auth/nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("suporte", "admin");
  return (
    <AppShell user={user} area="suporte" nav={AREA_NAV.suporte}>{children}</AppShell>
  );
}
