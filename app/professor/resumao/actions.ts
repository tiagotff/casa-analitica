"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function saveSession(form: FormData) {
  const d = z.object({
    formation_id: z.uuid(), week_number: z.coerce.number().int().min(1), title: z.string().trim().min(3),
    release_at: z.string().min(10), video_ref: z.string().trim().optional(), status: z.enum(["rascunho", "publicado"]),
  }).parse(Object.fromEntries(form));
  const supabase = await createClient();
  const { error } = await supabase.from("resumao_sessions").upsert({
    ...d, video_ref: d.video_ref || null, release_at: new Date(d.release_at + ":00-03:00").toISOString(),
  }, { onConflict: "formation_id,week_number" });
  if (error) throw new Error("Sem permissão para esta formação.");
  revalidatePath("/professor/resumao");
}
