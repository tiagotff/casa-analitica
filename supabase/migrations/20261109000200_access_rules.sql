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
