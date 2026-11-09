-- =============================================================================
-- Casa Analítica · esquema principal
-- Valores monetários sempre em centavos (integer). Datas com fuso (timestamptz).
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.app_role           as enum ('aluno', 'professor', 'suporte', 'admin');
create type public.content_status     as enum ('rascunho', 'publicado', 'arquivado');
create type public.offer_kind         as enum ('lote', 'plano');
create type public.contract_status    as enum ('pendente', 'ativo', 'substituido', 'cancelado', 'expirado', 'reembolsado');
create type public.refund_status      as enum ('solicitado', 'recusado', 'concluido');
create type public.installment_status as enum ('pendente', 'paga', 'vencida', 'cancelada', 'estornada');
create type public.payment_method     as enum ('pix', 'boleto', 'cartao');
create type public.addon_status       as enum ('pendente', 'ativa', 'inadimplente', 'cancelada');
create type public.lesson_kind        as enum ('aula', 'projeto');
create type public.message_status     as enum ('nova', 'em_atendimento', 'resolvida');

-- -----------------------------------------------------------------------------
-- Pessoas e perfis de acesso
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       citext not null unique,
  phone       text,
  avatar_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Um usuário pode acumular perfis (ex.: professor que também é aluno).
create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.app_role not null,
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Dados de cobrança ficam separados do perfil: acesso restrito ao dono e à equipe.
create table public.billing_customers (
  user_id             uuid primary key references public.profiles (id) on delete cascade,
  gateway             text not null default 'asaas',
  gateway_customer_id text not null,
  cpf_cnpj            text not null,
  created_at          timestamptz not null default now(),
  unique (gateway, gateway_customer_id)
);

-- -----------------------------------------------------------------------------
-- Catálogo: formações, módulos, aulas
-- -----------------------------------------------------------------------------
create table public.formations (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  summary       text not null,
  description   text not null default '',
  accent_color  text not null default '#2563EB',
  hours_planned integer not null default 40 check (hours_planned > 0),
  status        public.content_status not null default 'rascunho',
  position      integer not null default 0,
  launched_at   timestamptz,           -- usado pela regra "novas formações" do Legado
  created_at    timestamptz not null default now()
);

create table public.formation_instructors (
  formation_id uuid not null references public.formations (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (formation_id, user_id)
);

create table public.modules (
  id           uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations (id) on delete cascade,
  position     integer not null,
  title        text not null,
  description  text not null default '',
  is_preview   boolean not null default false, -- módulo aberto para avaliação (qualquer aluno logado)
  unique (formation_id, position)
);

-- Metadados públicos da aula (ementa). O vídeo fica em lesson_media, protegido.
create table public.lessons (
  id           uuid primary key default gen_random_uuid(),
  module_id    uuid not null references public.modules (id) on delete cascade,
  position     integer not null,
  title        text not null,
  summary      text not null default '',
  kind         public.lesson_kind not null default 'aula',
  duration_min integer not null default 60 check (duration_min > 0),
  release_at   timestamptz not null,   -- liberação semanal
  status       public.content_status not null default 'rascunho',
  created_at   timestamptz not null default now(),
  unique (module_id, position)
);
create index lessons_release_idx on public.lessons (release_at);

create table public.lesson_media (
  lesson_id   uuid primary key references public.lessons (id) on delete cascade,
  provider    text not null default 'bunny',  -- bunny | panda | vimeo
  video_ref   text not null,                  -- id do vídeo no provedor
  updated_at  timestamptz not null default now()
);

create table public.lesson_materials (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  title        text not null,
  kind         text not null default 'arquivo', -- notebook | slides | dataset | enunciado
  storage_path text not null,                   -- bucket privado "materiais"
  created_at   timestamptz not null default now()
);
