---
date: 2026-10-04
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: draft
tags: [evaluation, metrics, baseline, protocol]
---

# Protocolo de avaliação: Ragnarok vs Claude Code no Herdr

Objetivo: decidir, com dados e apesar da natureza estocástica dos modelos, se o Ragnarok melhora o trabalho com agentes face ao método atual (Claude Code coordenado à mão pelo Herdr). Este protocolo é escrito **antes** de qualquer corrida; o critério de sucesso fica fixado antes de ver resultados. Substitui as métricas provisórias de `evidence/2026-10-03_baseline-measurement-log.md` para a comparação formal; esse registo continua para notas leves do dia a dia.

## 1. Condições

| | A. Linha de base | B. Ragnarok |
| --- | --- | --- |
| Ferramenta | Claude Code em painéis do Herdr, coordenado à mão pelo utilizador | Ragnarok (Waypoint parent + Workers CLI), no modo de pagamento escolhido |
| Modelo e esforço | Iguais nas duas condições e registados (modelo, versão do CLI, esforço) | Iguais |
| Pagamento | Subscrição | O mesmo modo da condição A (regra de um só modo) |

A condição A pode começar já. A condição B só quando existirem Workers e Waypoint parent no Ragnarok.

## 2. Projeto e ponto de partida
- Projeto: cópia descartável do MaxReps, `C:/Users/pedro/Documents/GitHub/maxreps-baseline` (Supabase local isolado).
- Cada corrida parte de uma **worktree nova a partir do mesmo commit** (o "commit de referência" da tarefa), com a base de dados local reposta no mesmo estado.
- **Sessões novas** em cada corrida: sem memória, histórico ou contexto de corridas anteriores. O `CLAUDE.md`/`AGENTS.md` do projeto é igual nas duas condições.

## 3. Tarefas
- **6 a 10 tarefas** de tipos diferentes; nenhuma tarefa sozinha decide.
- Coerentes com o trabalho real futuro: o utilizador vai reconstruir quase tudo exceto a landing page, por isso privilegiar **fatias verticais construídas de raiz**, mais algumas correções e refactors.
- Cada tarefa tem: enunciado escrito igual para as duas condições; commit de referência; âmbito explícito do que não fazer; tamanho alvo (ideal: 1–3 horas de agente).

Candidatas iniciais (a confirmar com o utilizador; fonte: `PLAN.md` e `PRODUCT.md` do MaxReps):
1. Registo de séries durante o treino (reps, carga, RPE, marca de dor), de raiz, para telemóvel.
2. Histórico de treinos com a última sessão por exercício.
3. Check-in semanal de recuperação.
4. Substituição de exercício com regras de dor e equipamento.
5. Painel de progresso com uma métrica bem definida.
6. Uma correção real de um defeito conhecido do código atual.
7. Um refactor delimitado com fronteira de arquitetura (dependency-cruiser) como critério.
8. Uma regra do motor de progressão determinístico com casos-limite.

## 4. Repetições
- **3 corridas por tarefa e por condição** como base; 5 nas tarefas onde as 3 primeiras divergirem muito.
- Ordem das corridas alternada (A, B, A, B…) para não favorecer uma condição com o estado da máquina ou do serviço.
- Orçamento: cada corrida consome limite do plano ou dinheiro; o número total de corridas é acordado antes (ver secção 9).

## 5. Oráculo definido antes
- **Testes de aceitação escondidos**, escritos antes das corridas para cada tarefa, guardados fora da worktree e aplicados só no fim. Decidem se a tarefa ficou feita.
- **Sinais automáticos** sobre o diff: testes existentes verdes, tipos, lint, CodeScene (saúde dos ficheiros tocados), jscpd (duplicação), dependency-cruiser (fronteiras), Knip (código morto) e mutation testing (Stryker) sobre os testes novos.

## 6. Avaliação às cegas
- Antes da revisão, retirar do diff tudo o que identifique a condição (artefactos, mensagens, nomes de ficheiros do Ragnarok).
- **Revisor independente:** um modelo forte (Opus) com uma rubrica fixa, sem saber a condição; classifica defeitos por gravidade.
- **O utilizador avalia às cegas uma amostra** (por exemplo, 1 corrida por tarefa e condição), com a mesma rubrica.

## 7. Métricas por corrida
| Grupo | Métrica |
| --- | --- |
| Qualidade | testes de aceitação passados; defeitos da revisão às cegas por gravidade; sinais automáticos |
| Retrabalho | correções necessárias depois do "está feito" até passar no oráculo |
| Esforço humano | tempo de atenção do utilizador; número de intervenções e correções "não era isto" |
| Custo | tokens por papel ou fração do limite do plano consumida; tempo total |

O esforço humano mede-se com um registo simples durante a corrida (início/fim de cada intervenção).

## 8. Análise
- Comparação **emparelhada por tarefa**: mediana e pior caso de cada condição; contagem de vitórias e derrotas por tarefa.
- Com poucas corridas só se distinguem **diferenças grandes**; não tirar conclusões de diferenças pequenas.
- Reportar tudo, incluindo tarefas onde a condição B perde.

## 9. Critério de sucesso (a fixar com o utilizador ANTES das corridas)
Proposta para discussão:
- O Ragnarok **ganha em qualidade** (oráculo + revisão às cegas) em pelo menos **6 de 8** tarefas, **ou** iguala a qualidade reduzindo o esforço humano em pelo menos **30%**;
- e **não piora** o custo em mais de **X%** (X a definir), nem o pior caso de qualidade em nenhuma tarefa.
- Orçamento total de corridas: **a definir** (número de corridas e limite de gasto).

Se o critério falhar, o resultado é informativo: diz onde o Ragnarok não acrescenta valor, e pesa na decisão de viabilidade do projeto.

## 10. Riscos e limites
- **Aprendizagem humana:** o utilizador fica a conhecer as tarefas; mitigar com enunciados escritos e intervenções registadas, e alternando a ordem.
- **Mudanças dos modelos ou dos CLIs a meio:** registar versões; repetir se mudarem.
- **Viés do revisor modelo:** a amostra cega avaliada pelo utilizador serve de controlo.
- **Tarefas pouco representativas:** rever a lista com o utilizador antes de começar.

## Próximos passos
1. O utilizador confirma ou ajusta as tarefas candidatas e o critério de sucesso (secção 9).
2. Escrever os testes de aceitação escondidos das primeiras 2–3 tarefas.
3. Correr a condição A nessas tarefas, já com este protocolo.
