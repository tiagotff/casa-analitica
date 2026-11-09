-- =============================================================================
-- Casa Analítica · materiais em PDF com marca d'água, vídeo protegido,
-- comentários nas aulas e fórum de dúvidas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CPF do usuário (usado na marca d'água dos materiais e na cobrança)
-- Fica fora de profiles para que professores, que leem perfis dos alunos, não vejam o CPF.
-- -----------------------------------------------------------------------------
create table public.profile_documents (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  cpf        text not null check (cpf ~ '^\d{11}$'),
  updated_at timestamptz not null default now()
);
alter table public.profile_documents enable row level security;
create policy docs_owner_read   on public.profile_documents for select using (user_id = auth.uid() or public.is_staff());
create policy docs_owner_insert on public.profile_documents for insert with check (user_id = auth.uid());
create policy docs_owner_update on public.profile_documents for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Vídeo: o aluno nunca lê o id do vídeo. O servidor confere can_view_lesson e
-- devolve apenas uma URL de player assinada e temporária.
-- Edição, upload e download do vídeo: só professor da formação e admin.
-- -----------------------------------------------------------------------------
drop policy media_read on public.lesson_media;
create policy media_read on public.lesson_media for select
  using (public.has_role('admin') or public.is_instructor_of(public.lesson_formation(lesson_id)));

-- -----------------------------------------------------------------------------
-- Materiais: somente PDF. Download sempre com marca d'água (nome + CPF) e registrado.
-- -----------------------------------------------------------------------------
alter table public.lesson_materials
  add column content_type text not null default 'application/pdf' check (content_type = 'application/pdf'),
  add column size_bytes   integer check (size_bytes > 0),
  add constraint materials_pdf_path check (lower(storage_path) like '%.pdf');

create table public.material_downloads (
  id          bigint generated always as identity primary key,
  material_id uuid not null references public.lesson_materials (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  watermark   text not null,           -- texto carimbado no arquivo, para rastrear vazamentos
  created_at  timestamptz not null default now()
);
create index material_downloads_user_idx on public.material_downloads (user_id, created_at desc);
alter table public.material_downloads enable row level security;
create policy downloads_read on public.material_downloads for select using (user_id = auth.uid() or public.is_staff());
-- insert só pelo servidor (service role), depois de gerar o arquivo com marca d'água

-- -----------------------------------------------------------------------------
-- Moderação: admin, suporte, e professor da formação (ou qualquer professor no fórum Geral)
-- -----------------------------------------------------------------------------
create or replace function public.is_moderator(p_formation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin') or public.has_role('suporte')
      or (p_formation is not null and public.is_instructor_of(p_formation))
      or (p_formation is null and public.has_role('professor'))
$$;

-- -----------------------------------------------------------------------------
-- Comentários nas aulas, com respostas (um nível: respostas sempre apontam ao comentário raiz)
-- -----------------------------------------------------------------------------
create table public.lesson_comments (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.lesson_comments (id) on delete cascade,
  body       text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  hidden_at  timestamptz,
  hidden_by  uuid references public.profiles (id)
);
create index lesson_comments_lesson_idx on public.lesson_comments (lesson_id, created_at);

create or replace function public.comments_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_root uuid;
begin
  if tg_op = 'INSERT' then
    if new.parent_id is not null then
      select coalesce(parent_id, id) into v_root from public.lesson_comments where id = new.parent_id and lesson_id = new.lesson_id;
      if v_root is null then raise exception 'comentario_pai_invalido'; end if;
      new.parent_id := v_root;   -- resposta a uma resposta vira resposta ao comentário raiz
    end if;
    new.hidden_at := null; new.hidden_by := null; new.edited_at := null;
  else
    if new.lesson_id <> old.lesson_id or new.user_id <> old.user_id or new.parent_id is distinct from old.parent_id then
      raise exception 'campo_imutavel';
    end if;
    if (new.hidden_at is distinct from old.hidden_at) and not public.is_moderator(public.lesson_formation(old.lesson_id)) then
      raise exception 'sem_permissao_moderacao';
    end if;
    if new.body <> old.body then
      if old.user_id <> auth.uid() then raise exception 'so_o_autor_edita'; end if;
      new.edited_at := now();
    end if;
    if new.hidden_at is not null and old.hidden_at is null then new.hidden_by := auth.uid(); end if;
  end if;
  return new;
end $$;
create trigger lesson_comments_guard before insert or update on public.lesson_comments
  for each row execute function public.comments_guard();

alter table public.lesson_comments enable row level security;
create policy comments_read on public.lesson_comments for select using (
  public.can_view_lesson(lesson_id)
  and (hidden_at is null or user_id = auth.uid() or public.is_moderator(public.lesson_formation(lesson_id))));
create policy comments_insert on public.lesson_comments for insert
  with check (user_id = auth.uid() and public.can_view_lesson(lesson_id));
create policy comments_update on public.lesson_comments for update
  using (user_id = auth.uid() or public.is_moderator(public.lesson_formation(lesson_id)));
create policy comments_delete on public.lesson_comments for delete
  using (user_id = auth.uid() or public.has_role('admin'));
