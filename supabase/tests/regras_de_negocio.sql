-- Testes de regras de negócio e de perfis de acesso.
-- Rode em um banco descartável depois das migrations e do seed:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/regras_de_negocio.sql
-- Cada bloco levanta exceção se a regra não for respeitada.

-- Preparação: abre as vendas agora e libera a 1ª aula do módulo 2 de cada formação
-- (o módulo 1 é de avaliação e já fica aberto a qualquer usuário logado)
update public.plans set sale_starts_at = now() - interval '1 day', sale_ends_at = now() + interval '30 days';
update public.lessons l set release_at = now() - interval '1 day'
  from public.modules m where m.id = l.module_id and m.position = 2 and l.position = 1;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ana@teste.com',   '{"full_name":"Ana Aluna"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bruno@teste.com', '{"full_name":"Bruno Aluno"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carla@teste.com', '{"full_name":"Carla Professora"}'),
  ('00000000-0000-0000-0000-00000000000d', 'davi@teste.com',  '{"full_name":"Davi Suporte"}');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-00000000000c', 'professor'), ('00000000-0000-0000-0000-00000000000d', 'suporte');
insert into public.formation_instructors select id, '00000000-0000-0000-0000-00000000000c' from public.formations where slug = 'ciencia-dados-ia';

do $$ begin
  assert (select count(*) from public.profiles) = 4, 'trigger deve criar 4 perfis';
  assert (select count(*) from public.user_roles where role = 'aluno') = 4, 'todo cadastro recebe perfil aluno';
end $$;

-- 1) Lotes em sequência: não dá para comprar o 2º lote com o 1º aberto
begin;
set local role authenticated; set local request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.start_checkout('lote2', array[(select id from public.formations where slug='ciencia-dados-ia')], 'cartao', 12);
  raise exception 'deveria bloquear o 2º lote';
exception when others then
  assert sqlerrm like '%lote_anterior_aberto%', 'erro inesperado: ' || sqlerrm;
end $$;
rollback;

-- 2) Checkout do 1º lote pela Ana (cartão, 12x)
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select public.start_checkout('lote1', array[(select id from public.formations where slug='ciencia-dados-ia')], 'cartao', 12) as ana_contrato \gset
reset role;

-- O servidor (service role) registra as 12 parcelas e ativa após o 1º pagamento
insert into public.installments (contract_id, number, amount_cents, due_date, gateway_payment_id)
select :'ana_contrato', n, case when n = 12 then 99900 - 8325*11 else 8325 end, current_date + (n-1) * 30, 'pay_ana_' || n
from generate_series(1, 12) n;
update public.installments set status = 'paga', paid_at = now() where contract_id = :'ana_contrato' and number <= 3;
select public.activate_contract(:'ana_contrato');
select public.activate_contract(:'ana_contrato'); -- idempotente

do $$ begin
  assert (select status from public.contracts where user_id = '00000000-0000-0000-0000-00000000000a') = 'ativo', 'contrato da Ana deve estar ativo';
  assert (select access_ends_at::date from public.contracts where user_id = '00000000-0000-0000-0000-00000000000a') = (now() + interval '12 months')::date, '12 meses de acesso';
  assert public.seats_taken((select id from public.plans where code='lote1')) = 1, 'uma vaga consumida';
end $$;

-- 3) Acesso ao conteúdo pela Ana
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare liberada uuid; futura uuid; outra uuid;
begin
  select l.id into liberada from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id
    where f.slug='ciencia-dados-ia' and m.position=2 and l.position=1;
  select l.id into futura from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id
    where f.slug='ciencia-dados-ia' and m.position=3 and l.position=1;
  select l.id into outra from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id
    where f.slug='negocios-analytics' and m.position=2 and l.position=1;
  assert public.can_view_lesson(liberada), 'Ana deve ver aula liberada da sua formação';
  assert not public.can_view_lesson(futura), 'aula futura bloqueada';
  assert not public.can_view_lesson(outra), 'formação fora do plano bloqueada';
  insert into public.lesson_progress (user_id, lesson_id, completed_at) values (auth.uid(), liberada, now());
  begin
    insert into public.lesson_progress (user_id, lesson_id, completed_at) values (auth.uid(), outra, now());
    raise exception 'não deveria registrar progresso em aula sem acesso';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.contracts (user_id, plan_id, list_price_cents, amount_due_cents, installments_count, payment_method, status)
    values (auth.uid(), (select id from public.plans where code='legado'), 1, 1, 1, 'pix', 'ativo');
    raise exception 'aluno não pode criar contrato direto';
  exception when insufficient_privilege then null; end;
  begin
    perform public.activate_contract((select id from public.contracts limit 1));
    raise exception 'aluno não pode ativar contrato';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 4) Bruno não vê nada financeiro da Ana; suporte vê
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.contracts) = 0, 'Bruno não vê contrato alheio';
  assert (select count(*) from public.installments) = 0, 'Bruno não vê parcelas alheias';
  assert (select count(*) from public.profiles) = 1, 'Bruno só vê o próprio perfil';
  assert (select count(*) from public.lesson_media) = 0, 'sem plano, sem vídeo';
end $$;
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
do $$ begin
  assert (select count(*) from public.installments) = 12, 'suporte vê as parcelas';
  assert (select count(*) from public.profiles) = 4, 'suporte vê todos os perfis';
  update public.plans set price_cents = 1;  -- RLS: suporte não altera planos (0 linhas)
  assert (select price_cents from public.plans where code = 'lote1') = 99900, 'suporte não pode mudar preço';
  begin
    insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
    raise exception 'suporte não pode se promover';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 5) Professora edita só a própria formação
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$
declare n int;
begin
  update public.lessons set summary = 'ok' where id in (select l.id from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id where f.slug='ciencia-dados-ia');
  get diagnostics n = row_count; assert n = 20, 'professora edita as 20 aulas da sua formação';
  update public.lessons set summary = 'x' where id in (select l.id from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id where f.slug='negocios-analytics');
  get diagnostics n = row_count; assert n = 0, 'professora não edita formação alheia';
  assert (select students from public.instructor_formation_stats((select id from public.formations where slug='ciencia-dados-ia'))) = 1, 'estatística com 1 aluna';
  assert (select count(*) from public.profiles) = 2, 'professora vê o próprio perfil e o da aluna da sua formação';
end $$;
reset role;

-- 6) Upgrade da Ana: 1º lote (3 parcelas pagas) → Continuidade
update public.plans set sale_starts_at = now() - interval '1 day' where kind = 'plano';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare q record;
begin
  select * into q from public.upgrade_quote((select id from public.contracts where status='ativo'), 'continuidade');
  assert q.credit_cents = 24975, 'crédito = 3 × 83,25: ' || q.credit_cents;
  assert q.pending_cents = 99900 - 24975, 'pendente = restante do lote';
  assert q.amount_due_cents = 562800 - 24975, 'a pagar = 5.628,00 − 249,75';
  begin
    perform public.upgrade_quote((select id from public.contracts where status='ativo'), 'lote1');
    raise exception 'mesma oferta, mesmo escopo não é upgrade';
  exception when others then assert sqlerrm like '%upgrade_exige_plano_superior%', sqlerrm; end;
  begin
    perform public.upgrade_quote((select id from public.contracts where status='ativo'), 'lote3');
    raise exception 'não aceita outro lote como destino';
  exception when others then assert sqlerrm like '%plano_indisponivel%', sqlerrm; end;
end $$;
select public.start_upgrade((select id from public.contracts where status='ativo'), 'continuidade', 'pix', 12) as ana_upgrade \gset
reset role;
insert into public.installments (contract_id, number, amount_cents, due_date, gateway_payment_id, status, paid_at)
values (:'ana_upgrade', 1, 44819, current_date, 'pay_up_1', 'paga', now());
select public.activate_contract(:'ana_upgrade');

do $$ begin
  assert (select status from public.contracts where id = (select id from public.contracts where user_id='00000000-0000-0000-0000-00000000000a' and plan_id=(select id from public.plans where code='lote1'))) = 'substituido', 'contrato antigo substituído';
  assert (select count(*) from public.installments where contract_id = (select id from public.contracts where user_id='00000000-0000-0000-0000-00000000000a' and plan_id=(select id from public.plans where code='lote1')) and status = 'cancelada') = 9, '9 parcelas pendentes canceladas';
  assert (select canceled_pending_cents from public.upgrades) = 99900 - 24975, 'upgrade registra o pendente cancelado';
  assert (select access_ends_at::date from public.contracts where id = (select id from public.contracts where user_id='00000000-0000-0000-0000-00000000000a' and status='ativo')) = (now() + interval '24 months')::date, 'acesso reiniciado com 24 meses';
  assert (select count(*) from public.contract_formations where contract_id = (select id from public.contracts where user_id='00000000-0000-0000-0000-00000000000a' and status='ativo')) = 1, 'formação levada para o novo contrato';
  assert public.seats_taken((select id from public.plans where code='lote1')) = 1, 'vaga do lote continua consumida após upgrade';
end $$;

-- 7) Upgrade em cadeia carrega o crédito: Continuidade → Legado
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare q record;
begin
  select * into q from public.upgrade_quote((select id from public.contracts where status='ativo'), 'legado');
  assert q.credit_cents = 24975 + 44819, 'crédito acumulado: ' || q.credit_cents;
  assert q.amount_due_cents = 838800 - 24975 - 44819, 'a pagar no Legado';
  begin
    perform public.upgrade_quote((select id from public.contracts where status='ativo'), 'essencial');
    raise exception 'não permite downgrade';
  exception when others then assert sqlerrm like '%upgrade_exige_plano_superior%', sqlerrm; end;
end $$;
reset role;

-- 8) Lote esgotado e reserva de vaga
update public.plans set seats = 1 where code = 'lote1';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  perform public.start_checkout('lote1', array[(select id from public.formations where slug='negocios-analytics')], 'pix', 1);
  raise exception 'lote deveria estar esgotado';
exception when others then assert sqlerrm like '%lote_esgotado%', sqlerrm;
end $$;
-- com o 1º lote esgotado, o 2º abre
select public.start_checkout('lote2', array[(select id from public.formations where slug='negocios-analytics')], 'pix', 1) is not null as bruno_lote2;
do $$ begin
  begin
    perform public.start_checkout('legado', array[]::uuid[], 'pix', 1);
    raise exception 'exige escolher a formação';
  exception when others then assert sqlerrm like '%quantidade_de_formacoes_invalida%', sqlerrm; end;
end $$;
reset role;

-- 9) Resumão: só com complemento ativo
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
insert into public.resumao_sessions (formation_id, week_number, title, release_at, status)
values ((select id from public.formations where slug='ciencia-dados-ia'), 1, 'Semana 1', now() - interval '1 hour', 'publicado');
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin assert (select count(*) from public.resumao_sessions) = 0, 'sem complemento, sem Resumão'; end $$;
reset role;
insert into public.addon_subscriptions (user_id, addon_id, status, monthly_price_cents)
values ('00000000-0000-0000-0000-00000000000a', (select id from public.addons where code='resumao'), 'ativa', 14900);
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin assert (select count(*) from public.resumao_sessions) = 1, 'com complemento, vê o Resumão'; end $$;
reset role;

-- 10) Visitante anônimo
set role anon; set request.jwt.claim.sub = '';
do $$ begin
  assert (select count(*) from public.formations) = 6, 'catálogo público';
  assert (select count(*) from public.lessons) = 120, 'ementa pública';
  assert (select count(*) from public.lesson_media) = 0, 'vídeo nunca é público';
  assert (select count(*) from public.contracts) = 0, 'financeiro nunca é público';
  assert (select count(*) from public.plan_availability) = 7, 'vitrine de planos pública';
end $$;
insert into public.contact_messages (name, email, subject, message) values ('Visitante', 'v@teste.com', 'Dúvida', 'Como funciona o parcelamento?');
reset role;

-- 11) Módulo 1 aberto para avaliação, sem plano; módulo 2 continua fechado
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000d';
do $$ begin
  assert public.can_view_lesson((select l.id from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id
    where f.slug='engenharia-dados-cloud' and m.position=1 and l.position=4)), 'módulo 1 inteiro aberto para avaliação';
  assert not public.can_view_lesson((select l.id from public.lessons l join public.modules m on m.id=l.module_id join public.formations f on f.id=m.formation_id
    where f.slug='engenharia-dados-cloud' and m.position=2 and l.position=1)), 'módulo 2 exige a formação';
end $$;
reset role;
set role anon; set request.jwt.claim.sub = '';
do $$ begin
  assert not public.can_view_lesson((select l.id from public.lessons l join public.modules m on m.id=l.module_id where m.is_preview limit 1)), 'avaliação exige conta';
end $$;
reset role;

-- 12) Pacote com todas as formações: preço × 1,95 e acesso a todas
do $$ begin
  assert (select all_formations_price_cents from public.plans where code='lote2') = round(229900 * 1.95), 'preço do pacote';
end $$;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000e', 'eva@teste.com');
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
select public.start_checkout('lote2', array[]::uuid[], 'pix', 1, true) as eva_contrato \gset
reset role;
insert into public.installments (contract_id, number, amount_cents, due_date, gateway_payment_id, status, paid_at)
values (:'eva_contrato', 1, 448305, current_date, 'pay_eva_1', 'paga', now());
select public.activate_contract(:'eva_contrato');
do $$ begin
  assert (select list_price_cents from public.contracts where user_id='00000000-0000-0000-0000-00000000000e') = 448305, 'contrato registra o preço do pacote';
  assert (select bool_and(public.user_has_formation('00000000-0000-0000-0000-00000000000e', id)) from public.formations), 'pacote libera as 6 formações';
  assert not public.user_has_formation('00000000-0000-0000-0000-00000000000b', (select id from public.formations where slug='ciencia-dados-ia')), 'sem contrato ativo, sem formação';
end $$;
-- Upgrade de escopo na mesma oferta: Ana (Continuidade, 1 formação) → Continuidade com todas
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare q record;
begin
  select * into q from public.upgrade_quote((select id from public.contracts where status='ativo'), 'continuidade', true);
  assert q.target_price_cents = round(562800 * 1.95), 'destino é o pacote da mesma oferta';
  assert q.amount_due_cents = round(562800 * 1.95) - (24975 + 44819), 'crédito descontado do pacote';
end $$;
reset role;
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000e';
do $$ begin
  perform public.upgrade_quote((select id from public.contracts where status='ativo'), 'legado', false);
  raise exception 'pacote não volta para uma formação';
exception when others then assert sqlerrm like '%upgrade_nao_reduz_formacoes%', sqlerrm;
end $$;

-- 13) Garantia de 7 dias
select public.request_refund((select id from public.contracts where status='ativo'), 'Não era o que eu esperava') as eva_pedido \gset
do $$ begin
  perform public.start_upgrade((select id from public.contracts where status='ativo'), 'legado', 'pix', 1, true);
  raise exception 'upgrade deveria ficar bloqueado com reembolso em análise';
exception when others then assert sqlerrm like '%reembolso_em_analise%', sqlerrm;
end $$;
do $$ begin
  perform public.request_refund((select id from public.contracts where status='ativo'), 'de novo');
  raise exception 'não aceita dois pedidos';
exception when others then assert sqlerrm like '%reembolso_ja_solicitado%', sqlerrm;
end $$;
do $$ begin
  perform public.finalize_refund((select id from public.refund_requests limit 1), auth.uid());
  raise exception 'aluno não conclui reembolso';
exception when insufficient_privilege then null;
end $$;
reset role;
select public.finalize_refund(:'eva_pedido', '00000000-0000-0000-0000-00000000000d');
do $$ begin
  assert (select status from public.contracts where user_id='00000000-0000-0000-0000-00000000000e') = 'reembolsado', 'contrato reembolsado';
  assert (select refunded_cents from public.refund_requests) = 448305, 'valor devolvido = valor pago';
  assert not public.user_has_formation('00000000-0000-0000-0000-00000000000e', (select id from public.formations limit 1)), 'acesso encerrado após reembolso';
end $$;
-- Fora do prazo: Ana com acesso liberado há 8 dias
update public.contracts set activated_at = now() - interval '8 days' where user_id='00000000-0000-0000-0000-00000000000a' and status='ativo';
set role authenticated; set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  perform public.request_refund((select id from public.contracts where status='ativo'), 'tarde demais');
  raise exception 'prazo deveria ter acabado';
exception when others then assert sqlerrm like '%prazo_de_garantia_encerrado%', sqlerrm;
end $$;
reset role;
