import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth/session";
import { AREA_NAV } from "@/lib/auth/nav";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("admin");
  return (
    <AppShell user={user} area="admin" nav={AREA_NAV.admin}>{children}</AppShell>
  );
}
