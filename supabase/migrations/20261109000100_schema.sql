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
