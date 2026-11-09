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

-- Catálogo ------------------------------------------------------------------------
do $$
declare
  catalog jsonb := '[
   {"slug": "negocios-analytics", "name": "Negócios & Analytics", "color": "#2563EB", "summary": "Negócio, indicadores, análise e tomada de decisão.", "modules": [["Fundamentos de negócios e análise", ["Modelos de negócio e unit economics", "Perguntas de negócio e hipóteses", "Tipos de dados, granularidade e chaves", "Projeto aplicado: diagnóstico de um negócio"]], ["SQL para análise", ["SELECT, filtros e agregações", "JOINs sem duplicar linhas", "Funções de janela na prática", "Projeto aplicado: base de clientes"]], ["Indicadores e finanças do negócio", ["Como desenhar um KPI", "Árvore de métricas", "DRE, margem e indicadores financeiros", "Projeto aplicado: painel de indicadores"]], ["Visualização e storytelling", ["Escolher o gráfico certo", "Power BI: modelagem e DAX essencial", "Storytelling com dados para executivos", "Projeto aplicado: dashboard executivo"]], ["Decisão orientada por dados", ["Testes A/B para negócio", "Coortes e retenção", "Precificação e elasticidade", "Projeto final: recomendação para a diretoria"]]]},
   {"slug": "engenharia-dados-cloud", "name": "Engenharia de Dados & Cloud", "color": "#00C2A8", "summary": "Pipelines, arquitetura, integração e infraestrutura.", "modules": [["Fundamentos de engenharia", ["Arquitetura de dados moderna", "Python para engenharia", "Git e versionamento", "Projeto aplicado: primeiro pipeline"]], ["Modelagem e armazenamento", ["Modelagem dimensional", "Data lake, warehouse e lakehouse", "Parquet e particionamento", "Projeto aplicado: modelo estrela"]], ["Pipelines e orquestração", ["ETL ou ELT: quando usar cada um", "Airflow: DAGs e agendamento", "dbt: transformação testada", "Projeto aplicado: pipeline orquestrado"]], ["Cloud na prática", ["BigQuery e custo de consulta", "Armazenamento e permissões (IAM)", "Streaming com Pub/Sub", "Projeto aplicado: ingestão em tempo real"]], ["Qualidade e operação", ["Testes e contratos de dados", "Observabilidade de pipelines", "Docker e CI/CD para dados", "Projeto final: plataforma de dados"]]]},
   {"slug": "ciencia-dados-ia", "name": "Ciência de Dados & Inteligência Artificial", "color": "#7C3AED", "summary": "Estatística aplicada, modelos preditivos e deep learning.", "modules": [["Estatística aplicada", ["Distribuições e incerteza", "Inferência e intervalos de confiança", "Testes de hipótese sem armadilhas", "Projeto aplicado: análise exploratória"]], ["Machine learning supervisionado", ["Regressão e regularização", "Classificação e métricas", "Árvores, florestas e boosting", "Projeto aplicado: modelo de churn"]], ["Validação e features", ["Validação cruzada e vazamento de dados", "Engenharia de features", "Séries temporais e previsão de demanda", "Projeto aplicado: previsão de vendas"]], ["Deep learning", ["Redes neurais com PyTorch", "Visão computacional", "Processamento de linguagem e transformers", "Projeto aplicado: classificador de imagens"]], ["Técnicas avançadas", ["Clusterização e segmentação", "Sistemas de recomendação", "Inferência causal", "Projeto final: modelo para decisão de negócio"]]]},
   {"slug": "mlops", "name": "MLOps", "color": "#4F46E5", "summary": "Modelos de machine learning em produção, do treino ao monitoramento.", "modules": [["Fundamentos de MLOps", ["Ciclo de vida de modelos em produção", "Versionamento de código, dados e modelos", "Ambientes reprodutíveis com Docker", "Projeto aplicado: projeto de ML reprodutível"]], ["Experimentos e registro", ["Rastreio de experimentos com MLflow", "Registro e versionamento de modelos", "Feature store na prática", "Projeto aplicado: pipeline de treino rastreado"]], ["Pipelines e automação", ["Pipelines de treino com Airflow", "CI/CD para modelos com GitHub Actions", "Testes de dados e de modelos", "Projeto aplicado: treino automatizado"]], ["Deploy e serving", ["APIs de modelo com FastAPI", "Inferência em lote e em tempo real", "Otimização com ONNX", "Projeto aplicado: modelo servido em produção"]], ["Monitoramento e operação", ["Métricas com Prometheus e Grafana", "Drift de dados e de conceito", "Retreino e governança de modelos", "Projeto final: plataforma de MLOps de ponta a ponta"]]]},
   {"slug": "engenharia-ia", "name": "Engenharia de IA", "color": "#06B6D4", "summary": "Aplicações com LLMs: RAG, agentes, avaliação e produção.", "modules": [["Fundamentos de LLMs", ["Como funcionam os grandes modelos de linguagem", "Engenharia de prompts para aplicações", "APIs de modelos e custo de uso", "Projeto aplicado: assistente com prompts estruturados"]], ["RAG e busca semântica", ["Embeddings e bancos vetoriais", "Chunking, indexação e recuperação", "Avaliação da qualidade do RAG", "Projeto aplicado: assistente sobre documentos"]], ["Agentes e ferramentas", ["Chamada de funções e uso de ferramentas", "Agentes e fluxos multiagente", "Memória e orquestração", "Projeto aplicado: agente que executa tarefas"]], ["Avaliação e segurança", ["Avaliações automatizadas (evals)", "Guardrails, privacidade e LGPD", "Prompt injection e segurança de aplicações", "Projeto aplicado: suíte de avaliação"]], ["IA em produção", ["Latência, cache e custo", "Observabilidade de aplicações de IA", "Fine-tuning: quando vale a pena", "Projeto final: produto de IA em produção"]]]},
   {"slug": "gestao-estrategica-dados-ia", "name": "Gestão Estratégica de Dados & IA", "color": "#0B1F3B", "summary": "Governança, liderança, estratégia e geração de valor.", "modules": [["Estratégia de dados", ["Dados como ativo de negócio", "Maturidade analítica", "Casos de uso e priorização", "Projeto aplicado: mapa de oportunidades"]], ["Governança", ["Papéis, donos e catálogo", "Qualidade de dados como processo", "LGPD na prática", "Projeto aplicado: política de governança"]], ["Liderança de times de dados", ["Estrutura de times", "Contratar e desenvolver talentos", "Gestão de projetos analíticos", "Projeto aplicado: plano de time"]], ["IA nos negócios", ["O que a IA resolve e o que não resolve", "ROI de projetos de IA", "Riscos, ética e regulação", "Projeto aplicado: business case de IA"]], ["Geração de valor", ["Métricas de valor de dados", "Comunicação com executivos", "Cultura orientada a dados", "Projeto final: roadmap de dados e IA"]]]}
  ]';
  f jsonb; m jsonb; t text;
  v_formation uuid; v_module uuid; mi int; li int; k int; fi int := 0;
  first_release timestamptz := '2027-02-01 08:00-03';  -- 1ª segunda-feira de aulas
  preview_release timestamptz := '2027-01-01 00:00-03'; -- módulo de avaliação abre com as vendas
begin
  for f in select * from jsonb_array_elements(catalog) loop
    insert into public.formations (slug, name, summary, description, accent_color, status, position, launched_at)
    values (f->>'slug', f->>'name', f->>'summary', f->>'summary', f->>'color', 'publicado', fi, '2027-01-01 00:00-03')
    returning id into v_formation;
    fi := fi + 1; mi := 0; k := 0;
    for m in select * from jsonb_array_elements(f->'modules') loop
      mi := mi + 1;
      insert into public.modules (formation_id, position, title, is_preview) values (v_formation, mi, m->>0, mi = 1) returning id into v_module;
      li := 0;
      for t in select * from jsonb_array_elements_text(m->1) loop
        li := li + 1;
        insert into public.lessons (module_id, position, title, kind, duration_min, release_at, status)
        values (v_module, li, t,
                case when t like 'Projeto%' then 'projeto'::public.lesson_kind else 'aula'::public.lesson_kind end,
                -- 40 h por formação: 15 aulas de 1h40 + 5 projetos aplicados de 3h = 2.400 min
                case when t like 'Projeto%' then 180 else 100 end,
                -- Módulo 1 (avaliação) disponível desde a abertura das vendas; depois, uma aula nova por semana.
                case when mi = 1 then preview_release else first_release + make_interval(days => 7 * k) end, 'publicado');
        if mi > 1 then k := k + 1; end if;
      end loop;
    end loop;
  end loop;
end $$;
