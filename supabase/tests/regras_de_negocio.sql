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
