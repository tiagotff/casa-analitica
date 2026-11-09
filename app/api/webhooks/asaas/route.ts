import { NextResponse } from "next/server";
import { gateway } from "@/lib/billing/asaas";
import { processGatewayEvent } from "@/lib/billing/service";

/**
 * Webhook do Asaas. Configure em Integrações > Webhooks com a URL
 * https://SEU-DOMINIO/api/webhooks/asaas e o mesmo token de ASAAS_WEBHOOK_TOKEN.
 * Responde 200 rápido para eventos já processados (idempotência por gateway_events).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "corpo_invalido" }, { status: 400 });
  }

  let event;
  try {
    event = gateway.parseWebhook(request.headers, body);
  } catch {
    return NextResponse.json({ error: "nao_autorizado" }, { status: 401 });
  }

  try {
    const result = await processGatewayEvent(event, body);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("Falha ao processar webhook", event.eventId, e);
    // 500 faz o Asaas reenviar o evento depois.
    return NextResponse.json({ error: "falha_no_processamento" }, { status: 500 });
  }
}
