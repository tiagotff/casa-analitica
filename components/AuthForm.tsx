"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/auth/actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string; required?: boolean };

/** Formulário genérico com estado de erro/sucesso vindo de uma Server Action. */
export function ActionForm({
  action, fields, submit, hidden, children,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  submit: string;
  hidden?: Record<string, string>;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="form">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {fields.map((f) => (
        <div className="field" key={f.name}>
          <label htmlFor={f.name}>{f.label}</label>
          {f.type === "textarea"
            ? <textarea id={f.name} name={f.name} required={f.required ?? true} />
            : <input id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required={f.required ?? true} />}
        </div>
      ))}
      {children}
      {state?.error && <p className="alert error" role="alert">{state.error}</p>}
      {state?.success && <p className="alert success" role="status">{state.success}</p>}
      <div><button className="btn" type="submit" disabled={pending}>{pending ? "Enviando…" : submit}</button></div>
    </form>
  );
}
