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
