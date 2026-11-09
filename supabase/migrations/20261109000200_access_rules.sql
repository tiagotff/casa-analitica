-- =============================================================================
-- Casa Analítica · regras de acesso, regras de negócio e RLS
-- Funções "security definer" usam search_path vazio e nomes qualificados.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create trigger profiles_touch     before update on public.profiles        for each row execute function public.touch_updated_at();
create trigger installments_touch before update on public.installments    for each row execute function public.touch_updated_at();
create trigger progress_touch     before update on public.lesson_progress for each row execute function public.touch_updated_at();

-- Todo cadastro novo vira perfil "aluno".
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'aluno');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Perfis de acesso
-- -----------------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('suporte', 'admin'))
$$;

create or replace function public.is_instructor_of(p_formation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.formation_instructors where formation_id = p_formation and user_id = auth.uid())
$$;

create or replace function public.lesson_formation(p_lesson uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.formation_id from public.lessons l join public.modules m on m.id = l.module_id where l.id = p_lesson
$$;

-- -----------------------------------------------------------------------------
-- Direito de acesso ao conteúdo
-- -----------------------------------------------------------------------------
-- Contrato ativo e dentro da vigência (access_ends_at nulo = vitalício condicionado).
create or replace function public.active_contract(p_user uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select c.id from public.contracts c
  where c.user_id = p_user and c.status = 'ativo'
    and c.access_starts_at <= now()
    and (c.access_ends_at is null or c.access_ends_at > now())
  limit 1
$$;

-- O aluno tem a formação se ela é a formação contratada, se contratou o pacote
-- com todas as formações, ou (Legado) se a formação foi lançada depois do início do acesso.
create or replace function public.user_has_formation(p_user uuid, p_formation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.contracts c
    join public.plans p on p.id = c.plan_id
    join public.formations f on f.id = p_formation
    where c.id = public.active_contract(p_user)
      and (
        exists (select 1 from public.contract_formations cf where cf.contract_id = c.id and cf.formation_id = p_formation)
        or c.all_formations
        or (p.includes_future_formations and f.launched_at > c.access_starts_at)
      )
  )
$$;

-- Regras de acesso à aula:
--   * módulo de avaliação (is_preview): qualquer usuário logado, sem esperar a liberação semanal;
--   * demais módulos: só quem tem a formação e depois da data de liberação semanal (release_at).
create or replace function public.can_view_lesson(p_lesson uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin')
      or public.is_instructor_of(public.lesson_formation(p_lesson))
      or exists (
        select 1 from public.lessons l join public.modules m on m.id = l.module_id
        where l.id = p_lesson and l.status = 'publicado' and auth.uid() is not null
          and (
            m.is_preview
            or (l.release_at <= now() and public.user_has_formation(auth.uid(), m.formation_id))
          )
      )
$$;

create or replace function public.has_addon_benefit(p_user uuid, p_benefit text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.addon_subscriptions s join public.addons a on a.id = s.addon_id
    where s.user_id = p_user and s.status = 'ativa' and a.grants @> array[p_benefit]
  )
$$;

create or replace function public.can_view_resumao(p_session uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin')
      or exists (select 1 from public.resumao_sessions s where s.id = p_session and public.is_instructor_of(s.formation_id))
      or exists (
        select 1 from public.resumao_sessions s
        where s.id = p_session and s.status = 'publicado' and s.release_at <= now()
          and public.has_addon_benefit(auth.uid(), 'resumao')
          and public.user_has_formation(auth.uid(), s.formation_id)
      )
$$;

-- -----------------------------------------------------------------------------
-- Lotes: vagas
-- Uma vaga é consumida por contrato ativo, substituído (fez upgrade depois)
-- ou pendente dentro do prazo de reserva.
-- -----------------------------------------------------------------------------
create or replace function public.seats_taken(p_plan uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.contracts c
  where c.plan_id = p_plan
    and (c.status in ('ativo', 'substituido') or (c.status = 'pendente' and c.hold_until > now()))
$$;

create or replace view public.plan_availability with (security_invoker = true) as
select p.id, p.code, p.name, p.kind, p.price_cents, p.all_formations_price_cents, p.all_access_multiplier,
       p.max_installments, p.access_months, p.includes_future_formations, p.rank, p.seats,
       p.sale_starts_at, p.sale_ends_at,
       case when p.seats is null then null else greatest(p.seats - public.seats_taken(p.id), 0) end as seats_left,
       (p.active
        and (p.sale_starts_at is null or p.sale_starts_at <= now())
        and (p.sale_ends_at is null or p.sale_ends_at > now())
        and (p.seats is null or public.seats_taken(p.id) < p.seats)) as on_sale
from public.plans p
where p.active;

-- -----------------------------------------------------------------------------
-- Checkout: cria o contrato pendente e reserva a vaga de forma atômica.
-- Lotes são vendidos em sequência: o 2º só abre quando o 1º esgota (ou encerra).
-- -----------------------------------------------------------------------------
-- p_all_formations = false: o aluno escolhe exatamente 1 formação e paga o preço da oferta.
-- p_all_formations = true:  todas as formações, preço × multiplicador (1,95).
create or replace function public.start_checkout(
  p_plan_code text, p_formations uuid[], p_method public.payment_method, p_installments integer,
  p_all_formations boolean default false
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_plan public.plans;
  v_contract uuid;
  v_hold timestamptz;
  v_price integer;
begin
  if v_user is null then raise exception 'login_obrigatorio'; end if;

  select * into v_plan from public.plans where code = p_plan_code and active for update;
  if not found then raise exception 'plano_indisponivel'; end if;
  if (v_plan.sale_starts_at is not null and v_plan.sale_starts_at > now())
     or (v_plan.sale_ends_at is not null and v_plan.sale_ends_at <= now()) then
    raise exception 'fora_do_periodo_de_venda';
  end if;
  if p_installments < 1 or p_installments > v_plan.max_installments then raise exception 'parcelas_invalidas'; end if;

  if v_plan.kind = 'lote' then
    if public.seats_taken(v_plan.id) >= v_plan.seats then raise exception 'lote_esgotado'; end if;
    if exists (
      select 1 from public.plans prev
      where prev.kind = 'lote' and prev.active and prev.rank < v_plan.rank
        and (prev.sale_ends_at is null or prev.sale_ends_at > now())
        and public.seats_taken(prev.id) < prev.seats
    ) then raise exception 'lote_anterior_aberto'; end if;
    v_hold := now() + interval '3 days';
  end if;

  if public.active_contract(v_user) is not null then raise exception 'ja_possui_contrato_ativo_use_upgrade'; end if;

  if not p_all_formations then
    if coalesce(array_length(p_formations, 1), 0) <> 1 then raise exception 'quantidade_de_formacoes_invalida'; end if;
    if not exists (select 1 from public.formations x where x.id = p_formations[1] and x.status = 'publicado') then
      raise exception 'formacao_invalida';
    end if;
  end if;
  v_price := case when p_all_formations then v_plan.all_formations_price_cents else v_plan.price_cents end;

  -- Substitui um checkout pendente anterior do mesmo aluno.
  update public.contracts set status = 'cancelado', closed_at = now()
  where user_id = v_user and status = 'pendente';

  insert into public.contracts (user_id, plan_id, all_formations, list_price_cents, amount_due_cents, installments_count, payment_method, hold_until)
  values (v_user, v_plan.id, p_all_formations, v_price, v_price, p_installments, p_method, v_hold)
  returning id into v_contract;

  if not p_all_formations then
    insert into public.contract_formations (contract_id, formation_id) values (v_contract, p_formations[1]);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, data)
  values (v_user, 'checkout_iniciado', 'contract', v_contract::text,
          jsonb_build_object('plano', p_plan_code, 'todas_as_formacoes', p_all_formations));
  return v_contract;
end $$;

-- -----------------------------------------------------------------------------
-- Upgrade (Política de Upgrade da Casa Analítica)
--   crédito      = valor efetivamente pago no contrato atual
--                  (inclui o crédito que ele já trouxe de um upgrade anterior)
--   valor a pagar = preço vigente do destino − crédito  (nunca negativo)
--   parcelas pendentes do contrato atual são canceladas na ativação, sem cobrança dupla
-- Destinos válidos:
--   * plano regular superior, mantendo ou ampliando o escopo (1 formação → todas);
--   * a mesma oferta atual, ampliando de 1 formação para todas.
-- Quem já tem todas as formações não volta para uma só.
-- -----------------------------------------------------------------------------
create or replace function public.upgrade_quote(p_contract uuid, p_target_code text, p_all_formations boolean default null)
returns table (current_plan text, target_plan text, all_formations boolean, target_price_cents integer, credit_cents integer,
               pending_cents integer, amount_due_cents integer, new_access_months integer)
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.contracts; cur public.plans; tgt public.plans; v_paid integer; v_pending integer; v_all boolean;
begin
  select * into c from public.contracts where id = p_contract;
  if not found or (c.user_id <> auth.uid() and not public.is_staff()) then raise exception 'contrato_nao_encontrado'; end if;
  if c.status <> 'ativo' then raise exception 'contrato_nao_ativo'; end if;
  v_all := coalesce(p_all_formations, c.all_formations);
  if c.all_formations and not v_all then raise exception 'upgrade_nao_reduz_formacoes'; end if;

  select * into cur from public.plans where id = c.plan_id;
  select * into tgt from public.plans where code = p_target_code and active;
  if not found then raise exception 'plano_indisponivel'; end if;
  if not (
       (tgt.kind = 'plano' and tgt.rank > cur.rank)
    or (tgt.id = cur.id and v_all and not c.all_formations)
  ) then
    if tgt.kind <> 'plano' and tgt.id <> cur.id then raise exception 'plano_indisponivel'; end if;
    raise exception 'upgrade_exige_plano_superior';
  end if;

  select coalesce(sum(amount_cents) filter (where status = 'paga'), 0)::int,
         coalesce(sum(amount_cents) filter (where status in ('pendente', 'vencida')), 0)::int
    into v_paid, v_pending
  from public.installments where contract_id = c.id;

  return query
  select cur.name, tgt.name, v_all,
         case when v_all then tgt.all_formations_price_cents else tgt.price_cents end,
         c.upgrade_credit_cents + v_paid, v_pending,
         greatest(case when v_all then tgt.all_formations_price_cents else tgt.price_cents end - (c.upgrade_credit_cents + v_paid), 0),
         tgt.access_months;
end $$;

create or replace function public.start_upgrade(
  p_contract uuid, p_target_code text, p_method public.payment_method, p_installments integer,
  p_all_formations boolean default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare q record; v_new uuid; v_target uuid; c public.contracts;
begin
  select * into c from public.contracts where id = p_contract and user_id = auth.uid() for update;
  if not found then raise exception 'contrato_nao_encontrado'; end if;
  -- Com pedido de reembolso em análise, o contrato não pode ser trocado por upgrade.
  if exists (select 1 from public.refund_requests where contract_id = p_contract and status = 'solicitado') then
    raise exception 'reembolso_em_analise';
  end if;
  select * into q from public.upgrade_quote(p_contract, p_target_code, p_all_formations);
  if p_installments < 1 or p_installments > 12 then raise exception 'parcelas_invalidas'; end if;
  select id into v_target from public.plans where code = p_target_code;

  update public.contracts set status = 'cancelado', closed_at = now()
  where user_id = auth.uid() and status = 'pendente';

  insert into public.contracts (user_id, plan_id, all_formations, list_price_cents, upgrade_credit_cents, amount_due_cents,
                                installments_count, payment_method, previous_contract_id)
  values (auth.uid(), v_target, q.all_formations, q.target_price_cents, least(q.credit_cents, q.target_price_cents), q.amount_due_cents,
          case when q.amount_due_cents = 0 then 1 else p_installments end, p_method, p_contract)
  returning id into v_new;

  if not q.all_formations then
    insert into public.contract_formations (contract_id, formation_id)
    select v_new, formation_id from public.contract_formations where contract_id = p_contract;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, data)
  values (auth.uid(), 'upgrade_iniciado', 'contract', v_new::text, to_jsonb(q));
  return v_new;
end $$;

-- Chamada pelo servidor (service role) quando o 1º pagamento é confirmado.
-- Inicia um período integral de acesso e, se for upgrade, encerra o contrato anterior.
create or replace function public.activate_contract(p_contract uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.contracts; p public.plans; v_canceled integer;
begin
  select * into c from public.contracts where id = p_contract for update;
  if not found then raise exception 'contrato_nao_encontrado'; end if;
  if c.status = 'ativo' then return; end if;               -- idempotente
  if c.status <> 'pendente' then raise exception 'contrato_nao_pendente'; end if;
  select * into p from public.plans where id = c.plan_id;

  if c.previous_contract_id is not null then
    update public.installments set status = 'cancelada'
    where contract_id = c.previous_contract_id and status in ('pendente', 'vencida');
    get diagnostics v_canceled = row_count;

    insert into public.upgrades (from_contract_id, to_contract_id, credit_cents, canceled_pending_cents, amount_due_cents)
    select c.previous_contract_id, c.id, c.upgrade_credit_cents,
           coalesce((select sum(amount_cents) from public.installments
                     where contract_id = c.previous_contract_id and status = 'cancelada'), 0),
           c.amount_due_cents;

    update public.contracts set status = 'substituido', closed_at = now() where id = c.previous_contract_id;
  end if;

  update public.contracts
     set status = 'ativo', activated_at = now(), hold_until = null,
         access_starts_at = now(),
         access_ends_at = case when p.access_months is null then null else now() + make_interval(months => p.access_months) end
   where id = c.id;

  insert into public.audit_log (action, entity, entity_id, data)
  values ('contrato_ativado', 'contract', c.id::text, jsonb_build_object('plano', p.code));
end $$;

-- -----------------------------------------------------------------------------
-- Garantia de 7 dias
-- O aluno pode pedir o dinheiro de volta em até 7 dias corridos depois que o
-- acesso foi liberado (activated_at). O suporte conclui o pedido; o servidor
-- estorna no gateway e chama finalize_refund.
-- -----------------------------------------------------------------------------
create or replace function public.refund_deadline(p_contract uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select activated_at + interval '7 days' from public.contracts where id = p_contract
$$;

create or replace function public.request_refund(p_contract uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c public.contracts; v_id uuid;
begin
  select * into c from public.contracts where id = p_contract and user_id = auth.uid() for update;
  if not found then raise exception 'contrato_nao_encontrado'; end if;
  if c.status <> 'ativo' or c.activated_at is null then raise exception 'contrato_nao_ativo'; end if;
  if now() > c.activated_at + interval '7 days' then raise exception 'prazo_de_garantia_encerrado'; end if;
  insert into public.refund_requests (contract_id, user_id, reason) values (c.id, c.user_id, coalesce(p_reason, ''))
  returning id into v_id;
  insert into public.audit_log (actor_id, action, entity, entity_id) values (auth.uid(), 'reembolso_solicitado', 'contract', c.id::text);
  return v_id;
exception when unique_violation then raise exception 'reembolso_ja_solicitado';
end $$;

-- Executada pelo servidor depois de estornar e cancelar as cobranças no gateway.
create or replace function public.finalize_refund(p_request uuid, p_staff uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.refund_requests; v_paid integer;
begin
  select * into r from public.refund_requests where id = p_request for update;
  if not found or r.status <> 'solicitado' then raise exception 'pedido_invalido'; end if;
  -- 'estornada' entra na conta caso o webhook do estorno chegue antes desta função.
  select coalesce(sum(amount_cents) filter (where status in ('paga', 'estornada')), 0) into v_paid from public.installments where contract_id = r.contract_id;

  update public.installments set status = 'estornada' where contract_id = r.contract_id and status = 'paga';
  update public.installments set status = 'cancelada' where contract_id = r.contract_id and status in ('pendente', 'vencida');
  update public.contracts set status = 'reembolsado', access_ends_at = now(), closed_at = now() where id = r.contract_id;
  update public.refund_requests set status = 'concluido', refunded_cents = v_paid, handled_by = p_staff, handled_at = now() where id = r.id;
  insert into public.audit_log (actor_id, action, entity, entity_id, data)
  values (p_staff, 'reembolso_concluido', 'contract', r.contract_id::text, jsonb_build_object('valor_cents', v_paid));
end $$;

revoke execute on function public.finalize_refund(uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_refund(uuid, uuid) to service_role;
revoke execute on function public.request_refund(uuid, text) from anon;

revoke execute on function public.activate_contract(uuid) from public, anon, authenticated;
grant execute on function public.activate_contract(uuid) to service_role;
revoke execute on function public.start_checkout(text, uuid[], public.payment_method, integer, boolean) from anon;
revoke execute on function public.start_upgrade(uuid, text, public.payment_method, integer, boolean) from anon;
revoke execute on function public.upgrade_quote(uuid, text, boolean) from anon;

-- Estatísticas para o professor: só das próprias formações.
create or replace function public.instructor_formation_stats(p_formation uuid)
returns table (students integer, avg_progress numeric, completed_lessons integer)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_instructor_of(p_formation) or public.has_role('admin')) then raise exception 'sem_permissao'; end if;
  return query
  with total as (
    select count(*)::numeric n from public.lessons l join public.modules m on m.id = l.module_id
    where m.formation_id = p_formation and l.status = 'publicado'
  ), per_user as (
    select lp.user_id, count(*) filter (where lp.completed_at is not null) done
    from public.lesson_progress lp
    where public.lesson_formation(lp.lesson_id) = p_formation
    group by lp.user_id
  )
  select count(*)::int,
         round(coalesce(avg(done / nullif((select n from total), 0)), 0) * 100, 1),
         coalesce(sum(done), 0)::int
  from per_user;
end $$;

-- =============================================================================
-- Row Level Security
-- Escrita financeira (contratos, parcelas, assinaturas) só pelo servidor
-- (service role) ou pelas funções acima; nenhuma policy de insert/update para alunos.
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.user_roles             enable row level security;
alter table public.billing_customers      enable row level security;
alter table public.formations             enable row level security;
alter table public.formation_instructors  enable row level security;
alter table public.modules                enable row level security;
alter table public.lessons                enable row level security;
alter table public.lesson_media           enable row level security;
alter table public.lesson_materials       enable row level security;
alter table public.plans                  enable row level security;
alter table public.addons                 enable row level security;
alter table public.contracts              enable row level security;
alter table public.contract_formations    enable row level security;
alter table public.installments           enable row level security;
alter table public.upgrades               enable row level security;
alter table public.refund_requests        enable row level security;
alter table public.addon_subscriptions    enable row level security;
alter table public.resumao_sessions       enable row level security;
alter table public.resumao_session_lessons enable row level security;
alter table public.lesson_progress        enable row level security;
alter table public.certificates           enable row level security;
alter table public.career_tracks          enable row level security;
alter table public.career_track_steps     enable row level security;
alter table public.vlog_posts             enable row level security;
alter table public.ebooks                 enable row level security;
alter table public.ebook_downloads        enable row level security;
alter table public.site_pages             enable row level security;
alter table public.site_settings          enable row level security;
alter table public.contact_messages       enable row level security;
alter table public.gateway_events         enable row level security;
alter table public.audit_log              enable row level security;

-- Pessoas ---------------------------------------------------------------------
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all   on public.profiles for all using (public.has_role('admin'));
-- Professores veem nome e e-mail dos alunos das suas formações.
-- (função security definer: a policy não pode depender do RLS de contracts, que o professor não lê)
create or replace function public.is_my_student(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contracts c
    join public.contract_formations cf on cf.contract_id = c.id
    join public.formation_instructors fi on fi.formation_id = cf.formation_id and fi.user_id = auth.uid()
    where c.user_id = p_user and c.status = 'ativo'
  )
$$;
create policy profiles_instructor_read on public.profiles for select using (public.is_my_student(id));

create policy roles_self_read  on public.user_roles for select using (user_id = auth.uid() or public.is_staff());
create policy roles_admin_all  on public.user_roles for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy billing_read on public.billing_customers for select using (user_id = auth.uid() or public.is_staff());

-- Catálogo: ementa pública; edição por professor da formação ou admin -------------
create policy formations_public_read on public.formations for select using (status = 'publicado' or public.has_role('admin') or public.is_instructor_of(id));
create policy formations_admin_all   on public.formations for all using (public.has_role('admin')) with check (public.has_role('admin'));
create policy formations_instr_update on public.formations for update using (public.is_instructor_of(id)) with check (public.is_instructor_of(id));

create policy instructors_read      on public.formation_instructors for select using (true);
create policy instructors_admin_all on public.formation_instructors for all using (public.has_role('admin')) with check (public.has_role('admin'));

create policy modules_read  on public.modules for select using (
  exists (select 1 from public.formations f where f.id = formation_id and (f.status = 'publicado' or public.has_role('admin') or public.is_instructor_of(f.id))));
create policy modules_write on public.modules for all
  using (public.has_role('admin') or public.is_instructor_of(formation_id))
  with check (public.has_role('admin') or public.is_instructor_of(formation_id));

create policy lessons_read on public.lessons for select using (
  status = 'publicado' or public.has_role('admin') or public.is_instructor_of(public.lesson_formation(id)));
create policy lessons_write on public.lessons for all
  using (public.has_role('admin') or exists (select 1 from public.modules m where m.id = module_id and public.is_instructor_of(m.formation_id)))
  with check (public.has_role('admin') or exists (select 1 from public.modules m where m.id = module_id and public.is_instructor_of(m.formation_id)));
