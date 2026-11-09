"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/actions";

/** Marca ou desmarca a aula. O RLS só aceita se o aluno puder assistir à aula. */
export async function toggleLessonDone(lessonId: string, done: boolean) {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("lesson_progress").upsert(
    { user_id: user.id, lesson_id: lessonId, completed_at: done ? new Date().toISOString() : null },
    { onConflict: "user_id,lesson_id" },
  );
  revalidatePath(`/aluno/aula/${lessonId}`);
}

/** Comentário novo ou resposta. O RLS exige acesso à aula; o banco achata respostas em um nível. */
export async function addComment(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { error: "Entre para comentar." };
  const d = z.object({
    lesson: z.uuid(), parent: z.uuid().optional(),
    body: z.string().trim().min(1, "Escreva o comentário.").max(4000, "Comentário muito longo (máximo 4.000 caracteres)."),
  }).safeParse({ lesson: form.get("lesson"), parent: form.get("parent") || undefined, body: form.get("body") });
  if (!d.success) return { error: d.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_comments").insert({ lesson_id: d.data.lesson, user_id: user.id, parent_id: d.data.parent ?? null, body: d.data.body });
  if (error) return { error: "Não foi possível publicar. Confira se você tem acesso a esta aula." };
  revalidatePath(`/aluno/aula/${d.data.lesson}`);
  return { success: "Publicado." };
}

/** Ocultar (moderação) — o banco só aceita de professor da formação, suporte ou admin. */
export async function hideComment(lessonId: string, commentId: string) {
  const supabase = await createClient();
  await supabase.from("lesson_comments").update({ hidden_at: new Date().toISOString() }).eq("id", commentId);
  revalidatePath(`/aluno/aula/${lessonId}`);
}

export async function deleteOwnComment(lessonId: string, commentId: string) {
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.from("lesson_comments").delete().eq("id", commentId).eq("user_id", user.id);
  revalidatePath(`/aluno/aula/${lessonId}`);
}
