"use client";

import { useActionState } from "react";
import { subscribe } from "./actions";

export function AddonForm({ code, label }: { code: string; label: string }) {
  const [state, action, pending] = useActionState(subscribe, undefined);
  return (
    <form action={action} className="row">
      <input type="hidden" name="addon" value={code} />
      <select name="method" defaultValue="cartao" aria-label="Forma de pagamento" style={{ width: "auto" }}>
        <option value="cartao">Cartão</option><option value="pix">Pix</option><option value="boleto">Boleto</option>
      </select>
      <button className="btn" disabled={pending}>{pending ? "Gerando…" : label}</button>
      {state?.error && <p className="alert error" role="alert" style={{ width: "100%" }}>{state.error}</p>}
    </form>
  );
}
