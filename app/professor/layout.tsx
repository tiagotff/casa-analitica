import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/session";
import { AREA_NAV } from "@/lib/auth/nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("professor", "admin");
  return (
    <AppShell user={user} area="professor" nav={AREA_NAV.professor}>{children}</AppShell>
  );
}
