---
date: 2026-10-04
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: research
tags: [strategy, providers, costs, local-models, conversation]
---

# Modelos baratos e locais para a Conversation/Frame

Pesquisa web em fontes oficiais, páginas lidas a 04/10/2026. Complementa `2026-10-04_agent-runtime-options-discussion.md`. [V] = verificado na fonte indicada; [S] = fonte secundária; [I] = inferência. Não aprova nenhum fornecedor.

## Carga de trabalho assumida
50 mensagens/dia × 22 dias = 1100 mensagens/mês; 30k tokens de contexto por mensagem com ~90% de cache; 1k de saída. Total mensal: 29,7M de entrada em cache, 3,3M sem cache, 1,1M de saída. Ignora o prémio de escrita em cache e os custos de armazenamento do cache explícito do Gemini, por isso o custo real fica ligeiramente acima.

## Modelos alojados — custo mensal para esta carga [I, com preços V]

| Modelo (entrada / cache / saída por MTok) | $/mês |
| --- | --- |
| Anthropic Haiku 4.5 ($1 / $0,10 / $5) | **11,77** |
| OpenAI gpt-5.4-mini ($0,75 / $0,075 / $4,50) | 9,65 |
| OpenAI gpt-5-mini ($0,25 / $0,025 / $2,00) | 3,77 |
| OpenAI gpt-5.4-nano ($0,20 / $0,02 / $1,25) | 2,63 |
| OpenAI gpt-5-nano ($0,05 / $0,005 / $0,40) | 0,75 |
| Google Gemini 3.8 Flash ($0,75 / $0,075 / $3,75; duplica a 01/01/2027) | 8,83 |
| Google Gemini 3.5 Flash-Lite ($0,30 / $0,03 / $2,50) | 4,63 |
| DeepSeek-Flash (preço varia entre horas de ponta e fora de ponta) | 1,25–2,49 |
| DeepSeek-V4-Pro | 5,0–10,0 |
| Mistral Small 4 ($0,15 / sem preço de cache publicado / $0,60) | ~5,6 (limite superior) |

Fontes [V]: [OpenAI](https://developers.openai.com/api/docs/pricing), [Gemini](https://ai.google.dev/gemini-api/docs/pricing), [DeepSeek](https://api-docs.deepseek.com/quick_start/pricing), [Mistral](https://mistral.ai/pricing), [Mistral Small 4](https://docs.mistral.ai/models/mistral-small-4-0-26-03), [OpenRouter FAQ](https://openrouter.ai/docs/faq), [OpenRouter caching](https://openrouter.ai/docs/guides/features/prompt-caching).

Termos e privacidade:
- **Gemini:** o nível grátis usa o conteúdo "para melhorar os produtos"; o nível pago não [V].
- **DeepSeek:** dados guardados na RPC e possivelmente usados para treino, sem retenção publicada [S, política primária não lida]. Não usar em conversas com detalhes do projeto.
- **OpenRouter:** sem margem na inferência, 5,5% (mínimo $0,80) ao comprar créditos por cartão; não guarda prompts por omissão; permite restringir a fornecedores que não treinam com os dados [V]. O cache passa pelo fornecedor [V].
- **OpenAI e Mistral:** termos de retenção e treino por verificar (a página da OpenAI devolveu 403).

## Modelos locais na RTX 3070 (8 GB), 32 GB RAM, Ryzen 5 5600X

Benchmarks medidos numa 3070 com llama.cpp, Q4_K_M e contexto de 4K [V] ([bmdpat](https://bmdpat.com/gpu/rtx-3070)):

| Modelo | Velocidade | VRAM | Cabe todo na GPU? |
| --- | --- | --- | --- |
| Llama 3.1 8B | 73,7 tok/s | 5,4 GB | sim |
| Qwen3.5 9B | 59,4 tok/s | 6,8 GB | sim |
| Gemma 3 12B | 4,3–8,6 tok/s | — | não, transborda para a RAM |

- **Qwen3.5-9B:** Apache 2.0 (uso comercial permitido), 201 línguas, contexto nativo de 262k, modo sem raciocínio disponível [V] ([model card](https://huggingface.co/Qwen/Qwen3.5-9B)). Mantém ~55–58 tok/s até 16K de contexto [S].
- **Ponto fraco [I]:** com contextos de 20–40k, parte do modelo pode ir para a CPU e o processamento inicial do prompt pode demorar muitos segundos. A qualidade em português europeu de um modelo de 9B não está verificada.
- **Runtimes:** o Ollama tem API compatível com a OpenAI e aceita um JSON Schema para forçar o formato da resposta [V] ([docs](https://docs.ollama.com/capabilities/structured-outputs)). LM Studio e llama.cpp por verificar.

## Candidatos para avaliação emparelhada com conversas reais
1. **Haiku 4.5** como referência (~$12/mês).
2. **gpt-5-mini** ou **gpt-5.4-mini** (~$4–10/mês), depois de verificar os termos de dados.
3. **Gemini 3.5 Flash-Lite**, só nível pago (~$5/mês).
4. **DeepSeek-Flash** só para comparar o preço, com conversas não sensíveis (~$1–2,5/mês).
5. **Qwen3.5-9B Q4_K_M via Ollama** como candidato local (grátis), testado a 8k, 16k e 30k de contexto.

Critérios: qualidade das respostas e das decisões, respostas estruturadas válidas segundo o schema, português europeu, latência e custo por tarefa concluída (não por mensagem).

## Conclusão [I]
- Com caching, a Conversation com Haiku fica em ~$12/mês para uso intenso, abaixo da estimativa anterior de ~$20. Os modelos baratos descem para $1–5/mês, e os locais para zero.
- A poupança entre alojados baratos é de poucos dólares; a escolha deve pesar sobretudo **qualidade e privacidade**.
- O modelo local é promissor para diálogo de rotina com contexto curto; contextos longos são o risco a testar primeiro.

## Correção: modelos atuais (verificação às listas oficiais e notas de lançamento, 04/10/2026)

O utilizador apontou que a lista acima parecia desatualizada; estava, em parte. Esta secção substitui a tabela e os candidatos acima onde diverge.

| Fornecedor | Modelo barato atual | Data | Entrada / cache / saída por MTok | $/mês nesta carga [I] | Estado da lista anterior |
| --- | --- | --- | --- | --- | --- |
| OpenAI | **GPT-6 Luna** | maio ou setembro de 2026 (fontes oficiais contraditórias) | $0,10 / $0,01 / $0,50; contexto 1,05M | **~1,2** | Substitui gpt-5.4-mini/nano e gpt-5-mini/nano; a OpenAI passou a usar os nomes Luna/Sol/Astra [V] ([Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [changelog](https://developers.openai.com/api/docs/changelog)) |
| Google | **Gemini 3.5 Flash-Lite** | GA 21/07/2026 | $0,30 / $0,03 / $2,50 | ~4,6 | Continua o nível mais barato; o Gemini 3.8 Flash (GA 02/09/2026) é o Flash atual [V] ([changelog](https://ai.google.dev/gemini-api/docs/changelog)) |
| DeepSeek | **DeepSeek-V4.1-Flash** (`deepseek-flash`) | 10/09/2026 | $0,15–0,30 / $0,003–0,006 / $0,60–1,20; contexto 1M | ~1,3–2,5 | Versão mais nova, com o mesmo preço [V] ([updates](https://api-docs.deepseek.com/updates)) |
| Mistral | **Mistral Small 4** | março de 2026 | preço por confirmar | — | Ainda é o Small mais recente [V] ([changelog](https://docs.mistral.ai/getting-started/changelog)) |
| xAI | sem modelo pequeno; o mais barato é `grok-build-0.1` | — | $1 / $0,20 / $2 | — | Não é competitivo no preço [V] ([models](https://docs.x.ai/docs/models)) |

Locais (8 GB VRAM):
- **Gemma 4 E4B** (Apache 2.0, 4,5B efetivos / 8B no total, contexto 128K) substitui o Gemma 3 12B [V] ([card](https://huggingface.co/google/gemma-4-E4B)). Velocidade na RTX 3070 ~46–79 tok/s, mas segundo estimadores de terceiros, não medições [S]; a versão de maior precisão quase não cabe em 8 GB [S].
- **Qwen:** as famílias mais novas (Qwen3.6, Qwen3.8) não têm um tamanho novo de 4–14B que caiba em 8 GB; o **Qwen3.5-9B** continua a ser o Qwen mais recente que cabe [I, com base em V/S].
- **Llama 3.1 8B:** antigo, mas não encontrámos substituto oficial pequeno da Meta [S]. gpt-oss-20b precisa de 16 GB. Phi-4-reasoning-vision-15B (março de 2026) é demasiado grande para caber bem em 8 GB [I]. Granite 4.1 e Nemotron 3 Nano por verificar.

Candidatos revistos para a avaliação emparelhada:
1. Haiku 4.5 (referência, ~$12/mês);
2. **GPT-6 Luna** (~$1,2/mês; verificar os termos de dados da OpenAI);
3. Gemini 3.5 Flash-Lite, nível pago (~$4,6/mês);
4. DeepSeek-V4.1-Flash, só com conversas não sensíveis (~$1,3–2,5/mês);
5. Locais: **Gemma 4 E4B** e **Qwen3.5-9B** via Ollama, testados a 8k, 16k e 30k de contexto.

Lacunas: data do GPT-6 Luna (as fontes oficiais divergem); preço do Mistral; preço do cache e contexto do Gemini; não há medições reais na RTX 3070 para os modelos novos.

## Decisões do utilizador (2026-10-04)

- **Modelos locais excluídos** da Conversation: risco de sugestões erradas ou inferiores em assuntos complexos.
- **Assuntos complexos e decisões: Opus.** O utilizador não confia no Sonnet para tarefas complexas.
- **Candidatos baratos para a rotina, a averiguar:** GPT-6 Luna e DeepSeek-V4.1-Flash, com o Haiku 4.5 como referência barata e o Opus como referência forte. Antes de enviar qualquer conversa real ao DeepSeek, ler a política de privacidade primária; usar só exemplos não sensíveis ou anonimizados.
- **Script de avaliação emparelhada adiado:** fica para depois do merge do Effect e do protótipo `claude -p`. Método proposto: pedidos reais de rotina e complexos; um juiz forte compara às cegas; o utilizador avalia às cegas uma amostra pequena; medem-se também o formato estruturado válido, o português, a latência e o custo por tarefa concluída. Chaves de API só em variáveis de ambiente, nunca no Git.
