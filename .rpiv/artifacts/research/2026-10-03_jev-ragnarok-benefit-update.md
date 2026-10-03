---
date: 2026-10-03
author: OpenCode
commit: 8f58420
branch: main
repository: slopstop
status: in-progress
---

# Jev no Ragnarok — atualização de benefícios possíveis

## Conclusão

**Há benefício potencial como classificador semântico auxiliar, não como substituto do modelo principal nem das verificações do produto.** O melhor primeiro ensaio continua a ser reconhecer correções expressas pelo utilizador na Conversation. Reordenação de contexto e sugestões de skills são candidatos seguintes. Composição de Workers e avaliação de episódios permanecem hipóteses, não funcionalidades aprovadas.

Esta pesquisa atualiza a [investigação de19/09](2026-09-19_jev-typesafe-primary-sources.md), preservando as ideias JEV-F01 e JEV-F02. Não houve chamadas de inferência, envio de conversas/código/dados privados, criação de chaves, instalação de Jev nem alteração do produto. A migração Effect em curso não passou a depender desta investigação.

## O Que Jev Faz

A API recebe texto/JSON e perguntas com respostas delimitadas. O modelo atual listado é `jev-1.13.0`; `jev-latest` e `jev-preview` são aliases que podem mudar. [1,2]

- Noul: probabilidade atribuída a uma resposta afirmativa.
- Choice: escolha entre opções predefinidas, com distribuição e confiança.
- Score: avaliação numa escala ordenada, com distribuição.

Não escreve código, explicações ou planos arbitrários. Formato de saída válido não significa classificação verdadeira. A confiança resume a distribuição de respostas; não constitui uma segunda prova de correção. [2,3]

## O Que Mudou Desde A Pesquisa Anterior

- A página inicial já mostra “NO MORE WAITLIST”; isso não é prova de SLA ou maturidade prolongada. [4]
- Os limites atuais publicados são100K tokens/s e80 pedidos/s, diferentes dos valores observados em19/09. Continuam dinâmicos. [1]
- A documentação passou a explicitar fórmulas de confiança. [3]
- A página de limitações foi revista em2026-10-02 e inclui viés para a primeira opção em Choice. A ordem das alternativas precisa de entrar numa avaliação. [5]
- Há um ensaio LangChain de avaliação de agentes publicado em20/09: cinco respostas fixas avaliadas100 vezes cada. É evidência de repetibilidade nesses casos, não500 tarefas diferentes nem validação para agentes de programação. A versão específica do modelo não foi registada nos metadados do ensaio. [6]

## Adequação Ao Produto Atual

Ragnarok já tem registo/listagem/abertura de Projects e está a migrar para Effect. Conversation, modelo real e execução de Workers são trabalho posterior. Por isso, Jev não resolve a falta de onboarding na interface, crashes nativos, ordenação de encerramento ou migração de schemas.

| Uso | Benefício plausível | Limite e momento |
| --- | --- | --- |
| Reconhecer correções do utilizador | Assinalar que a resposta anterior violou uma restrição ou que a pessoa está a corrigir o entendimento | Avaliar primeiro com Conversation; um sinal de discordância não prova erro objetivo nem autoriza mudar uma decisão |
| Avaliar propostas de tarefas/Workers (JEV-F01) | Sugerir competências em falta, delegação excessiva ou necessidade de esclarecimento | Jev classifica aspetos fechados; o modelo principal formula o plano e os owners aplicam a autoridade aprovada |
| Ordenar contexto | Priorizar passagens/decisões relevantes e reduzir contexto inútil enviado ao modelo principal | Filtrar permissões, atualidade e validade deterministamente primeiro; relevância não é verdade |
| Sugerir skills | Escolher entre capacidades já elegíveis, incluindo “nenhuma” | Não concede permissão de executar a skill nem demonstra adequação ao ambiente |
| Identificar possível desvio ou repetição numa execução | Apontar resumos semanticamente repetidos ou aparentemente fora do objetivo para inspeção | Contagens, tempo, saídas de comandos e resultados de testes são factos obtidos em código; o classificador não os substitui |
| Avaliar episódios para melhorias futuras (JEV-F02) | Ajudar a encontrar padrões de mau contexto, planeamento ou comunicação | Fora de v1 conforme o registo anterior; mudanças são propostas comparadas e aprovadas, nunca autopromoção do avaliador |

Exemplo sintético: após o agente sugerir sincronização online, o utilizador responde “Eu tinha dito que era só local”. Jev pode sinalizar uma correção de restrição. O modelo principal pode então explicar o desvio e propor a revisão. Nem a classificação nem a explicação substituem a decisão humana.

Não usar Jev para inferir autorização de escrita, aceitar um Candidate, declarar testes aprovados, transformar memória desatualizada em confiável ou decidir que uma operação externa incerta pode ser repetida.

## Relação Com Effect E Mastra

- Effect gere o ciclo de vida, dependências, falhas e cancelamento da eventual chamada.
- Mastra, se efetivamente adotado no respetivo passo, continua a servir o modelo generativo/execução de IA por trás do adaptador do produto.
- Jev seria outro adaptador, especializado em classificação de excertos autorizados.
- Ragnarok mantém decisões, permissões, versões e estado durável. Uma classificação não é um novo responsável pelo estado.

Não é necessário acrescentar LangChain, LangGraph ou outro framework apenas para usar Jev. Uma API/SDK direta atrás de uma interface pequena permite avaliá-lo sem tornar o restante produto dependente dele. As mensagens do hook Jev-lint vistas no desenvolvimento não demonstram que o Ragnarok já integre ou use o serviço; a finalidade/implementação desse hook não foi verificada nesta pesquisa.

## Custo, Qualidade E Privacidade

O preço direto publicado mantém-se em **US$0,042 por milhão de tokens de entrada**, com saída gratuita. Como exemplo aritmético,1000 pedidos com2000 tokens totais cada custariam aproximadamente **US$0,084**, antes de eventuais repetições ou custos de um intermediário. Os2000 tokens têm de incluir o estado e as perguntas; isto não é uma medição de consumo do Ragnarok. [1]

Os70–500ms do anúncio são uma alegação do fornecedor, não latência medida em Portugal nem garantia ponta a ponta. O modelo principal pode já classificar a intenção durante a resposta; uma chamada extra só compensa se melhorar resultados ou substituir trabalho mais caro. [4]

Limites relevantes: inglês é o idioma de melhor precisão declarada; português europeu precisa de avaliação própria. Há fragilidades reconhecidas em contagem, datas, negações, contexto irrelevante, entradas adversariais e ordem de opções. Alta confiança pode acompanhar um erro sistemático. [1,3,5]

O serviço é remoto. Não usar dados para treino não equivale a não os reter. A documentação oferece ZDR a enterprise mediante contacto; não foi confirmado um prazo geral numérico de retenção nem self-hosting público suportado. Não presumir essas garantias para uma conta normal. [1,7]

O SDK JS documenta retries automáticos e timeout por tentativa, não necessariamente um orçamento total; logging debug pode incluir corpos de pedidos/respostas. Uma futura integração teria de fixar modelo e critérios, limitar o orçamento total e os dados enviados, preservar falhas explícitas e manter conteúdo privado fora dos logs. Isto é trabalho de desenho futuro, não configuração feita nesta sessão. [8]

## Primeiro Ensaio Recomendado, Ainda Não Autorizado

1. Preparar um conjunto pequeno de exemplos sintéticos em português europeu: correção, pergunta neutra, mudança de objetivo, frustração, ironia e casos ambíguos.
2. Rotular o que é observável, incluindo contexto insuficiente; não rotular “o utilizador compreendeu tudo” como se fosse conhecido.
3. Comparar Jev com regras simples e com o modelo principal sem Jev. Separar exemplos usados para afinar critérios daqueles usados para avaliar.
4. Medir correções encontradas, falsos alarmes, abstenção, custo e latência completa. Variar a ordem das opções quando usar Choice.
5. Só propor integração se a melhoria compensar uma dependência externa adicional e menos pedidos de esclarecimento não esconderem pior entendimento.

Não integraria Jev durante a migração Effect apenas por estar disponível. Prepararia a avaliação junto da Conversation e do primeiro modelo real. O utilizador decide se quer esse ensaio e que dados/custos autoriza.

## Fontes Primárias Atuais

1. [Models](https://docs.typesafe.ai/models.md) — modelo, preço, limites, idioma e dados; relido em03/10.
2. [API](https://docs.typesafe.ai/api.md) — primitivas e respostas.
3. [Confidence](https://docs.typesafe.ai/confidence.md) — significado e fórmulas.
4. [TypeSafe](https://typesafe.ai/) e [anúncio Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev) — acesso e alegações de desempenho.
5. [Jev1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) — limitações, revisão declarada em02/10.
6. [Jev-as-a-Judge for Agent Evals](https://www.langchain.com/blog/jev-agent-evals-langsmith) — estudo dos próprios autores, limitado a cinco respostas repetidas.
7. [Legal](https://docs.typesafe.ai/legal.md), [Privacy](https://typesafe.ai/legal/privacy-policy), [DPA](https://typesafe.ai/legal/data-processing).
8. [SDK JS config](https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md), [RetryPolicy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy.md).
9. [Langfuse: discordância expressa pelo utilizador](https://langfuse.com/blog/2026-09-18-using-typesafes-jev-for-evals).
10. [Re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md), [skill suggestion](https://docs.typesafe.ai/cookbooks/skill_suggestion.md), [coding agents](https://docs.typesafe.ai/introduction/coding-agents.md).

Pesquisa detalhada retida em `C:/Users/pedro/AppData/Local/Temp/opencode/ragnarok-jev-refresh-2026-10-03.md`. Context7 foi consultado em três comandos, sem erro de quota. O coordenador confirmou novamente nas fontes oficiais os factos de modelo/preço, limitações, confiança e dimensão do estudo de avaliação. Não há resultados de inferência próprios nesta investigação.
