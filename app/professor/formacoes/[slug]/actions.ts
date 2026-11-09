"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { looksLikePdf } from "@/lib/watermark";
import { createVideo, deleteVideo, tusUploadAuth } from "@/lib/video";

const LessonSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(3),
  summary: z.string().trim().max(2000).default(""),
  release_at: z.string().min(10),
  status: z.enum(["rascunho", "publicado", "arquivado"]),
});

/** Edição feita com o cliente do usuário: o RLS só aceita professor da formação ou admin. */
export async function saveLesson(slug: string, form: FormData) {
  const d = LessonSchema.parse(Object.fromEntries(form));
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({
    title: d.title, summary: d.summary, status: d.status,
    release_at: new Date(d.release_at + ":00-03:00").toISOString(),
  }).eq("id", d.id);
  if (error) throw new Error("Sem permissão para editar esta aula.");
  revalidatePath(`/professor/formacoes/${slug}`);
}

export async function addLesson(slug: string, moduleId: string, form: FormData) {
  const title = z.string().trim().min(3).parse(form.get("title"));
  const supabase = await createClient();
  const { data: last } = await supabase.from("lessons").select("position, release_at").eq("module_id", moduleId).order("position", { ascending: false }).limit(1).maybeSingle();
  const release = last ? new Date(new Date(last.release_at).getTime() + 7 * 86400000) : new Date();
  const { error } = await supabase.from("lessons").insert({ module_id: moduleId, position: (last?.position ?? 0) + 1, title, release_at: release.toISOString(), status: "rascunho" });
  if (error) throw new Error("Sem permissão para criar aula neste módulo.");
  revalidatePath(`/professor/formacoes/${slug}`);
}

const MAX_PDF = 50 * 1024 * 1024;

/** Upload de material: só PDF (tipo e assinatura do arquivo), permissão conferida pelo RLS antes de gravar. */
export async function uploadMaterial(slug: string, lessonId: string, form: FormData) {
  const user = await getSessionUser();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  if (!user || !(file instanceof File) || !file.size || !title) return;
  if (file.size > MAX_PDF) throw new Error("O PDF passa de 50 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type !== "application/pdf" || !looksLikePdf(bytes)) throw new Error("Envie um arquivo PDF.");

  const supabase = await createClient();
  const safe = file.name.replace(/\.pdf$/i, "").replace(/[^\w.-]/g, "_").slice(0, 80) || "material";
  const path = `${lessonId}/${Date.now()}-${safe}.pdf`;
  const { data: row, error } = await supabase.from("lesson_materials")
    .insert({ lesson_id: lessonId, title, kind: "pdf", storage_path: path, size_bytes: file.size }).select("id").single();
  if (error || !row) throw new Error("Sem permissão para anexar material a esta aula.");

  const { error: upErr } = await createAdminClient().storage.from("materiais").upload(path, bytes, { contentType: "application/pdf" });
  if (upErr) {
    await supabase.from("lesson_materials").delete().eq("id", row.id);
    throw new Error("Falha no upload: " + upErr.message);
  }
  revalidatePath(`/professor/formacoes/${slug}`);
}

export async function removeMaterial(slug: string, materialId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_materials").delete().eq("id", materialId).select("storage_path").maybeSingle();
  if (data) await createAdminClient().storage.from("materiais").remove([data.storage_path]);
  revalidatePath(`/professor/formacoes/${slug}`);
}

/** Confere no banco se o usuário é professor da formação da aula ou admin. */
async function canManageVideo(lessonId: string) {
  const supabase = await createClient();
  const { data: formation } = await supabase.rpc("lesson_formation", { p_lesson: lessonId });
  const [{ data: instr }, { data: admin }] = await Promise.all([
    supabase.rpc("is_instructor_of", { p_formation: formation }),
    supabase.rpc("has_role", { p_role: "admin" }),
  ]);
  return Boolean(instr || admin);
}

/** Passo 1 do envio de vídeo: cria o vídeo no Bunny e devolve a assinatura do upload TUS. */
export async function startVideoUpload(lessonId: string, title: string) {
  if (!(await canManageVideo(lessonId))) throw new Error("Só o professor da formação ou o admin enviam vídeos.");
  const videoId = await createVideo(title);
  return tusUploadAuth(videoId);
}

/** Passo 2: depois do upload, liga o vídeo à aula (o RLS confere de novo) e apaga o anterior. */
export async function confirmVideoUpload(slug: string, lessonId: string, videoId: string) {
  if (!(await canManageVideo(lessonId))) throw new Error("Sem permissão.");
  const supabase = await createClient();
  const { data: old } = await supabase.from("lesson_media").select("video_ref").eq("lesson_id", lessonId).maybeSingle();
  const { error } = await supabase.from("lesson_media").upsert({ lesson_id: lessonId, provider: "bunny", video_ref: videoId, updated_at: new Date().toISOString() });
  if (error) throw new Error("Não foi possível ligar o vídeo à aula.");
  if (old?.video_ref && old.video_ref !== videoId) await deleteVideo(old.video_ref);
  await createAdminClient().from("audit_log").insert({ actor_id: (await getSessionUser())?.id, action: "video_enviado", entity: "lesson", entity_id: lessonId });
  revalidatePath(`/professor/formacoes/${slug}`);
}

export async function removeVideo(slug: string, lessonId: string) {
  if (!(await canManageVideo(lessonId))) throw new Error("Sem permissão.");
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_media").delete().eq("lesson_id", lessonId).select("video_ref").maybeSingle();
  if (data?.video_ref) await deleteVideo(data.video_ref);
  revalidatePath(`/professor/formacoes/${slug}`);
}
