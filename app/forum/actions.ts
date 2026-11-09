"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/actions";

export async function createTopic(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?voltar=/forum");
  const d = z.object({
    space: z.string(), kind: z.enum(["duvida", "discussao"]),
    title: z.string().trim().min(5, "O título precisa de pelo menos 5 caracteres.").max(160),
    body: z.string().trim().min(1, "Descreva sua dúvida ou o assunto.").max(8000),
  }).safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };
  const supabase = await createClient();
  const formation = d.data.space === "geral" ? null : (await supabase.from("formations").select("id").eq("slug", d.data.space).maybeSingle()).data?.id ?? null;
  const { data, error } = await supabase.from("forum_topics")
    .insert({ user_id: user.id, formation_id: formation, kind: d.data.kind, title: d.data.title, body: d.data.body }).select("id").single();
  if (error || !data) return { error: "Você não tem acesso a este espaço do fórum." };
  redirect(`/forum/${data.id}`);
}

export async function reply(_: FormState, form: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar?voltar=/forum");
  const d = z.object({ topic: z.uuid(), body: z.string().trim().min(1, "Escreva a resposta.").max(8000) }).safeParse(Object.fromEntries(form));
  if (!d.success) return { error: d.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("forum_posts").insert({ topic_id: d.data.topic, user_id: user.id, body: d.data.body });
  if (error) return { error: "Não foi possível responder neste tópico." };
  revalidatePath(`/forum/${d.data.topic}`);
  return { success: "Resposta publicada." };
}

/** Ações de autor e moderação. O banco (triggers + RLS) decide quem pode cada uma. */
export async function topicAction(topicId: string, action: "aceitar" | "resolver" | "reabrir" | "fixar" | "desafixar" | "ocultar", postId?: string) {
  const supabase = await createClient();
  const patch =
    action === "aceitar" ? { accepted_post_id: postId } :
    action === "resolver" ? { status: "resolvido" } :
    action === "reabrir" ? { status: "aberto", accepted_post_id: null } :
    action === "fixar" ? { pinned: true } :
    action === "desafixar" ? { pinned: false } :
    { hidden_at: new Date().toISOString() };
  await supabase.from("forum_topics").update(patch).eq("id", topicId);
  revalidatePath(`/forum/${topicId}`);
  revalidatePath("/forum");
}

export async function hidePost(topicId: string, postId: string) {
  const supabase = await createClient();
  await supabase.from("forum_posts").update({ hidden_at: new Date().toISOString() }).eq("id", postId);
  revalidatePath(`/forum/${topicId}`);
}
