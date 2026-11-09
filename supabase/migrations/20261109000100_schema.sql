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
