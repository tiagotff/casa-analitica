"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";

export function ProfileForm({ fullName, phone, maskedCpf, voltar }: { fullName: string; phone: string; maskedCpf: string | null; voltar?: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  return (
    <form action={action} className="form">
      {voltar && <input type="hidden" name="voltar" value={voltar} />}
      <div className="field"><label htmlFor="full_name">Nome completo</label><input id="full_name" name="full_name" defaultValue={fullName} autoComplete="name" /></div>
      <div className="field"><label htmlFor="phone">Celular</label><input id="phone" name="phone" defaultValue={phone} autoComplete="tel" /></div>
      <div className="field">
        <label htmlFor="cpf">CPF</label>
        {maskedCpf
          ? <input id="cpf" value={maskedCpf} disabled />
          : <input id="cpf" name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" required={Boolean(voltar)} />}
        <span className="note">{maskedCpf ? "Para alterar o CPF, fale com o suporte." : "Usado na marca d'água dos materiais em PDF e na emissão de cobranças."}</span>
      </div>
      {state?.error && <p className="alert error">{state.error}</p>}
      {state?.success && <p className="alert success">{state.success}</p>}
      <div><button className="btn" disabled={pending}>Salvar</button></div>
    </form>
  );
}
