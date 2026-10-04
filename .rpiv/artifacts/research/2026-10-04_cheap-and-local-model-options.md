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
