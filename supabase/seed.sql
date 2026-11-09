-- =============================================================================
-- Casa Analítica · dados iniciais (ofertas do PDF + catálogo + páginas do site)
-- Executado por `supabase db reset`.
-- =============================================================================

-- Ofertas -----------------------------------------------------------------------
-- Preço POR FORMAÇÃO. O pacote com todas as formações custa preço × 1,95 (coluna gerada).
insert into public.plans (code, name, kind, price_cents, max_installments, access_months, includes_future_formations, rank, seats, sale_starts_at, sale_ends_at) values
  ('lote1',        '1º lote',      'lote',  99900, 12, 12, false, 10, 200, '2027-01-01 00:00-03', '2027-02-01 00:00-03'),
  ('lote2',        '2º lote',      'lote', 229900, 12, 12, false, 20, 100, '2027-01-01 00:00-03', '2027-02-01 00:00-03'),
  ('lote3',        '3º lote',      'lote', 399900, 12, 12, false, 30,  50, '2027-01-01 00:00-03', '2027-02-01 00:00-03'),
  ('essencial',    'Essencial',    'plano', 478800, 12, 12, false, 40, null, '2027-02-01 00:00-03', null),
  ('continuidade', 'Continuidade', 'plano', 562800, 12, 24, false, 50, null, '2027-02-01 00:00-03', null),
  ('evolucao',     'Evolução',     'plano', 658800, 12, 36, false, 60, null, '2027-02-01 00:00-03', null),
  ('legado',       'Legado',       'plano', 838800, 12, null, true, 70, null, '2027-02-01 00:00-03', null);

insert into public.addons (code, name, description, monthly_price_cents, grants, available_from) values
  ('resumao', 'Resumão Guiado', 'Gravação semanal de 1h30 com resolução passo a passo dos exercícios.', 14900, '{resumao}', null),
  ('ingles',  'Inglês para Negócios e Dados', '3h de aulas e 1h30 de plantão por semana.', 14900, '{ingles}', '2028-01-01'),
  ('combo',   'Combo Resumão + Inglês', 'Resumão Guiado e Inglês para Negócios e Dados.', 24900, '{resumao,ingles}', '2028-01-01');
