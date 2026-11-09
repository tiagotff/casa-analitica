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

-- -----------------------------------------------------------------------------
-- Ofertas: lotes de lançamento e planos regulares
-- -----------------------------------------------------------------------------
create table public.plans (
  id                         uuid primary key default gen_random_uuid(),
  code                       text not null unique,          -- lote1, essencial, legado...
  name                       text not null,
  kind                       public.offer_kind not null,
  price_cents                integer not null check (price_cents > 0),
  max_installments           integer not null default 12 check (max_installments between 1 and 12),
  access_months              integer check (access_months > 0), -- null = vitalício condicionado
  -- O preço é POR FORMAÇÃO. Acesso a todas as formações = preço × multiplicador (1,95 no lançamento).
  all_access_multiplier      numeric(4,2) not null default 1.95 check (all_access_multiplier >= 1),
  all_formations_price_cents integer generated always as (round(price_cents * all_access_multiplier)::int) stored,
  includes_future_formations boolean not null default false,
  rank                       integer not null,              -- ordem para upgrade (maior = superior)
  seats                      integer check (seats > 0),     -- só lotes
  sale_starts_at             timestamptz,
  sale_ends_at               timestamptz,
  active                     boolean not null default true,
  created_at                 timestamptz not null default now(),
  check (kind = 'plano' or seats is not null)
);

create table public.addons (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,     -- resumao | ingles | combo
  name                text not null,
  description         text not null,
  monthly_price_cents integer not null check (monthly_price_cents > 0),
  grants              text[] not null,          -- quais benefícios libera: {resumao}, {ingles}, {resumao,ingles}
  available_from      date,                     -- Inglês e combo entram no 2º ano
  active              boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Contratos (matrículas), parcelas e upgrade
-- -----------------------------------------------------------------------------
create table public.contracts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete restrict,
  plan_id              uuid not null references public.plans (id),
  status               public.contract_status not null default 'pendente',
  all_formations       boolean not null default false, -- false = só a formação contratada
  list_price_cents     integer not null,       -- preço vigente na contratação (por formação ou pacote)
  upgrade_credit_cents integer not null default 0 check (upgrade_credit_cents >= 0),
  amount_due_cents     integer not null check (amount_due_cents >= 0), -- list_price - crédito
  installments_count   integer not null check (installments_count between 1 and 12),
  payment_method       public.payment_method not null,
  previous_contract_id uuid references public.contracts (id),
  hold_until           timestamptz,            -- reserva de vaga de lote enquanto aguarda pagamento
  access_starts_at     timestamptz,
  access_ends_at       timestamptz,            -- null com status ativo = vitalício condicionado
  gateway              text not null default 'asaas',
  gateway_ref          text,                   -- id do parcelamento no gateway
  created_at           timestamptz not null default now(),
  activated_at         timestamptz,
  closed_at            timestamptz,
  check (amount_due_cents = list_price_cents - upgrade_credit_cents)
);
create index contracts_user_idx on public.contracts (user_id, status);
create index contracts_plan_idx on public.contracts (plan_id, status);
-- Um aluno tem no máximo um contrato ativo e um pendente por vez.
create unique index contracts_one_active_per_user on public.contracts (user_id) where status = 'ativo';
create unique index contracts_one_pending_per_user on public.contracts (user_id) where status = 'pendente';

create table public.contract_formations (
  contract_id  uuid not null references public.contracts (id) on delete cascade,
  formation_id uuid not null references public.formations (id),
  primary key (contract_id, formation_id)
);

create table public.installments (
  id                 uuid primary key default gen_random_uuid(),
  contract_id        uuid not null references public.contracts (id) on delete cascade,
  number             integer not null check (number between 1 and 12),
  amount_cents       integer not null check (amount_cents > 0),
  due_date           date not null,
  status             public.installment_status not null default 'pendente',
  gateway_payment_id text unique,
  invoice_url        text,
  paid_at            timestamptz,
  updated_at         timestamptz not null default now(),
  unique (contract_id, number)
);
create index installments_status_idx on public.installments (status, due_date);

-- Registro auditável de cada upgrade (crédito, saldo e parcelas canceladas).
create table public.upgrades (
  id                       uuid primary key default gen_random_uuid(),
  from_contract_id         uuid not null references public.contracts (id),
  to_contract_id           uuid not null unique references public.contracts (id),
  credit_cents             integer not null,
  canceled_pending_cents   integer not null,
  amount_due_cents         integer not null,
  created_at               timestamptz not null default now()
);

create table public.addon_subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references public.profiles (id) on delete restrict,
  addon_id                uuid not null references public.addons (id),
  status                  public.addon_status not null default 'pendente',
  monthly_price_cents     integer not null,
  gateway_subscription_id text unique,
  started_at              timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz not null default now()
);
create unique index addon_one_live_per_user on public.addon_subscriptions (user_id, addon_id)
  where status in ('pendente', 'ativa', 'inadimplente');

-- Garantia de 7 dias: pedido de reembolso a partir da liberação do acesso.
create table public.refund_requests (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid not null unique references public.contracts (id),
  user_id        uuid not null references public.profiles (id),
  reason         text not null default '',
  status         public.refund_status not null default 'solicitado',
  refunded_cents integer,
  staff_note     text,
  requested_at   timestamptz not null default now(),
  handled_by     uuid references public.profiles (id),
  handled_at     timestamptz
);

-- -----------------------------------------------------------------------------
-- Resumão Guiado (gravações semanais)
-- -----------------------------------------------------------------------------
create table public.resumao_sessions (
  id           uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations (id) on delete cascade,
  week_number  integer not null,
  title        text not null,
  duration_min integer not null default 90,
  provider     text not null default 'bunny',
  video_ref    text,
  release_at   timestamptz not null,
  status       public.content_status not null default 'rascunho',
  unique (formation_id, week_number)
);

create table public.resumao_session_lessons (
  session_id uuid not null references public.resumao_sessions (id) on delete cascade,
  lesson_id  uuid not null references public.lessons (id) on delete cascade,
  primary key (session_id, lesson_id)
);

-- -----------------------------------------------------------------------------
-- Aprendizagem
-- -----------------------------------------------------------------------------
create table public.lesson_progress (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  lesson_id         uuid not null references public.lessons (id) on delete cascade,
  last_position_sec integer not null default 0,
  completed_at      timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.certificates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  formation_id uuid not null references public.formations (id),
  code         text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 10)),
  issued_at    timestamptz not null default now(),
  unique (user_id, formation_id)
);

-- -----------------------------------------------------------------------------
-- Conteúdo do site (rodapé: Trilhas de Carreira, Vlog, E-books, institucionais)
-- -----------------------------------------------------------------------------
create table public.career_tracks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  summary     text not null,
  target_role text not null,            -- cargo de destino: Analista de Dados, Engenheiro de Dados...
  level       text not null default 'iniciante',
  position    integer not null default 0,
  status      public.content_status not null default 'rascunho'
);

create table public.career_track_steps (
  id           uuid primary key default gen_random_uuid(),
  track_id     uuid not null references public.career_tracks (id) on delete cascade,
  position     integer not null,
  title        text not null,
  description  text not null default '',
  formation_id uuid references public.formations (id),
  module_id    uuid references public.modules (id),
  unique (track_id, position)
);

create table public.vlog_posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  excerpt      text not null,
  body_md      text not null default '',
  video_url    text,                     -- vídeo público (YouTube etc.)
  cover_path   text,
  author_id    uuid references public.profiles (id),
  status       public.content_status not null default 'rascunho',
  published_at timestamptz
);

create table public.ebooks (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  summary      text not null,
  cover_path   text,
  file_path    text not null,            -- bucket privado "ebooks"
  requires_login boolean not null default true, -- captação de lead
  status       public.content_status not null default 'rascunho',
  published_at timestamptz
);

create table public.ebook_downloads (
  id         uuid primary key default gen_random_uuid(),
  ebook_id   uuid not null references public.ebooks (id) on delete cascade,
  user_id    uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Páginas institucionais editáveis: quem-somos, por-onde-comecar, privacidade, termos...
create table public.site_pages (
  slug       text primary key,
  title      text not null,
  body_md    text not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- Configurações públicas: link da comunidade no WhatsApp, e-mail de contato etc.
create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 2 and 120),
  email      citext not null,
  subject    text not null check (length(subject) between 2 and 160),
  message    text not null check (length(message) between 5 and 4000),
  user_id    uuid references public.profiles (id) on delete set null,
  status     public.message_status not null default 'nova',
  handled_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Operação: eventos do gateway (idempotência) e trilha de auditoria
-- -----------------------------------------------------------------------------
create table public.gateway_events (
  id           uuid primary key default gen_random_uuid(),
  gateway      text not null,
  event_id     text not null,
  event_type   text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  error        text,
  unique (gateway, event_id)
);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id),
  action     text not null,
  entity     text not null,
  entity_id  text,
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_log (entity, entity_id);
