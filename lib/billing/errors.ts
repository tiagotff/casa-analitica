/** Mensagens para os códigos de erro levantados pelas funções do banco e do serviço. */
const MESSAGES: Record<string, string> = {
  login_obrigatorio: "Entre na sua conta para continuar.",
  plano_indisponivel: "Este plano não está disponível para contratação.",
  fora_do_periodo_de_venda: "Esta oferta está fora do período de venda.",
  lote_esgotado: "As vagas deste lote acabaram. Confira o próximo lote.",
  lote_anterior_aberto: "Ainda há vagas no lote anterior, com preço menor.",
  ja_possui_contrato_ativo_use_upgrade: "Você já tem um plano ativo. Para mudar, use o upgrade em Meu plano.",
  quantidade_de_formacoes_invalida: "Escolha a formação incluída no plano.",
  formacao_invalida: "Formação inválida.",
  parcelas_invalidas: "Número de parcelas inválido.",
  upgrade_exige_plano_superior: "O upgrade precisa ser para um plano superior ao atual.",
  contrato_nao_ativo: "O upgrade exige um plano ativo.",
  cpf_obrigatorio: "Informe o CPF para emitir a cobrança.",
  complemento_indisponivel: "Este complemento não está disponível.",
  complemento_ainda_nao_disponivel: "Este complemento abre no segundo ano da escola.",
  exige_matricula_ativa: "Os complementos exigem uma formação ativa.",
  complemento_ja_contratado: "Você já tem este complemento.",
  upgrade_nao_reduz_formacoes: "Quem tem todas as formações não pode voltar para uma só no upgrade.",
  prazo_de_garantia_encerrado: "O prazo de 7 dias da garantia já terminou.",
  reembolso_em_analise: "Há um pedido de reembolso em análise. O upgrade fica disponível depois que ele for concluído ou recusado.",
  reembolso_ja_solicitado: "Você já pediu o reembolso deste plano. Acompanhe em Meu plano.",
  reembolso_de_upgrade_manual: "Reembolso de upgrade precisa ser tratado manualmente no painel do Asaas.",
};

export function friendlyError(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : String(e);
  const code = Object.keys(MESSAGES).find((k) => text.includes(k));
  return code ? MESSAGES[code] : "Não foi possível concluir agora. Tente de novo ou fale com o suporte.";
}
