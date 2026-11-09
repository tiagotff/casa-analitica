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
