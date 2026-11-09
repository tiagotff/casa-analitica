# Casa Analítica · plataforma

Site público, área do aluno, painel do professor, suporte/financeiro e administração da Casa Analítica.

- **App:** Next.js 16 (App Router, Server Actions) em TypeScript
- **Banco, login e arquivos:** Supabase (Postgres com RLS, Auth, Storage)
- **Pagamentos:** Asaas (Pix, boleto e cartão em até 12x; assinaturas mensais dos complementos)
- **Vídeo:** Bunny Stream: player com token, upload retomável (TUS) pelo professor, sem download para aluno (`lib/video.ts`)
- **Materiais:** PDFs com marca d'água de nome e CPF gerada no download (`lib/watermark.ts`)

Documentação complementar:

- [Perfis de acesso](docs/perfis-de-acesso.md): o que cada perfil vê e faz, e como isso é garantido
- [Modelo de dados](docs/banco-de-dados.md): diagrama, ciclo do contrato e regras de negócio no banco

## Rodando localmente

Pré-requisitos: Node 20+, Docker Desktop (para o Supabase local) e Git Bash no Windows.

```bash
npm install
npx supabase init            # cria supabase/config.toml; mantém as migrations existentes
npx supabase start           # sobe Postgres, Auth e Storage locais e mostra as chaves
npx supabase db reset        # aplica migrations + seed
cp .env.example .env.local   # cole a anon key e a service role key exibidas no start
npm run dev                  # http://localhost:3000
```

Os e-mails de confirmação do ambiente local aparecem no Inbucket (`http://127.0.0.1:54324`).

### Primeiro administrador

Crie a conta pelo site e depois, no SQL Editor do Supabase (Studio local em `http://127.0.0.1:54323`):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where email = 'seu@email.com';
```

A partir daí os demais perfis são concedidos em **Admin > Usuários e perfis**.

### Testes

```bash
npm test                                   # dinheiro (parcelas, upgrade), CPF e marca d'água em PDF
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/regras_de_negocio.sql
```

`DB_URL` do ambiente local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Rode o arquivo de testes num banco recém-resetado: ele cria usuários e contratos de teste. Também há `supabase/tests/run.sh`, que aplica tudo e roda os testes num banco vazio. Os testes cobrem lotes em sequência, vagas, acesso por formação e por data, upgrade simples e em cadeia, Resumão, vídeo inacessível ao aluno, CPF fora do alcance do professor, comentários, fórum e moderação, e o isolamento entre aluno, professor, suporte e visitante.

## Vídeos (Bunny Stream)

Na biblioteca do Bunny, configure antes de publicar aulas:

1. **Security > Embed view token authentication:** ligado. Copie a chave para `BUNNY_EMBED_TOKEN_KEY`.
2. **Encoding > MP4 fallback:** desligado. Assim não existe arquivo de vídeo para baixar.
3. **Encoding > Keep original files:** ligado. Professor e admin baixam o original.
4. **Pull zone > Security > Token authentication:** ligado. A chave vai em `BUNNY_CDN_TOKEN_KEY` e o host em `BUNNY_CDN_HOST`.
5. **Allowed referrers:** só o domínio da escola.
6. Opcional: **MediaCage DRM**, que também dificulta extensões de captura.

Nenhuma configuração impede alguém de filmar a tela. A marca d'água nos PDFs e o rastreio de downloads servem para identificar vazamentos de material.

## Pagamentos (Asaas)

1. Crie uma conta no **sandbox** do Asaas e gere a chave de API em Integrações. Coloque em `ASAAS_API_KEY`.
2. Em Integrações > Webhooks, cadastre `https://SEU-DOMINIO/api/webhooks/asaas` com um token longo e aleatório; use o mesmo valor em `ASAAS_WEBHOOK_TOKEN`. Para testar localmente, exponha a porta 3000 com um túnel (ngrok, Cloudflare Tunnel).
3. Ative os eventos de cobrança (criação, confirmação, recebimento, vencimento, exclusão e estorno).

Fluxo:

1. O aluno escolhe a oferta em `/planos`. O banco cria o contrato pendente e reserva a vaga (`start_checkout`).
2. O servidor cria o cliente e a cobrança parcelada no Asaas, grava as parcelas e redireciona para a fatura. Os dados de cartão são digitados na página do Asaas e nunca passam pelo app.
3. O webhook confirma o pagamento, marca a parcela como paga e ativa o contrato (`activate_contract`). Cada evento é processado uma única vez (`gateway_events`).
4. No upgrade, o banco calcula o crédito (`upgrade_quote`). Na confirmação, o contrato anterior vira "substituído", as parcelas pendentes são canceladas no banco e no Asaas, e o acesso recomeça a contar. Se o cancelamento no Asaas falhar, o caso fica na auditoria para o suporte resolver.

Antes de produção, valide no sandbox:

- **Upgrade de quem pagou no cartão parcelado.** Neste caso, as parcelas futuras estão na fatura do cartão do aluno. Confirme com o Asaas se a exclusão das cobranças futuras gera o estorno correto ou se é preciso usar estorno parcial (`/payments/{id}/refund`).
- **URL da API e nome dos headers.** O código usa `https://api-sandbox.asaas.com/v3`, o header `access_token` e o header `asaas-access-token` no webhook. Confira na documentação vigente.

## Decisões em aberto

Estes pontos estão parametrizados e podem ser ajustados sem mudar código:

| Ponto | Como está | Onde mudar |
|---|---|---|
| Quantas formações cada plano libera | 1 formação por contrato | `plans.formations_quota` (`null` = todas) |
| Upgrade de um lote para o Essencial (ambos com 12 meses) | Permitido, porque o `rank` do Essencial é maior | `plans.rank` |
| Prazo de reserva da vaga no Pix/boleto | 3 dias | `start_checkout` |
| Acesso de quem atrasa parcelas | Continua ativo; o suporte vê a lista em Cobranças | regra a definir |
| Textos de Privacidade e Termos | Modelos marcados para revisão jurídica | Admin > Conteúdo do site |

## Estrutura

```
app/
  (site)/        site público: home, cursos, trilhas, vlog, e-books, planos, checkout,
                 institucionais, Fale Conosco, login e cadastro
  aluno/         área do aluno: formações, player, Resumão, plano e upgrade, dados
  professor/     aulas, datas de liberação, vídeos, materiais e Resumão das formações atribuídas
  suporte/       alunos, cobranças vencidas, mensagens do Fale Conosco
  admin/         visão geral, perfis, planos e lotes, conteúdo do site, auditoria
  api/           webhook do Asaas, download de e-books e materiais (URL assinada)
lib/
  auth/          sessão, perfis e ações de login
  billing/       interface do gateway, implementação Asaas, serviço de cobrança, utilitários de dinheiro
  supabase/      clientes do Supabase (sessão do usuário e service role)
supabase/
  migrations/    esquema, funções de regra de negócio e RLS
  seed.sql       planos, lotes, complementos, 6 formações (120 aulas, 40 h cada), trilhas e páginas
  tests/         testes de regras e perfis em SQL
```

## Deploy

Vercel (ou qualquer host Node) + projeto Supabase em nuvem:

```bash
npx supabase link --project-ref SEU_PROJETO
npx supabase db push            # aplica as migrations
psql "$DB_URL_DA_NUVEM" -f supabase/seed.sql   # só na primeira vez
```

Configure as variáveis de `.env.example` no host, troque `ASAAS_API_URL` para a URL de produção e cadastre o webhook de produção. Em Supabase > Authentication > URL Configuration, informe a URL do site e `https://SEU-DOMINIO/auth/callback` como redirect.
