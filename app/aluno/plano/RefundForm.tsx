"use client";

import { useActionState } from "react";
import { askRefund } from "./actions";

export function RefundForm({ contractId, deadline }: { contractId: string; deadline: string }) {
  const [state, action, pending] = useActionState(askRefund, undefined);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="contract" value={contractId} />
      <p className="muted">Você pode pedir a devolução integral do valor pago até <strong>{deadline}</strong>. O acesso é encerrado quando o reembolso for concluído.</p>
      <div className="field"><label htmlFor="reason">Conte o motivo (opcional)</label><textarea id="reason" name="reason" style={{ minHeight: 80 }} /></div>
      {state?.error && <p className="alert error">{state.error}</p>}
      {state?.success && <p className="alert success">{state.success}</p>}
      {!state?.success && <div><button className="btn ghost" disabled={pending}>Solicitar reembolso</button></div>}
    </form>
  );
}
