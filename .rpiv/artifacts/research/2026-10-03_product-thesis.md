---
date: 2026-10-03
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: proposal
tags: [strategy, product, thesis]
---

# Tese do produto Ragnarok — proposta para discussão

Proposta do coordenador para discussão com o utilizador. Não altera `PRODUCT.md`, ADRs nem decisões aprovadas. A pesquisa de inspiração está em `2026-10-03_inspiration-projects-research.md`.

## 1. A tese numa frase

**Escrever código deixou de ser o gargalo; o gargalo é o humano saber o que foi feito, porquê, se está certo e se ainda é o que queria.** O Ragnarok compete em confiança e entendimento, não em geração de código.

## 2. Porque acreditamos nisto — prova vinda do próprio projeto

Em 03/10/2026, para coordenar três agentes (OpenCode, coordenador Claude, implementador Claude), usámos à mão um protocolo:

| Prática manual de hoje | Resultado observado | Equivalente no produto |
| --- | --- | --- |
| Teach-back antes de assumir a coordenação | O OpenCode corrigiu 4 distinções (SQL no worker, timing das skills, merge condicional, falha pré-existente ≠ dispensa) | Frame: o modelo expõe o entendimento antes de agir |
| Identidade congelada (HEAD, hash do diff) antes da revisão | Revisão ligada ao código real, não às alegações | Candidate delta fechado |
| Revisão por contexto que não escreveu o código | Encontrou o defeito R-1, provável causa da falha empacotada | Revisão independente como papel nativo |
| Passou / falhou / não executado / pré-existente sempre distintos | Nenhuma falha escondida; limitação do pacote dita com honestidade | Evidence com estados distintos |
| Decisões humanas registadas com a consequência aceite | Opção (ii) e lista de garantias rastreáveis | Registo de decisões / Accepted revisions |
| Um escritor por âmbito, handback sem espera circular | Sem edições paralelas | Workers delimitados, coordenador determinístico |

Funcionou, mas custou um handoff de 360 linhas, mensagens copiadas entre terminais e o utilizador a fazer de router. **Esse protocolo é a especificação do produto; o Ragnarok deve torná-lo nativo e barato.**

## 3. O que entrega, por área

- **Entendimento humano↔máquina (o núcleo).** O modelo devolve o entendimento antes de agir e o humano aceita ou corrige (Frame). Correções viram regras duráveis e verificadas (Verified Memory), para não as repetir. Qualquer artefacto responde “porque está assim?” com ligação à decisão.
- **Workflows.** Trabalho não linear visível; atenção humana só para exceções e decisões (Attention); papéis, handbacks e passagem de contexto entre agentes deixam de ser manuais.
- **Qualidade do código.** Não “mais checks”, mas evidência legível: o que mudou, o que o prova, o que ficou por provar, o que já falhava. Ferramentas de qualidade opcionais e substituíveis alimentam a Evidence.
- **Arquitetura.** Fronteiras vivas: o agente vê as decisões aplicáveis ao que edita; uma alteração que cruza uma fronteira pára e pede decisão em vez de corroer em silêncio.

## 4. O que não é

- Não é outro gerador de código nem um IDE.
- Não promete correção; mostra evidência e incerteza.
- Não é uma fábrica de documentos: mais agentes, documentos ou testes não são sucesso.

## 5. Métricas principais (propostas)

1. **Uso real:** o dia em que o Ragnarok passa a ser usado para construir o próprio Ragnarok, e a fração do trabalho feita através dele.
2. **Retrabalho por mal-entendido:** correções do tipo “não era isto” por unidade de trabalho entregue.
3. **Custo de retoma:** tempo e texto necessários para um humano ou agente retomar trabalho interrompido (hoje: um handoff de 360 linhas).

Secundárias: defeitos encontrados depois de integrar; interrupções inúteis ao humano.

## 6. Riscos

- **Cerimónia.** O próprio projeto caiu nela (13 documentos de revisão no PC-S1). Cada garantia tem de ser barata para o utilizador ou é cortada.
- **Especificação à frente do produto.** Mitigação: chegar cedo à Conversation com modelo real e usá-la.
- **Absorção pela concorrência.** Ferramentas de agentes vão absorver peças isoladas (worktrees, quadros, specs). Diferenciação sustentável: local-first, registo de decisões humanas, independência do fornecedor de agentes, coordenação multiagente com evidência.

## 7. Consequências propostas para o roadmap (por decidir)

1. Depois do PC-S1 reduzido, priorizar Conversation com modelo real e teach-back (Frame mínimo) antes de Board/Workers.
2. Tratar o protocolo de coordenação de hoje como requisito explícito de Workers/Runs: identidade congelada, handback estruturado, revisão independente.
3. Medir as três métricas desde o primeiro uso, de forma simples.
