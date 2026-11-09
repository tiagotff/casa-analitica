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
