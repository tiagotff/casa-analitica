"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getSessionUser, homeFor } from "@/lib/auth/session";

export type FormState = { error?: string; success?: string } | undefined;

const safeNext = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
};

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse({
    email: form.get("email"), password: form.get("password"),
  });
  if (!parsed.success) return { error: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos. Confira os dados ou crie sua senha em “Esqueci a senha”." };

  const user = await getSessionUser();
  redirect(safeNext(form.get("voltar")) || homeFor(user?.roles ?? ["aluno"]));
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({
    fullName: z.string().trim().min(3, "Informe seu nome completo."),
    email: z.email("E-mail inválido."),
    password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
    terms: z.literal("on", { message: "Aceite os Termos de Uso e a Política de Privacidade." }),
  }).safeParse({ fullName: form.get("fullName"), email: form.get("email"), password: form.get("password"), terms: form.get("terms") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${env.siteUrl()}/auth/callback?voltar=${encodeURIComponent(safeNext(form.get("voltar")) || "/aluno")}`,
    },
  });
  if (error) return { error: error.message.includes("registered") ? "Este e-mail já tem cadastro. Entre ou recupere a senha." : "Não foi possível criar a conta agora. Tente de novo em alguns minutos." };
  return { success: "Conta criada. Enviamos um link de confirmação para o seu e-mail." };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "Informe um e-mail válido." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${env.siteUrl()}/auth/callback?voltar=/nova-senha` });
  return { success: "Se houver uma conta com esse e-mail, você vai receber o link para criar uma nova senha." };
}

export async function updatePassword(_: FormState, form: FormData): Promise<FormState> {
  const pwd = z.string().min(8).safeParse(form.get("password"));
  if (!pwd.success) return { error: "A senha precisa de pelo menos 8 caracteres." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: pwd.data });
  if (error) return { error: "O link expirou. Peça um novo em “Esqueci a senha”." };
  redirect("/aluno");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
