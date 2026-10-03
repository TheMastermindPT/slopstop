---
date: 2026-10-03
author: OpenCode
commit: 8f58420
branch: main
repository: slopstop
status: in-progress
---

# Skills como fontes de procedimentos para Ragnarok

## Pedido e limites

O utilizador pediu investigação das skills do RPIV, disponíveis ao OpenCode e instaladas no Claude: extrair os melhores procedimentos, comparar complementaridade, sobreposição e incompatibilidades, e gerar ideias para melhorar o trabalho dos agentes. Pediu que esta matéria seja discutida com Claude **mais à frente**.

Este é um primeiro levantamento e uma proposta de método, não uma arquitetura aprovada. As skills foram lidas como objetos de estudo, sem executar os seus workflows, hooks, instalações ou benchmarks. Nenhuma política da aplicação ou da migração Effect foi alterada. A discussão futura com Claude ainda não ocorreu.

## Inventário inicial

Pesquisa limitada a `SKILL.md`, com profundidade máxima5, nas quatro fontes locais e nas versões instaladas dos plugins marcados como ativos:

- RPIV fonte:21 entradas.
- Adaptador RPIV/OpenCode gerado:21 entradas.
- Skills partilhadas em `~/.claude/skills`:77 entradas.
- Skills em `~/.agents/skills`:14 entradas.
- Plugins Claude ativos:93 entradas, incluindo RPIV21, Matt Pocock35, context-mode11, Stripe10, SonarQube9 e outras7.

Total: **226 referências**, **167 conteúdos distintos** após normalizar CRLF/LF e espaços exteriores, **133 nomes normalizados** após retirar o prefixo `rpiv-` onde existente. Estes números não são uma contagem de capacidades independentes: podem incluir referências ao mesmo ficheiro, cópias, adaptadores e nomes iguais com conteúdo diferente.

O levantamento não é um inventário completo de comportamento de plugins. Por exemplo, feature-dev usa um comando e agentes fora de SKILL.md; context-mode tem hooks; Impeccable carrega referências. Alguns desses suportes foram inspecionados seletivamente nesta análise.

Comparações diretas confirmaram correspondências exatas entre vários ficheiros RPIV fonte/cache e Matt Pocock partilhado/cache. A igualdade dos SKILL.md não prova igualdade das árvores completas de referências. Antes de adotar um procedimento, é necessário identificar a fonte e versão efetivas e resolver eventuais variantes.

## Ideia central

**Extrair mecanismos pequenos e escolher um condutor principal por tarefa/fase, em vez de concatenar orquestradores completos.** Separar quatro componentes presentes numa skill:

1. Princípios: o que pretende preservar, como comportamento observável ou autoridade humana.
2. Técnicas: entrevista, experiência, teste, comparação, revisão ou resumo.
3. Política de execução: quando perguntar, quantos agentes lançar, quando parar, commitar ou repetir uma verificação.
4. Dependências do ambiente: ferramentas, scripts, formatos e convenções Claude/OpenCode.

A utilidade de uma técnica não implica adotar todas as políticas e dependências do documento de origem.

## Método proposto

### 1. Identificar e deduplicar fontes

Registar nome, origem, versão, hash, finalidade e suportes relevantes. Classificar cópias exatas, adaptações do harness, versões divergentes e skills de finalidade semelhante. Comparar os procedimentos depois dessa deduplicação, não contar popularidade por número de cópias.

### 2. Extrair cartões de procedimento

Cada cartão deverá responder:

- Que problema resolve e em que situação se aplica?
- Que informação, autorização e capacidades exige?
- Que passos realmente mudam o comportamento do agente?
- Que resultado observável produz?
- Quando termina, pede ajuda ou abandona uma hipótese?
- Qual o custo provável em tempo, contexto, agentes e perguntas?
- Com que outros procedimentos combina ou entra em conflito?
- Qual a fonte e que evidência existe da sua eficácia?

Não atribuir qualidade comprovada a uma instrução apenas por estar bem escrita ou ser popular.

### 3. Construir uma matriz de composição

Relações distintas: duplicação, especialização, complementaridade, sequência, alternativas, conflito sob a mesma condição e dependência. Dois métodos podem ser alternativos como condutor principal e ainda fornecer técnicas complementares. As condições e o momento importam tanto como os nomes.

### 4. Propor percursos adaptativos

Exemplos a avaliar, não novos pipelines obrigatórios:

- Pedido pequeno e claro: entendimento breve, alteração focada, prova do comportamento, revisão proporcional.
- Objetivo ambíguo: entrevista, mapa de decisões, alternativas e experiência apenas onde resolva uma dúvida.
- Falha intermitente: reproduzir, instrumentar uma hipótese, limitar tentativas/tempo, registar o que continua desconhecido.
- Mudança de persistência/concorrência: invariantes explícitos, testes relevantes, revisão independente e prova de recuperação.
- Alteração de UI: respeitar a identidade existente, provar a tarefa e os estados de erro, verificar acessibilidade; expressão visual depende do pedido.

Incluir a alternativa “não é necessária uma skill especial”. Carregar técnicas ou referências só quando ajudam, mantendo ferramentas específicas opcionais conforme a decisão do utilizador.

### 5. Comparar resultados antes de incorporar

Preparar casos representativos e repetir o mesmo pedido/contexto/modelo com o procedimento atual e o candidato. Usar resultados observáveis, inspeção de traces e avaliação humana; incluir casos não usados para afinar o procedimento.

Medir correção e completude, retrabalho, intervenções úteis versus redundantes, tempo até uma demonstração utilizável, consumo e capacidade de retomar. Não usar quantidade de documentos, agentes, ferramentas ou testes como objetivo. Uma melhoria de estilo sem melhoria do resultado não basta.

### 6. Discutir com Claude e decidir com o utilizador

Apresentar exemplos, conflitos e hipóteses, pedir contrapontos e comparar o esforço de composição. Depois trazer uma proposta curta ao utilizador, com o que adotar, manter opcional, experimentar ou rejeitar. Nenhum acordo apenas entre agentes muda o produto.

## Procedimentos mais promissores nesta primeira leitura

| Mecanismo | Utilidade provável | Cuidado ao extrair |
| --- | --- | --- |
| Fronteira de decisões — Wayfinder | Separar decisões desbloqueadas do que ainda não pode ser especificado | Não transformar toda tarefa pequena num mapa de tickets |
| Confirmação concreta de entendimento — discover/grilling | Reduzir mal-entendidos antes de construir | Escolher o ritmo de perguntas; não repetir uma entrevista quando já há consenso |
| Investigação por lacuna de conhecimento | Distinguir factos verificáveis de decisões que só a pessoa pode tomar | Não perguntar ao utilizador o que o agente pode verificar; não pesquisar sem pergunta delimitada |
| Comparação com possibilidade de “nenhuma serve” | Evitar um vencedor artificial entre alternativas inadequadas | Candidatos e dimensões devem justificar o custo da análise |
| Oráculo independente e teste pela fronteira pública | Demonstrar comportamento e não apenas chamadas internas | Não derivar o resultado esperado do algoritmo que se está a testar |
| Diagnóstico por hipótese e experiência | Distinguir causa demonstrada de suspeita | A skill original não impõe limite finito; a adaptação precisa de uma paragem explícita |
| Revisão por perguntas distintas e verificação das alegações | Encontrar erros e retirar falsos positivos | Mais revisores não garantem mais informação; evitar repetição da mesma pergunta sobre a mesma revisão |
| Divulgação progressiva de instruções/contexto | Manter só as regras e os dados necessários ativos | Um resumo não pode transformar uma procura parcial em certeza universal |
| Respeito pelo contexto visual e verificação limitada | Melhorar uma interface sem redesenhar o que já estava decidido | UI de operação não tem os mesmos objetivos de uma landing page expressiva |
| Continuidade breve baseada no estado real | Retomar trabalho sem reconstruir várias conversas | Evitar duas fontes concorrentes de estado e re-investigação completa a cada retoma |
| Avaliação de procedimentos — skill-creator | Comparar se uma skill realmente melhora o trabalho | Avaliar substância, traces e casos reservados, não apenas cumprimento aparente do ritual |

## Complementos e conflitos concretos

| Par | Relação observada |
| --- | --- |
| Wayfinder + RPIV plan | Sequenciais: decisões por resolver versus ordenação de contratos já definidos |
| discover + to-spec | Descoberta antes da síntese quando falta consenso; to-spec dispensa nova entrevista quando a conversa já resolve a intenção |
| grill-me + grill-with-docs | Variantes: a segunda acrescenta modelação/documentação à mesma entrevista, não uma entrevista independente |
| discover + grilling | Conflito de ritmo se conduzirem a mesma fase: perguntas individuais/pequenos grupos versus toda a fronteira de perguntas numa ronda |
| RPIV implement + Matt implement | Controladores alternativos: diferem na obrigação TDD, paragens, aceitação e commit automático; não podem governar simultaneamente a mesma alteração |
| prototype + implementação com TDD | Complementares se a experiência responder a uma dúvida; código promovido a produção precisa das obrigações próprias dessa entrega |
| Deep review + architectural review | Perguntas diferentes sobre diff e estrutura podem complementar-se; dupla verificação da mesma alegação/revisão pode repetir trabalho |
| Mutação no candidate-workflow + mutação na revisão arquitetural | Políticas diferentes: execução disponível como expectativa versus checkpoint que permite não executar. Não importar ambas como regra única |
| Frontend expressivo + Impeccable Operate | Dependem da superfície: identidade nova versus clareza de uma ferramenta existente. Não impor novidade estética a cada correção |
| Guias TypeScript/React + trabalho de UX | Complementares: validade técnica/performance não substituem compreensão, erros, acessibilidade ou conclusão da tarefa |
| annotate-inline + annotate-guidance | Alternativas de localização para o mesmo propósito; escolher um dono das instruções, não duplicar ambas |
| teach + implementação autónoma | Objetivos primários incompatíveis no mesmo momento: dar espaço para a pessoa praticar versus concluir o trabalho por ela. Podem alternar explicitamente |
| Handoff breve + resume extensivo | Verificar o estado complementa o resumo; reler tudo e repetir investigação em cada retoma pode anular o ganho |

## Referências e cobertura da leitura

Fontes principais: `C:/Users/pedro/rpiv-claude/rpiv/skills`, adaptador OpenCode gerado, `C:/Users/pedro/.claude/skills`, `C:/Users/pedro/.agents/skills` e diretórios das versões ativas listadas em `~/.claude/plugins/installed_plugins.json`. Foram usadas apenas chaves de ativação e caminhos dos plugins, não credenciais.

Exemplos de âncoras:

- `skills/wayfinder/SKILL.md:55-91,103-126` — fronteira e paragens; `rpiv/skills/plan/SKILL.md:26-44` — contratos já definidos.
- `rpiv/skills/discover/SKILL.md:192-215` e `skills/grilling/SKILL.md:8-22` — ritmo de entrevista.
- `rpiv/skills/_shared/test-contract-authoring.md:33-49` e `skills/tdd/SKILL.md:14-32` — oráculos independentes e fronteira pública.
- `rpiv/skills/implement/SKILL.md:37-67` e `skills/implement/SKILL.md:9-15` — políticas divergentes de execução.
- `skills/diagnosing-bugs/SKILL.md:12-66,90-140` — hipótese, experiência e ausência de limite finito.
- `rpiv/skills/_shared/candidate-workflow.md:155-167` e `architectural-review/references/tool-ingestion.md:19-24` — políticas de mutação diferentes.
- `skills/impeccable/SKILL.md:18,23-41` — objetivo visual e limites de verificação.
- `skills/writing-for-agents/SKILL.md:10-43,76-81` — pointers, divulgação progressiva e dono único.
- Plugin `skill-creator/.../SKILL.md:169-234` e `agents/grader.md:21-54,68-97` — comparação de procedimentos e traces.

Análises detalhadas com caminhos absolutos e linhas estão retidas em Temp: `ragnarok-skill-patterns-intent.md` (17 entradas de intenção/planeamento e correspondentes caches), `ragnarok-skill-patterns-execution.md` (seis RPIV, nove partilhadas e referências focadas) e `ragnarok-skill-patterns-context-ui.md` (oito partilhadas, quatro RPIV e plugins relevantes).

Esta primeira leitura aprofundou as famílias transversais, não todas as133 famílias de nomes nem cada skill específica de fornecedor. Não foi medida eficácia empírica nem concluída a adaptação para Ragnarok. Próximos entregáveis: catálogo deduplicado rastreável, cartões de procedimentos, matriz de composição e proposta de ensaio — depois discussão com Claude no momento adequado.
