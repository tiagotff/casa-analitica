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
