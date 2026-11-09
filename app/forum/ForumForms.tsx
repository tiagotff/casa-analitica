"use client";

import { useActionState, useEffect, useRef } from "react";
import { createTopic, reply } from "./actions";

export function NewTopicForm({ spaces, initial }: { spaces: { slug: string; name: string }[]; initial: string }) {
  const [state, action, pending] = useActionState(createTopic, undefined);
  return (
    <form action={action} className="stack">
      <div className="row">
        <div className="field" style={{ flex: 2, minWidth: 200 }}><label htmlFor="space">Espaço</label>
          <select id="space" name="space" defaultValue={initial}>{spaces.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}</select></div>
        <div className="field" style={{ flex: 1, minWidth: 150 }}><label htmlFor="kind">Tipo</label>
          <select id="kind" name="kind" defaultValue="duvida"><option value="duvida">Dúvida</option><option value="discussao">Discussão</option></select></div>
      </div>
      <div className="field"><label htmlFor="title">Título</label><input id="title" name="title" required minLength={5} maxLength={160} placeholder="Resuma em uma frase" /></div>
      <div className="field"><label htmlFor="body">Mensagem</label><textarea id="body" name="body" required maxLength={8000} placeholder="Conte o contexto, o que já tentou e onde travou" /></div>
      {state?.error && <p className="alert error">{state.error}</p>}
      <div><button className="btn" disabled={pending}>{pending ? "Publicando…" : "Publicar tópico"}</button></div>
    </form>
  );
}

export function ReplyForm({ topicId }: { topicId: string }) {
  const [state, action, pending] = useActionState(reply, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.success) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="stack">
      <input type="hidden" name="topic" value={topicId} />
      <div className="field"><label htmlFor="reply">Sua resposta</label><textarea id="reply" name="body" required maxLength={8000} /></div>
      {state?.error && <p className="alert error">{state.error}</p>}
      <div><button className="btn" disabled={pending}>{pending ? "Publicando…" : "Responder"}</button></div>
    </form>
  );
}
