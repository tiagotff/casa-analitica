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
