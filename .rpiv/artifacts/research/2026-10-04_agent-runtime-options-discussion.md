---
date: 2026-10-04
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: proposal
tags: [strategy, runtime, providers, adr-0009, mastra, costs]
---

# Runtime de agentes: opções para discutir (ADR 0009, Mastra, CLIs, API)

Documento de discussão. Não altera o ADR 0009 nem nenhuma decisão aprovada. Base: `2026-10-03_provider-subscription-terms.md` (termos verificados), `2026-10-03_product-thesis.md` e `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md`.

## 1. O que o ADR 0009 assume hoje

- O Ragnarok é dono de uma **Turn Machine**: cada chamada ao modelo é uma "Sealed Invocation" selada e registada. Os pedidos de ferramenta do modelo são **propostas** que o Ragnarok executa (ou recusa) entre tentativas; o adaptador do fornecedor só traduz pedidos e eventos.
- O Mastra é um **adaptador opcional** atrás dessa porta, sem autoridade própria (`mastra.db` descartável).
- Implícito: o Ragnarok chama os modelos diretamente, ou seja, **API keys**.

Consequência: com o ADR 0009 tal como está, **o Ragnarok constrói o seu próprio agente de código** (ciclo, ferramentas de ficheiros/shell, gestão de contexto, edições), e tudo é pago ao token.

## 2. O facto novo

Os termos verificados a 03/10/2026 dizem que a subscrição Claude só pode ser usada no **binário oficial do Claude Code**, e que o Gemini proíbe terceiros de usarem o login do Gemini CLI. Um agente construído pelo Ragnarok tem de usar API keys. Orquestrar os CLIs oficiais permite usar subscrições, mas o ciclo do agente corre **dentro do CLI**, e não na Turn Machine do Ragnarok.

## 3. Opções

| | A. ADR 0009 puro, SDK direto | B. ADR 0009 com Mastra | C. Híbrido (recomendado) | D. Só CLIs |
| --- | --- | --- | --- | --- |
| Workers (código) | Agente próprio, API | Agente próprio via Mastra, API | **CLIs oficiais** (Claude Code, Codex) em worktrees, governados pelo Ragnarok | CLIs |
| Conversation / Frame | SDK direto, API | Mastra, API | **SDK direto, API**, fino | `claude -p` como motor de chat |
| Custo | Alto (tudo ao token) | Alto | Subscrições para o trabalho pesado + API só para o diálogo | O mais baixo |
| Construção | Muito grande | Grande, menos código de streaming mas conceitos sobrepostos | Média | Pequena |
| Controlo | Máximo: cada chamada selada | Alto, mas com retries e memória do Mastra a vigiar | Por fronteiras: permissões, worktree, evidência no fim; não por cada chamada | Baixo |
| Termos | Limpo | Limpo | Limpo nos Workers para uso pessoal; zona cinzenta se for muito intenso | Mais cinzento (CLI usado como motor do produto) |
| Melhorias dos fornecedores | Reconstruir à mão | Depende do Mastra | Herdadas automaticamente | Herdadas |

## 4. Porque recomendo C

1. **Coerente com a tese:** o valor do Ragnarok está no entendimento, nas decisões e na evidência, não em reconstruir o agente de código, onde Claude Code e Codex já são muito bons e melhoram sozinhos.
2. **Custo:** o trabalho pesado (muitos milhões de tokens por tarefa) usa subscrições que já pagas.
3. **O controlo continua real, mas noutro sítio:**
   - Isolamento: um Worker = uma worktree (encaixa no ADR 0008).
   - Permissões: os CLIs têm hooks e mecanismos de aprovação; o Ragnarok passa a ser quem aprova ou recusa ações sensíveis. **Detalhe a verificar num spike.**
   - Observação: `claude -p --output-format stream-json` dá eventos estruturados (verificado na doc headless); o Ragnarok regista-os como observações atribuídas.
   - Evidência independente: o Ragnarok corre os testes e gates **ele próprio** sobre o diff da worktree; não confia no "está feito" do agente. Revisão por outro contexto, como fizemos hoje.
4. **A porta do ADR 0009 mantém-se:** um adaptador "agente CLI externo" é mais uma implementação. Um agente próprio por API pode vir mais tarde, sem reescrever o resto.
5. **Mastra não é necessário para C:** a Conversation precisa só de chamadas, streaming e contexto, que um SDK direto faz. O Effect já gere cancelamento e retries. O Mastra traria memória, workflows e retries próprios que se sobrepõem aos owners determinísticos.

## 5. O que se perde com C (honesto)

- **Não há Sealed Invocation para cada chamada de um Worker:** o ciclo interno do CLI é opaco. O ADR 0009 teria de distinguir dois níveis de garantia: chamadas seladas (Conversation, futuros agentes próprios) e Workers CLI governados por fronteiras.
- **Dependência das interfaces dos CLIs** (flags, formato dos eventos, hooks), que podem mudar.
- **Zona cinzenta dos termos** com muitos Workers em paralelo; antes de abrir ao público, pedir confirmação escrita à Anthropic.
- Políticas de modelo e budget por Worker ficam limitadas ao que cada CLI expõe.

## 6. Custos estimados de API (só o que C paga ao token)

Preços Anthropic verificados (por milhão de tokens, entrada/saída): Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, Haiku 4.5 $1/$5; o Batch tem 50% de desconto; o caching reduz o custo de entrada repetida (multiplicador exato a confirmar na página de preços). Preços OpenAI e Google **não verificados** aqui.

**Conversation/Frame, suposições explícitas:** 50 mensagens por dia de trabalho, ~20k tokens de contexto por mensagem e ~1k de resposta, 22 dias por mês.

| Modelo | Sem caching | Com caching de contexto (estimativa grosseira) |
| --- | --- | --- |
| Haiku 4.5 | ~$1,4/dia, ~$30/mês | bastante menos |
| Sonnet 5.5 | ~$2,5/dia, ~$55/mês | bastante menos |
| Opus 5.5 | ~$5/dia, ~$110/mês | bastante menos |

**Para comparação, Workers por API (opções A/B):** uma tarefa de código substancial pode consumir de 2 a 10 milhões de tokens de entrada. Com Sonnet 5.5 são ~$4–20 por tarefa; com uso diário intenso, dezenas a centenas de dólares por dia. É isto que C evita.

São ordens de grandeza para decidir, não orçamento: medir no primeiro uso real.

## 7. Próximo passo proposto

Um **spike delimitado** (protótipo descartável, ~1 dia, depois da migração e do merge): o Ragnarok lança um `claude -p` numa worktree, lê o `stream-json`, aprova ou recusa uma ação via hook, e no fim corre ele próprio os testes sobre o diff. Responde: quanto controlo e observação são realmente possíveis? Só depois rever o ADR 0009.

## Perguntas para o utilizador

1. Concordas com C como direção a testar no spike?
2. Para a Conversation: que fornecedor ou fornecedores queres suportar primeiro (Anthropic API, OpenAI API, ambos)?
3. Tens um teto de custo mensal de API em mente?

## Decisão do utilizador (2026-10-04)

- **Direção C aprovada para testar:** Workers como CLIs oficiais em worktrees, governados pelo Ragnarok; Conversation/Frame por SDK direto com API key; o Mastra não é necessário para este caminho.
- **Primeiro fornecedor da Conversation: API da Anthropic.**
- Ainda por decidir: teto de custo mensal de API. O spike delimitado (secção 7) corre depois da migração Effect e do merge, antes de rever o ADR 0009. O ADR 0009 continua em vigor até essa revisão.

## Medição real de custos (2026-10-04)

Fonte: histórico local das sessões do Claude Code (só números de tokens; nenhum conteúdo saiu da máquina), recalculado com os preços atuais da API. Preços por milhão de tokens: Haiku 4.5 $1 entrada / $5 saída / $0,10 leitura de cache; Sonnet 5.5 $2 / $10 / $0,20; Opus 5.5 $4 / $20 / $0,20. Escrita em cache ≈1,25× o preço de entrada (TTL de 5 min); leitura ≈0,1×.

| Sessão | Pedidos humanos | Chamadas ao modelo | Contexto médio por chamada | Sonnet 5.5 com cache | Sonnet 5.5 sem cache | Opus 5.5 com cache |
| --- | --- | --- | --- | --- | --- | --- |
| Coordenação (esta sessão, ~15 h) | 53 | 192 | ~259k tokens | ~$13 (~$0,25 por pedido) | ~$101 | ~$16 |
| Implementação Effect (Worker, ~21 h) | 46 | 1150 | ~486k tokens | ~$127 | ~$1128 | ~$142 |
| Sessão pinescript (junho) | 28 | 122 | ~441k tokens | ~$26 | ~$114 | ~$41 |

Conclusões:
1. **O caching é decisivo:** 8 a 15 vezes mais barato. O Ragnarok tem de manter o prefixo estável e o histórico só com acrescentos (append-only).
2. **O trabalho de Worker por API seria caro:** um dia intenso de implementação custaria ~$130 com Sonnet, mesmo com cache. Confirma a direção C (Workers pelos CLIs com subscrição).
3. **O contexto do Claude Code é enorme** (260k–490k por chamada: prompt de sistema, ferramentas, histórico completo, saídas das ferramentas). Uma Conversation do Ragnarok com contexto limitado (por exemplo ~40k) e cache custaria à volta de **$0,02 por mensagem com Sonnet**, ou seja, ~$1/dia e ~$20/mês para 50 mensagens/dia; com Haiku, cerca de metade. Estimativa a confirmar quando houver uso real.
4. Limites: as sessões medidas incluem ciclos de ferramentas, por isso não são conversa pura; o Haiku tem janela de 200k e não cabia nas sessões medidas sem compactação; tokens de raciocínio contam como saída.
