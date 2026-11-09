"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/lib/auth/actions";

export function CommentForm({ action, lessonId, parentId, placeholder, submit }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  lessonId: string; parentId?: string; placeholder: string; submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.success) ref.current?.reset(); }, [state]);
  const id = `c-${parentId ?? "novo"}`;
  return (
    <form ref={ref} action={formAction} className="stack" style={{ gap: 8 }}>
      <input type="hidden" name="lesson" value={lessonId} />
      {parentId && <input type="hidden" name="parent" value={parentId} />}
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <textarea id={id} name="body" placeholder={placeholder} required maxLength={4000} style={{ minHeight: parentId ? 60 : 90 }} />
      {state?.error && <p className="alert error">{state.error}</p>}
      <div><button className="btn sm" disabled={pending}>{pending ? "Publicando…" : submit}</button></div>
    </form>
  );
}
