"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

async function audit(actor: string, action: string, entity: string, entityId: string, data: object = {}) {
  await createAdminClient().from("audit_log").insert({ actor_id: actor, action, entity, entity_id: entityId, data });
}

const RoleSchema = z.enum(["aluno", "professor", "suporte", "admin"]);

export async function grantRole(userId: string, form: FormData) {
  const admin = await requireRole("admin");
  const role = RoleSchema.parse(form.get("role"));
  const supabase = await createClient();
  await supabase.from("user_roles").upsert({ user_id: userId, role, granted_by: admin.id });
  await audit(admin.id, "perfil_concedido", "user", userId, { role });
  revalidatePath("/admin/usuarios");
}

export async function revokeRole(userId: string, role: string) {
  const admin = await requireRole("admin");
  const r = RoleSchema.parse(role);
  if (userId === admin.id && r === "admin") throw new Error("Você não pode remover o próprio perfil de administrador.");
  const supabase = await createClient();
  await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", r);
  await audit(admin.id, "perfil_removido", "user", userId, { role: r });
  revalidatePath("/admin/usuarios");
}

export async function setInstructor(userId: string, form: FormData) {
  const admin = await requireRole("admin");
  const formation = z.uuid().parse(form.get("formation"));
  const supabase = await createClient();
  await supabase.from("formation_instructors").upsert({ formation_id: formation, user_id: userId });
  await supabase.from("user_roles").upsert({ user_id: userId, role: "professor", granted_by: admin.id });
  await audit(admin.id, "professor_atribuido", "formation", formation, { user_id: userId });
  revalidatePath("/admin/usuarios");
}

export async function savePlan(form: FormData) {
  const admin = await requireRole("admin");
  const d = z.object({
    id: z.uuid(),
    price: z.string().transform((v) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100)).pipe(z.number().int().positive()),
    seats: z.string().optional().transform((v) => (v ? Number(v) : null)),
    sale_starts_at: z.string().optional(), sale_ends_at: z.string().optional(),
    active: z.string().optional(),
  }).parse(Object.fromEntries(form));
  const toIso = (v?: string) => (v ? new Date(v + ":00-03:00").toISOString() : null);
  const supabase = await createClient();
  const { error } = await supabase.from("plans").update({
    price_cents: d.price, seats: d.seats, sale_starts_at: toIso(d.sale_starts_at), sale_ends_at: toIso(d.sale_ends_at), active: d.active === "on",
  }).eq("id", d.id);
  if (error) throw new Error(error.message);
  await audit(admin.id, "plano_alterado", "plan", d.id, d);
  revalidatePath("/admin/planos");
}

export async function savePage(form: FormData) {
  const admin = await requireRole("admin");
  const d = z.object({ slug: z.string().min(1), title: z.string().min(2), body_md: z.string().min(1) }).parse(Object.fromEntries(form));
  const supabase = await createClient();
  await supabase.from("site_pages").upsert({ ...d, updated_by: admin.id, updated_at: new Date().toISOString() });
  revalidatePath("/admin/conteudo");
  revalidatePath(`/${d.slug}`);
}

export async function saveSetting(form: FormData) {
  await requireRole("admin");
  const key = z.string().min(1).parse(form.get("key"));
  const value = String(form.get("value") ?? "");
  const supabase = await createClient();
  await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export async function createVlogPost(form: FormData) {
  const admin = await requireRole("admin");
  const d = z.object({ title: z.string().min(3), excerpt: z.string().min(3), video_url: z.string().optional(), body_md: z.string().default("") }).parse(Object.fromEntries(form));
  const slug = d.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const supabase = await createClient();
  await supabase.from("vlog_posts").insert({ ...d, video_url: d.video_url || null, slug, author_id: admin.id, status: "publicado", published_at: new Date().toISOString() });
  revalidatePath("/vlog");
  revalidatePath("/admin/conteudo");
}
