---
date: 2026-10-03
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: research
tags: [strategy, inspiration, research]
---

# Projetos de inspiração para o Ragnarok — pesquisa

Pesquisa web feita em 03/10/2026 por três agentes de pesquisa, sintetizada pelo coordenador. Acompanha `2026-10-03_product-thesis.md`. É pesquisa, não aprovação de adoção. Os números de estrelas e versões são os reportados pelas fontes na data. **[V]** = verificado na fonte primária indicada; **[S]** = fonte secundária ou resumo de pesquisa; **[I]** = inferência.

## 1. Especificação antes do código

### AWS Kiro — vivo
- GA a 17/11/2025; CLI 2.27.0 (01/10/2026) e IDE 1.2.4 (30/09/2026) [V] ([GA](https://kiro.dev/blog/general-availability/), [changelog](https://kiro.dev/changelog/)).
- A copiar: specs requisitos → desenho → tarefas [V] ([intro](https://kiro.dev/blog/introducing-kiro/)); requisitos EARS dos quais se extraem testes baseados em propriedades [V]; steering files em `.kiro/steering/` com referências vivas a ficheiros [V]; checkpoints/rollback de passos do agente [V]; hooks por evento [V].
- Crítica: um pequeno bug virou "quatro user stories com dezasseis critérios de aceitação" [V] ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).

### GitHub Spec Kit — vivo, MIT, ~140k estrelas
- Comandos `constitution`, `specify`, `clarify`, `plan`, `tasks`, `analyze`, `implement`, `converge`; independente do agente [V] ([repo](https://github.com/github/spec-kit)).
- A copiar: constituição de princípios; gate `clarify` antes do plano; `analyze` (consistência entre artefactos); `converge` (verificar conclusão contra a spec).
- Crítica: "muito verboso e cansativo de rever", duplicação de código existente [V] ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)); discussão "SpecKit cria a ilusão de trabalho" [V] ([#1784](https://github.com/github/spec-kit/discussions/1784)); "waterfall reinventado" e drift entre spec e código [S].

### GitHub Copilot Workspace — descontinuado
- Preview técnica terminou a 30/05/2025 [S]; manual arquivado a 02/09/2025 [V] ([manual](https://github.com/githubnext/copilot-workspace-user-manual)). Fluxo: tarefa → spec/plano editável → implementação.
- Sem declaração primária da razão nem do sucessor; blogs dizem que as ideias passaram para o coding agent [S].

## 2. Agentes em paralelo com worktrees

### Conductor — vivo (Mac)
- Corre Claude Code, Codex, Cursor e OpenCode em paralelo; cada tarefa tem workspace, branch, terminal, diff e revisão próprios; ciclo rever → PR → merge → arquivar [V] ([docs](https://www.conductor.build/docs/)). Sem memória nem registo de decisões visível [I].

### Vibe Kanban (BloopAI) — empresa fechou
- README: "is sunsetting"; ~28k estrelas, Apache-2.0 [V] ([repo](https://github.com/BloopAI/vibe-kanban)). Encerramento anunciado a 10/04/2026; serviços remotos terminados, continua open source comunitário local [S] ([post](https://www.vibekanban.com/blog/shutdown)). Razão: "a grande maioria são utilizadores gratuitos" [S].
- A copiar: comentários inline no diff enviados diretamente ao agente [V]; branch + terminal + dev server por workspace [V].
- Lição [I]: um quadro de agentes sozinho não sustentou um negócio; o quadro é commodity.

### Outros (fontes secundárias) [S]
- Sculptor (Imbue): containers Docker em vez de worktrees, preview experimental.
- Crystal (Stravu): app Electron, descontinuada em 02/2026 a favor do Nimbalyst, fechado.
- Claude Squad: tmux + worktrees, AGPL.

## 3. Contexto e Git como trilho

### Aider
- Repo map: classes e funções mais importantes com assinaturas, ordenadas por grafo de dependências, orçamento de 1.000 tokens por omissão [V] ([repo map](https://aider.chat/docs/repomap.html)).
- Cada edição gera um commit descritivo; as alterações sujas prévias vão para um commit separado; `/undo`; autoria do agente marcada [V] ([git](https://aider.chat/docs/git.html)).
- Modo architect/editor: um modelo desenha, outro edita; ganhos em benchmark [V] ([blog](https://aider.chat/2024/09/26/architect.html)). Sessão única, sem supervisão multiagente [I].

## 4. Agentes que se auto-melhoram

### Hermes Agent (Nous Research) — MIT
- "Closed learning loop"; memória persistente, skills escritas pelo próprio agente, subagentes isolados, aprovação de comandos, vários backends de execução [V] ([repo](https://github.com/NousResearch/hermes-agent)).
- Memória limitada por desenho: `MEMORY.md` (~800 tokens) + `USER.md` (~500 tokens) + pesquisa FTS5 de sessões com resumo [V] ([memória](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/memory.md)).
- Skills criadas após tarefas complexas e refinadas com o uso, no formato agentskills.io [V].
- Risco: memória e skills iniciadas pelo agente sem verificação humana obrigatória [I]; suporte Windows nativo recente [V]; agentes que se auto-melhoram podem derivar para comportamento inseguro enquanto as métricas sobem [S] ([arXiv 2608.12851](https://arxiv.org/pdf/2608.12851)).
- Não confundir com a família de modelos Hermes.

### Prime Agent (Prime Intellect) — MIT
- Identificação: `PrimeIntellect-ai/prime-agent` [V] ([repo](https://github.com/PrimeIntellect-ai/prime-agent)). Há vários repositórios homónimos com descrições copiadas; tratar como ruído e possíveis lookalikes ou malware [I].
- Recursive Language Model: o contexto é tratado como variáveis e os subagentes como chamadas de função num REPL Python persistente. "Continual Harness": prompts, memórias, skills e especificações de subagentes são estado durável, atualizado por "pequenas atualizações apoiadas em evidência" [V].
- A copiar: `/refine` revê uma trajetória terminada e propõe edições pequenas ao harness [V]; estado do harness versionável em disco [V]; skills executáveis [V]; orçamentos em modo autónomo [V].
- Risco: executa Python gerado pelo modelo com as permissões do utilizador; recomenda sandbox externa [V]. Sem registo de decisões humanas visível [I].

## 5. Síntese para o Ragnarok [I]

1. **Toda a gente converge para o mesmo esqueleto:** artefacto revisto pelo humano entre intenção e código; worktree por agente; diff por tarefa. Isto já não diferencia.
2. **O ponto fraco comum é a cerimónia e o drift:** specs verbosas, tamanho fixo independentemente da tarefa, specs desatualizadas. Confirma o risco da tese. O Frame tem de escalar ao tamanho da tarefa (o `PRODUCT.md` já prevê um "caminho rápido" para trabalho claro e de baixo risco) e precisa de um verificador spec↔código (como `analyze`/`converge`).
3. **O auto-melhoramento é automático nos outros e governado no Ragnarok.** Hermes e Prime Agent atualizam memória e skills sozinhos. O Ragnarok pode adotar os formatos (memória limitada, refine por evidência, estado versionado) com um gate de aceitação humana, que já é a regra da Verified Memory e do JEV-F02. É talvez a diferenciação mais clara.
4. **Critério de aceitação ligado a evidência executável** (Kiro EARS → testes de propriedades; Spec Kit `converge`) corresponde diretamente a Evidence.
5. **Viabilidade:** o fecho da Vibe Kanban mostra que o quadro de agentes é commodity e não sustenta um produto; o valor tem de estar na camada de entendimento e decisão.

### Candidatos a adotar (propostas, por decidir)
- Memória com orçamento fixo e curadoria (Hermes) para a Verified Memory.
- Loop `refine` pós-trabalho com propostas pequenas, apoiadas em evidência e aceites pelo humano (Prime Agent + JEV-F02).
- Verificação de convergência spec↔código antes de declarar trabalho feito (Spec Kit).
- Comentários no diff que voltam ao agente (Vibe Kanban) na revisão de Candidate.
- Commit por alteração com autoria do agente marcada (Aider) como trilho de undo e evidência.
- Repo map compacto (Aider) para propostas de contexto.

## Lacunas
- Razão primária e sucessor do Copilot Workspace por confirmar; post de encerramento da Vibe Kanban não lido diretamente; Sculptor, Crystal e Claude Squad só por fontes secundárias; datas de criação e de release do Prime Agent não verificadas; uso de tree-sitter pelo Aider não confirmado na página lida.
