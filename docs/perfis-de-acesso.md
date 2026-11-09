# Perfis de acesso

Todo cadastro novo recebe o perfil **Aluno**. Os demais são concedidos pelo administrador em **Admin > Usuários e perfis**. Uma pessoa pode ter mais de um perfil; nesse caso, o menu lateral mostra atalhos para as outras áreas.

A permissão é verificada em três camadas:

1. **Proxy** (`proxy.ts`): exige login para `/aluno`, `/professor`, `/suporte`, `/admin` e `/checkout`.
2. **Layout de cada área** (`requireRole`): não renderiza a tela para quem não tem o perfil.
3. **Banco (RLS)**: a barreira final. Mesmo com a chave pública e uma chamada direta à API, o usuário só lê e grava o que as policies permitem.

## Matriz

| Recurso | Visitante | Aluno | Professor | Suporte e financeiro | Administrador |
|---|---|---|---|---|---|
| Site público, catálogo, ementa, planos | Lê | Lê | Lê | Lê | Lê e edita |
| Trilhas, vlog, e-books (download com login) | Lê | Lê e baixa | Lê e publica vlog próprio | Lê | Gerencia |
| Páginas institucionais e link do WhatsApp | Lê | Lê | Lê | Lê | Edita |
| Fale Conosco | Envia | Envia | Envia | Atende | Atende |
| Assistir ao vídeo da aula | — | Formações do contrato e aula liberada; módulo 1 de qualquer formação | Formações que leciona | — | Tudo |
| Baixar, enviar, substituir ou remover vídeo | — | **Nunca** | Formações que leciona | — | Tudo |
| Materiais em PDF | — | Baixa com marca d'água (nome + CPF), download registrado | Envia e remove nas formações que leciona | Consulta downloads | Tudo |
| Comentários na aula | — | Comenta e responde nas aulas a que tem acesso; exclui os próprios | Comenta e modera (oculta) nas suas formações | Modera | Modera e exclui |
| Fórum | — | Espaço Geral + formações que tem; cria tópico, responde, marca a melhor resposta no próprio tópico | Modera os espaços das suas formações e o Geral | Modera todos | Modera todos |
| CPF | — | Informa uma vez em Meus dados; não altera sozinho | Não vê | Vê | Vê |
| Progresso nas aulas | — | O próprio | Dos alunos das suas formações | Consulta | Consulta |
| Resumão Guiado | — | Com complemento ativo | Publica nas suas formações | — | Tudo |
| Contratos, parcelas, assinaturas | — | Os próprios | — | Consulta todos | Consulta todos |
| CPF de cobrança | — | O próprio | — | Consulta (exibido mascarado) | Consulta |
| Iniciar matrícula, upgrade, complemento | — | Sim (funções do banco) | — | Cancela complemento | Cancela complemento |
| Ativar contrato, marcar parcela paga | — | Nunca | Nunca | Nunca | Nunca (só o webhook do gateway) |
| Editar aulas, datas de liberação, materiais | — | — | Só nas formações atribuídas | — | Todas |
| Preços, lotes, vagas e janelas de venda | — | — | — | — | Edita |
| Conceder e remover perfis | — | — | — | — | Sim (não remove o próprio admin) |
| Auditoria | — | — | — | — | Lê |

## Regras que o banco garante

- **Dinheiro não é escrito pelo usuário.** Contratos, parcelas e assinaturas não têm policy de insert ou update. Matrícula e upgrade passam por `start_checkout` e `start_upgrade`, e a ativação (`activate_contract`) só pode ser executada pelo servidor com a service role, a partir do webhook.
- **Aluno nunca baixa vídeo.** O id do vídeo (`lesson_media.video_ref` e `resumao_sessions.video_ref`) não é legível pelo aluno nem pela API. O servidor confere o acesso e entrega só a URL do player, assinada e com validade de 2 horas. No Bunny: token no embed ligado, MP4 fallback desligado, token na CDN ligado, referrers restritos. Download do original só por professor/admin, com URL assinada de 10 minutos.
- **Materiais rastreáveis.** Só PDF. O arquivo limpo fica no bucket privado; cada download gera uma cópia carimbada com nome, CPF, e-mail e data, registrada em `material_downloads`.
- **Moderação pelo banco.** Triggers impedem que alunos ocultem, fixem ou alterem campos de outros; respostas de comentário ficam em um nível.
- **Arquivos em bucket privado.** Materiais e e-books são entregues por URL assinada de poucos minutos, gerada depois da checagem de acesso.
- **Professor enxerga o próprio escopo.** Edita só as formações em `formation_instructors` e vê apenas os alunos delas.
- **Suporte consulta, mas não altera preço nem perfis.** As tentativas retornam zero linhas ou erro de permissão (coberto em `supabase/tests/regras_de_negocio.sql`).
