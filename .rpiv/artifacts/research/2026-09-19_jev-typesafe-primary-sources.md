---
title: "Jev da TypeSafe AI: capacidades, utilizações públicas e hipóteses para Ragnarok"
date: 2026-09-19T19:22:46+0100
author: Pedro Mesquita
commit: 97678d2
branch: main
repository: slopstop
topic: "Jev: public uses and advisory evaluation opportunities for Ragnarok"
tags: [research, jev, typesafe-ai, conversation, evaluation]
status: complete
last_updated: 2026-09-19T23:48:49+0100
last_updated_by: Pedro Mesquita
last_updated_note: "Registadas ideias discutidas de composição de Workers e auto-melhoramento governado para avaliação futura."
requested_by: ragnarok-coordinator
research_cutoff: 2026-09-19
scope: "Fontes primárias, exemplos públicos e limites; sem aprovação de arquitetura"
method: "Pesquisa explícita com Exa; leitura de documentação oficial, políticas, repositórios e medições publicadas"
content_hash: 098591dc8a68fd6c937346ede88a866f9016ef2440500ecd424af0846f1f195b
---

# Conclusão

**Jev é um classificador probabilístico da TypeSafe AI, não um modelo que escreve texto ou código.** Foi anunciado em **15 de setembro de 2026**, em acesso antecipado. O modelo oficial atual é **`jev-1.13.0`**. Pode ser interessante para pequenas perguntas de interpretação dentro da supervisão de agentes, mas as fontes não demonstram que possa certificar entendimento, correção de código ou conclusão de trabalho. [S1–S5]

Foram verificados **quatro repositórios públicos de aplicações/demonstrações**, mais um **cookbook oficial com resultados medidos**. Não encontrei, nas fontes examinadas, um caso comprovado de adoção de Jev em produção com clientes, continuidade operacional e resultados auditados. Integrações com Pydantic AI, Vercel, LangChain e Langfuse demonstram disponibilidade ou exemplos, não essa adoção. [S12–S23]

Há duas correções importantes aos artigos de divulgação:

- **Browser Use pesquisa voos; não reserva nem compra um voo.** Os 7,073 segundos também excluem preparação do navegador, navegação inicial e verificação independente posterior. [S12–S13]
- **A aplicação pública do trader está declarada como dry-run com modelo mock.** O valor de 81 ms num exemplo de evento não comprova latência real de Jev; o benchmark do README inclui explicitamente uma espera simulada de 80 ms. [S15]

## Método e limites desta investigação

- Exa foi usado explicitamente para encontrar o anúncio, artigos de divulgação, documentação e integrações. Flavio Copes e DEV/Valyu serviram como pistas; as alegações principais foram seguidas até à fonte que as publica.
- O agente de fontes consultou `PRODUCT.md` e `CONTEXT.md` para terminologia. O coordenador acrescentou a secção 7, cruzando as hipóteses com as autoridades locais e a composição de produção. Isso é análise de adequação, não aprovação de uma nova arquitetura.
- Nenhum exemplo foi executado. Não houve chamadas de inferência Jev, criação de contas/chaves, instalação de pacotes ou alterações de Git/produto/configuração. As medições abaixo são publicadas pelos autores, não reproduzidas nesta investigação.
- A tentativa inicial do agente com `npx --no-install ctx7` falhou por indisponibilidade dessa ferramenta no cache. Depois, o coordenador executou o fluxo exigido `npx ctx7@latest library "TypeSafe AI" ...` e `docs /websites/typesafe_ai_sdk_javascript ...` no diretório temporário aprovado. Confirmou o SDK, os defaults de repetição/timeout e os riscos de logging na documentação atual. Não se instalou Jev nem qualquer SDK no projeto; não se fizeram chamadas de inferência. [S26]
- Apenas este documento é o artefacto de pesquisa autorizado. As fontes web e os ramos dos repositórios podem mudar; os commits observados estão registados abaixo.

## 1. O que está oficialmente suportado

| Aspeto | Comportamento documentado | Limite relevante |
| --- | --- | --- |
| Entrada | Texto, objetos JSON e arrays de texto em `state`; perguntas tipadas separadas. | Não recebe imagens, áudio ou vídeo. OCR/perceção ficam fora de Jev. |
| Noul | Probabilidade de uma resposta afirmativa, entre 0 e 1. | Não tem campo separado de `confidence`. Um valor perto de zero significa resposta negativa, não necessariamente incerteza. |
| Choice | Escolhe uma opção predefinida, devolve probabilidades por opção e `confidence`. Até 255 opções. | Sem uma opção como «nenhuma corresponde», pode ser forçado a escolher a menos inadequada. |
| Score | Posição numa escala ordenada com 2–10 níveis; distribuição, média ponderada dos índices dos níveis e `confidence`. | Não é uma ferramenta de interpolação numérica exata nem uma medida física. |
| Várias perguntas | Avaliadas em paralelo e isoladamente contra o mesmo estado. | Uma pergunta não recebe a resposta da outra. Perguntas dependentes podem exigir outra chamada ou composição em código. |
| Saída | Valores tipados de um espaço definido antecipadamente. | Não escreve explicações, justificações, código, mensagens ou argumentos textuais arbitrários. |

Fontes: [S2–S7]. O identificador de uma pergunta serve para correlacionar a resposta, mas não é enviado ao modelo; o significado tem de estar nas instruções/critérios. [S6–S7]

### «Não pode alucinar»: garantia estreita

O anúncio usa **“can’t hallucinate”**. Na própria secção de nuance, explica: **“Our number is not empirical. Schema matching is guaranteed”**. Portanto, a leitura defensável é **não inventar uma saída fora do esquema/espaço de respostas definido**. Não significa que a opção escolhida seja verdadeira, que o texto tenha sido compreendido corretamente ou que a entrada não consiga manipular a decisão. A página oficial de limitações admite precisamente esses problemas. [S1, S5]

### Probabilidade, confiança e calibração não são a mesma coisa

- **Probabilidade** representa a distribuição sobre respostas possíveis. **`confidence`** resume quão concentrada está essa distribuição; deriva das probabilidades e não é uma segunda avaliação independente de verdade. A página consultada não especifica a fórmula exata desse resumo. [S4]
- **Calibração** é avaliada sobre grupos de previsões: não garante a correção de uma previsão individual. Não se deve apresentar `confidence: 0.9` como «90% de certeza de que o agente cumpriu o contrato». [S3–S4]
- A documentação mostra uma pergunta sobre reembolso com Noul **0,22** e Choice «sim» **0,01**. Outra dupla, pergunta e negação, dá **0,72 + 0,47 = 1,19**. Perguntas feitas separadamente não respeitam necessariamente identidades probabilísticas esperadas. [S5]
- Não transferir limiares de Noul para Choice, nem entre versões, idiomas e formulações sem avaliação própria. Para português, a documentação diz que inglês é o idioma principal de treino e o de melhor precisão; não publica uma avaliação específica de português europeu. [S2, S5]
- Precisão de contagens, aritmética, comparação de datas, indireção, duplas negações, contexto longo irrelevante e instruções contraditórias são fragilidades reconhecidas. Conteúdo adversarial pode alterar a classificação. [S5]

## 2. Versão, custo, latência e disponibilidade

| Item | Estado observado em 2026-09-19 |
| --- | --- |
| Lançamento | Anúncio de 2026-09-15; acesso antecipado e entrada progressiva da lista de espera. [S1] |
| Versão atual | `jev-1.13.0`; `jev-latest` e `jev-preview` apontam ambos para ela. Não há preview distinto naquele momento. As respostas identificam a versão resolvida. [S2] |
| Contexto | **64k tokens por pedido**, somando estado e todas as perguntas; **32k para estado + pergunta mais longa**. Não equivale a 64k de documento. [S2] |
| Preço direto | **US$ 0,042 por milhão de tokens de entrada**; saída gratuita. Estado partilhado é ingerido uma vez; perguntas/opções adicionais consomem tokens. [S2, S6] |
| Limites publicados | **250.000 tokens/segundo; 1.200 pedidos/minuto**. São dinâmicos e podem mudar sem aviso durante a expansão de capacidade. Excesso produz 429. [S2] |
| Latência anunciada | **70–500 ms ponta a ponta**, no anúncio. É uma alegação do fornecedor, não um SLA nem p95/p99 comprovado em Portugal. [S1] |
| Ganho relativo | O anúncio compara modelos em tarefas System One e reclama vantagens de ordens de grandeza. O wrapper usado para LLMs também pede probabilidades, com custo/latência próprios. Não generalizar os multiplicadores para todo o ciclo de um agente. [S1] |
| Perguntas por pedido | Podem ser agrupadas; a documentação afirma que acrescentar perguntas pouco altera a latência. Não encontrei um teto numérico separado de quantidade de perguntas nos contratos consultados; os limites de tokens continuam a aplicar-se. [S2, S6, S8] |
| Cache | Não encontrei nestas páginas um contrato de cache de prompts entre pedidos, duração, desconto ou invalidação. Ingerir estado uma vez dentro de um pedido não prova cache entre pedidos. Os cookbooks têm `JsonCache` local para reproduzir resultados; isso também não prova cache do serviço. [S2, S8, S17–S18] |

### SDK/API: utilizáveis, mas muito recentes

Há API HTTP documentada e SDKs oficiais públicos para JavaScript/TypeScript e Python. O JavaScript publica **v0.6.0 de 15/09**, com alteração incompatível da representação de Score; Python publica **v0.7.0 de 18/09**, mudando a serialização de msgspec para Pydantic, corrigindo subclasses de string e acrescentando um modelo de resposta para validação adicional. Isto é evidência de desenvolvimento ativo e de uma superfície ainda recente, não de estabilidade prolongada. [S8–S10]

O endpoint próprio é `POST /v1/systemone`, não uma conversa generativa. A documentação tem erros de validação, autenticação e limites, e descreve repetição com espera progressiva nos SDKs. Não foram testados comportamento real de timeout/cancelamento, continuidade do serviço ou compatibilidade de um adaptador Ragnarok. [S2, S8]

**Pydantic AI** tem documentação oficial de integração que mapeia campos de saída para perguntas Jev. Os resultados de streaming chegam numa peça única, sem tokens parciais. A integração também pode selecionar ferramentas e delegar a um LLM quando são necessários argumentos; isso não transforma Jev num gerador de argumentos. Essa lógica é uma capacidade da integração, não uma decisão recomendada para Ragnarok. [S20]

**Vercel AI Gateway** publica disponibilidade e preço equivalente. O guia aponta para AI SDK **7.0.105+** e uma API de avaliação ainda **experimental**. Usa Boolean onde a API direta usa Noul e transporta confiança separadamente em metadados. Logo, os formatos não são intercambiáveis sem adaptação. O guia refere 32.000 tokens, enquanto o catálogo mostra «Not applicable» e TypeSafe documenta o limite composto 64k/32k: usar o contrato específico do percurso, não inferir equivalência. [S2, S21]

Estas integrações são **suporte de plataforma**, não exemplos de empresas a usar Jev em produção.

## 3. Utilizações públicas concretas e maturidade

### A. Browser Use — agente de navegação

**Fonte primária:** [repositório](https://github.com/browser-use/jev-ultrafast), [relatório de desempenho](https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/docs/performance.md), [código que chama Jev](https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/model.py). [S12–S13]

Transforma elementos da página em opções numeradas. Jev escolhe operação e alvo numa chamada; Mercury gera texto quando necessário. O exemplo verifica uma pesquisa Zürich–London em Google Flights, **não faz uma reserva**.

Medição publicada: **7,073 s**, **17 pedidos Jev**, mediana de **178 ms** por pedido e dois pedidos ao modelo de texto. A medição começa depois da observação inicial; exclui preparação, navegação inicial e verificação independente final. Comparação de duas versões do runtime: três tentativas por versão, ambas 3/3, mediana 9,450 → 7,092 s. O autor reconhece a amostra demasiado pequena para generalização.

Os 90.558 tokens Jev, ao preço de tabela, mais US$ 0,00006272 do modelo de texto dão **aproximadamente US$ 0,003866**, cálculo a partir dos dados publicados, não fatura total comprovada. Custos de navegador ficam fora.

**Maturidade:** MVP público com código, vídeo e medições delimitadas. Não cobre, entre outros, frames, shadow roots, canvas, uploads e widgets arbitrários. Um `DONE` ainda exige verificação independente. A melhoria medida é do runtime usando o mesmo Jev, não um ensaio Jev versus outro modelo.

### B. Andrew Levin — utilização de computador em macOS

**Fonte primária:** [awlevin/typesafe-computer-use](https://github.com/awlevin/typesafe-computer-use). [S14]

Lê ecrã por OCR e árvore de acessibilidade; Jev seleciona a ação sobre elementos identificados; outro modelo escreve texto. O README atual já inclui controlos de acessibilidade fora da área visível, pelo que «só OCR» é uma descrição incompleta.

O autor publica cerca de **US$ 0,0002 por decisão** e **0,13–0,38 s de latência do modelo**, comparando com computer use baseado num modelo maior. São números do autor; não foi verificada uma avaliação independente com tarefas equivalentes. Há execução de um passo sem agir, limites de passos e registos de resultados como baixa confiança, bloqueio, aborto e falha.

**Maturidade:** ferramenta/demonstração pública específica de macOS. Não comprova disponibilidade equivalente em Windows, taxa geral de conclusão nem segurança de todas as ações.

### C. Jarrod Watts — trader de demonstração

**Fonte primária:** [jarrodwatts/jev-trader](https://github.com/jarrodwatts/jev-trader). [S15]

Projeto para decisões buy/sell sobre o livro MON–USDC de Kuru a cada bloco Monad, aproximadamente 300 ms; tem implementação para ordens reais e limites de posição. **O padrão é um modelo mock**; sem chave privada simula preenchimentos com dados reais do livro. O README identifica expressamente o deployment público como **dry-run, mock model**.

O evento ilustrativo de 81 ms não é uma distribuição de medições de Jev. O benchmark documentado do ciclo refere mock e 80 ms de espera simulada.

**Maturidade:** código de demonstração com caminho de integração Jev, não prova de trader Jev a operar capital real, rentabilidade ou inferência sustentada em 300 ms. Este exemplo conta como implementação pública, não como execução real de Jev demonstrada pelas métricas citadas.

### D. Roman Slack — drone simulado

**Fonte primária:** [RomanSlack/jev-drone](https://github.com/RomanSlack/jev-drone), [tactics.py](https://github.com/RomanSlack/jev-drone/blob/cbeb53ce4f17a06ea490ae43effcdad231143610/tactics.py). [S16]

É uma simulação **MuJoCo**, não um drone físico comprovado. Perceção clássica transforma profundidade/segmentação em estado simbólico; Jev responde a Choice de manobra, Score de risco e Noul de alvo perdido. Código mantém controlo a 500 Hz e reflexos de segurança a 50 Hz; a camada Jev é consultiva, aproximadamente 2,5 Hz.

O autor reporta **80 chamadas em 65 s**, mediana **0,11 s**, 96k tokens e alvo visível 19% → 82%. Admite que a coluna Jev é **um único ensaio de 65 s**, não uma comparação com as mesmas sementes. A frequência nominal da camada não significa 2,5 chamadas em cada segundo do ensaio.

**Maturidade:** experiência pública com medições e ressalvas. Demonstra separação entre interpretação e controlo; não prova segurança de voo físico nem superioridade universal.

### E. TypeSafe — reordenação de resultados de pesquisa jurídica

**Fonte primária:** [cookbook oficial de re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe.md). [S17]

Implementação publicada sobre **3.565 passagens CLERC e 40 consultas**. BM25 prepara 30 candidatos por consulta; Jev avalia pares consulta/passagem. O autor reporta top-1 **5% → 18%** e top-10 **38% → 62%**.

**Maturidade:** cookbook medido do fornecedor, com cache para reprodução; não produto em produção nem confirmação de adoção jurídica. As listas candidatas deste ensaio já contêm a passagem correta em 100% dos casos. O top-1 final continua baixo; estes números apoiam priorização, não validação automática da resposta.

**Contagem honesta:** quatro repositórios de aplicações, dos quais um publica deployment mock; um quinto exemplo concreto é cookbook oficial. Não foram verificados cinco deployments de Jev em produção, nem cinco aplicações independentes com medições reais de Jev.

### Outros sinais úteis, sem os promover a adoção

- **Skill suggestion oficial:** compara um catálogo de 182 skills Hermes, faz uma primeira classificação e depois examina as três melhores, podendo rejeitar todas. É um cookbook sobre esse catálogo, não prova de integração adotada pelo projeto Hermes. [S18]
- **Langfuse, 18/09:** tutorial primário para avaliar a reação do utilizador à resposta anterior e escrever scores de discordância. Define cuidadosamente «perceção expressa de erro» em vez de «erro objetivo do agente». É particularmente relevante para entendimento mútuo, mas continua a ser um exemplo publicado. [S22]
- **LangChain, 17/09:** integração e exemplos de seleção de modelo/supervisão; não são um estudo de produção. [S23]
- **Flavio Copes:** as utilizações no seu formulário de patrocínio são formuladas como «I’d put…», propostas futuras, não funcionalidades implementadas. [S24]

## 4. Dados, retenção e alojamento

**Não usar dados para treino não significa não os guardar.** A página Models diz que pedidos e respostas de clientes não são usados para treino; a política de privacidade compromete-se a não treinar nem ajustar modelos sobre Input. [S2, S11]

- A política permite recolher prompts, dados e instruções; serviços são alojados nos **Estados Unidos**. Prevê prestadores de serviço e transferências internacionais. [S11]
- A política e o DPA dizem retenção durante o tempo razoavelmente/estritamente necessário para as finalidades descritas, obrigações legais e comerciais. **Não encontrei um prazo numérico geral de eliminação de pedidos**. [S11]
- A documentação direta oferece **zero data retention para enterprise**, mediante contacto. Não se deve presumir que uma conta normal tem ZDR. [S11]
- Vercel documenta ZDR e No Training **por pedido** para este percurso. Isso não elimina automaticamente logs e outros registos do gateway/aplicação; a mesma página refere observabilidade de chamadas. É necessário distinguir os compromissos dos intervenientes. [S21]
- **Self-hosting / pesos:** não encontrei distribuição oficial de pesos Jev, licença de pesos ou instruções suportadas de alojamento local nas fontes oficiais examinadas. Os SDKs públicos não são o modelo. Não afirmar que self-host é impossível comercialmente; disponibilidade privada/on-prem permanece por confirmar.
- **Personalização:** Models afirma que Jev não recebe fine-tuning/LoRA por cliente; pesos são partilhados. Personalização passa por estado, critérios/perguntas ou um modelo clássico posterior. [S2]

## 5. Hipóteses priorizadas para Ragnarok

São hipóteses de pesquisa apoiadas nos padrões publicados, **não decisões de arquitetura ou autorização de implementação**.

| Prioridade | Hipótese limitada | Apoio e utilidade | O que não fica provado |
| --- | --- | --- | --- |
| 1 | Sinalizar que o utilizador está a corrigir ou rejeitar uma interpretação na Conversation. | O exemplo Langfuse já formula este julgamento sobre a mensagem e a resposta anterior. Poderia ajudar a chamar atenção para uma reparação de entendimento. [S22] | Discordância não prova erro objetivo; ausência de discordância não é aceitação. Validar ironia, negações e português europeu. |
| 2 | Identificar qual expectativa concreta de Frame ainda precisa de esclarecimento. | Perguntas atómicas, critérios explícitos e estados curtos são o padrão oficial. Ex.: «este exemplo diz o que deve acontecer quando há falha?» [S3–S5] | Jev não gera a pergunta seguinte nem certifica completude do entendimento; o comportamento literal pode falhar precisamente onde a intenção é implícita. |
| 3 | Reordenar candidatos de contexto e assinalar citações que merecem inspeção. | Há cookbooks de re-ranking, filtragem de passagens e verificação de citações. [S17, S19] | Uma classificação não cria Evidence válida, Verified Memory ou garantia contra instruções maliciosas. Relevância não equivale a verdade. |
| 4 | Propor uma skill pertinente para um Worker a partir de um catálogo limitado. | Cookbook de 182 skills, seleção relativa seguida de verificações absolutas e possibilidade de não escolher nenhuma. [S18] | Não demonstra permissão para executar, adequação ao ambiente ou aplicação obrigatória da skill. |
| 5 | Classificar indícios semânticos de que um resumo de Worker merece revisão humana. | Padrões oficiais de confiança e tutorial de avaliação de agentes. [S4, S22–S23] | Não substitui resultados de testes, falhas determinísticas, decisões de Evidence, aceitação de Candidate ou autorização de conclusão. |

**Melhor primeiro candidato a avaliação:** deteção de correção/discordância, porque tem um precedente primário concreto e pode ser avaliada sem entregar decisões de execução ao modelo. O segundo candidato é priorização de contexto. Não começar por «aprovar a implementação», «provar entendimento mútuo» ou «detetar todas as falhas»: excedem a evidência disponível.

Antes de decidir utilidade, faltam exemplos locais rotulados, falsos positivos/negativos por caso e idioma, comparação com regras simples, latências completas a partir da localização do utilizador e condições de privacidade do percurso escolhido. Também faltam provas de calibração transferível para supervisão de código. Nenhum desses resultados foi inventado nesta pesquisa.

## 6. Registo de fontes

Todas consultadas em **2026-09-19**. «Primária» significa que a fonte é responsável pelo produto, código, experiência ou integração descrita; não significa verificação independente das suas alegações.

| ID | Fonte e URL exato | Natureza / utilização |
| --- | --- | --- |
| S1 | https://typesafe.ai/blog/introducing-system-one-models-and-jev | TypeSafe, anúncio de 15/09; marketing, benchmarks e nuance do esquema. |
| S2 | https://docs.typesafe.ai/models.md | TypeSafe, versão, preço, limites, idioma, personalização. |
| S3 | https://docs.typesafe.ai/concepts/system-one.md | TypeSafe, comportamento e significado limitado de calibração. |
| S4 | https://docs.typesafe.ai/confidence.md | TypeSafe, confiança derivada e limiares. |
| S5 | https://docs.typesafe.ai/model-jaggedness/jev-1.13.md | TypeSafe, limitações; revisto em 17/09. |
| S6 | https://docs.typesafe.ai/primitives/choice.md | TypeSafe, opções, identificadores e custo de perguntas. |
| S7 | https://docs.typesafe.ai/primitives/score.md | TypeSafe, níveis e média ponderada. |
| S8 | https://docs.typesafe.ai/api.md ; https://docs.typesafe.ai/introduction.md ; https://docs.typesafe.ai/patterns/fan-out.md | TypeSafe, contrato HTTP e paralelismo. |
| S9 | https://docs.typesafe.ai/sdk/javascript.md ; https://docs.typesafe.ai/sdk/javascript/changelog.md ; https://github.com/typesafe-ai/typesafe-sdk-js | SDK oficial JavaScript, v0.6.0. |
| S10 | https://docs.typesafe.ai/sdk/python.md ; https://docs.typesafe.ai/sdk/python/changelog.md ; https://github.com/typesafe-ai/typesafe-sdk-python | SDK oficial Python, v0.7.0. |
| S11 | https://docs.typesafe.ai/legal.md ; https://typesafe.ai/legal/data-processing ; https://typesafe.ai/legal/privacy-policy | Políticas primárias; DPA de 24/04/2026, privacidade de 19/11/2025. |
| S12 | https://github.com/browser-use/jev-ultrafast | Repositório primário e README; pesquisa, não reserva. |
| S13 | https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/docs/performance.md ; https://github.com/browser-use/jev-ultrafast/blob/1231850a0bf1a0c0341fe408ef1668dbbfdfac46/jev_ultrafast/model.py | Relatório e implementação do autor; limites das medições. |
| S14 | https://github.com/awlevin/typesafe-computer-use | Repositório primário, README e números do autor. |
| S15 | https://github.com/jarrodwatts/jev-trader | Repositório primário; mock, simulação e caminho de ordens reais. |
| S16 | https://github.com/RomanSlack/jev-drone ; https://github.com/RomanSlack/jev-drone/blob/cbeb53ce4f17a06ea490ae43effcdad231143610/tactics.py | Repositório primário, medições de simulação e integração. |
| S17 | https://docs.typesafe.ai/cookbooks/rerank_typesafe.md | Cookbook medido do fornecedor; não adoção em produção. |
| S18 | https://docs.typesafe.ai/cookbooks/skill_suggestion.md | Cookbook do fornecedor sobre catálogo Hermes; não integração upstream comprovada. |
| S19 | https://docs.typesafe.ai/llms.txt | Índice oficial: classifying_rag_passages e citation_check; usado para localizar e confirmar o propósito desses exemplos, sem reproduzir medições. |
| S20 | https://pydantic.dev/docs/ai/models/typesafe/ ; https://pydantic.dev/docs/ai/api/models/typesafe/ | Documentação primária da integração Pydantic AI. |
| S21 | https://vercel.com/changelog/typesafe-ai-jev-now-available-on-ai-gateway ; https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk ; https://vercel.com/ai-gateway/models/jev | Documentação primária Vercel, API experimental e condições do percurso. |
| S22 | https://langfuse.com/blog/2026-09-18-using-typesafes-jev-for-evals | Tutorial primário de avaliações/discordância, não estudo de adoção. |
| S23 | https://www.langchain.com/blog/building-a-harness-with-jev | Integração e exemplos primários, 17/09. |
| S24 | https://flaviocopes.com/jev/ | Fonte secundária técnica e propostas pessoais futuras; descoberta de pistas. |
| S25 | https://dev.to/valyuai/how-to-use-jev-a-practical-guide-to-typesafes-system-one-model-g5e | Fonte secundária de 17/09; pistas corrigidas contra os repositórios. |
| S26 | https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig ; https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy ; https://docs.typesafe.ai/sdk/javascript/api/interfaces/RequestOptions | Referência oficial obtida por Context7: retries2 por defeito, timeout por tentativa sem orçamento total, logger debug com corpos não redigidos. |

### Commits observados nos repositórios

Consulta pública de metadados GitHub, sem clone nem alterações locais. Os README foram lidos no ramo público atual; estes eram os HEAD observados na mesma sessão.

| Repositório | HEAD observado |
| --- | --- |
| browser-use/jev-ultrafast | `1231850a0bf1a0c0341fe408ef1668dbbfdfac46` |
| awlevin/typesafe-computer-use | `cc7b5066ae1a07b5e3182e8f87a9b5b6dfdcffc1` |
| jarrodwatts/jev-trader | `b587759e459ea049590102e54a0b07800864cdc3` |
| RomanSlack/jev-drone | `cbeb53ce4f17a06ea490ae43effcdad231143610` |
| typesafe-ai/typesafe-sdk-js | `66880ccded6cb642dc1809620c2b108c33730214` |
| typesafe-ai/typesafe-sdk-python | `2ce5c65f13646cab6e6f782328194c9d85f3300a` |

## 7. Como poderia entrar no Ragnarok

### Recomendação principal: detetor auxiliar de reparação de entendimento

O primeiro uso recomendado é **assinalar uma provável correção ou rejeição da interpretação do assistente**. É mais estreito e verificável do que prometer «detetar todo o desalinhamento». O precedente Langfuse [S22] avalia precisamente a perceção expressa pelo utilizador, sem a confundir com erro objetivo. O coordenador confirmou diretamente esse cuidado na fonte.

Exemplo hipotético: o assistente propõe sincronização online e o utilizador responde «Eu tinha dito que isto era só local». Jev pode sinalizar que esta resposta corrige uma restrição. O modelo generativo pode então explicar o que vai rever e pedir confirmação. Nem Jev nem esse texto alteram por si uma decisão aceite ou autorizam implementação.

Um conjunto inicial de perguntas independentes poderia distinguir correção, pedido de explicação, alteração de objetivo e seguimento neutro, sempre com «outra/indeterminada». Perguntas como «o utilizador percebeu tudo?» ou «posso executar?» são inadequadas: a intenção privada não é diretamente observável e autorização pertence ao produto e à pessoa. Um «ok» isolado não deve tornar-se aceitação canónica por ultrapassar um limiar probabilístico.

### Percurso proposto, ainda não implementado

1. Conversation prepara um excerto autorizado: mensagem atual, resposta anterior e, quando necessário, o resumo/revisão exatos a que se referem. Não envia automaticamente o repositório, o histórico inteiro, logs de ferramentas ou dados privados.
2. Uma ligação ao fornecedor, propriedade do harness, faz uma avaliação delimitada com perguntas/critério/versionamento explícitos. Agrupa apenas perguntas realmente independentes sobre esse mesmo excerto.
3. O resultado é um **sinal consultivo**, associado às identidades/revisões de entrada e à versão concreta do modelo. Se o utilizador já alterou o conteúdo, o sinal antigo fica desatualizado e não orienta a resposta atual.
4. A interface/modelo principal pode propor «vamos rever esta interpretação». Jev não escreve a explicação; ela vem de texto determinístico ou do modelo generativo, com o contexto correspondente.
5. O utilizador corrige/revê; os comandos e responsáveis existentes continuam a decidir a aceitação formal. Uma falha, timeout ou resposta inválida de Jev fica indisponível/quebrada, nunca «não há problema».

O fluxo normal sem esta avaliação auxiliar deve continuar utilizável. Escolher uma capacidade opcional não permite esconder uma falha como uma avaliação favorável. A futura decisão de produto deve definir onde mostrar a indisponibilidade sem acrescentar uma interrupção por cada avaliação auxiliar.

### Outros usos, por ordem de interesse

| Uso | Papel possível | Fronteira a preservar |
| --- | --- | --- |
| Pedido versus proposta de Frame | Assinalar pares pequenos de expectativa/proposta que parecem contradizer-se ou omitir um caso relevante. | Não certifica completude nem substitui as perguntas concretas de entendimento. O modelo principal precisa de produzir a explicação verificável. |
| Seleção de contexto | Reordenar uma lista já delimitada de passagens, decisões ou memórias elegíveis. | Código valida primeiro permissões, frescura e Evidence obrigatória. Jev só ordena candidatos; não transforma memória desatualizada em confiável. |
| Catálogo de skills | Sugerir qual de um conjunto autorizado parece pertinente, permitindo não escolher nenhuma. | Pertinência não concede Capability, execução ou alteração do plano. |
| Supervisão de agentes | Sinalizar repetição semântica, desvio do pedido ou um resumo que parece precisar de revisão. | Tempos, processos, saídas dos testes e estados são lidos deterministicamente; o sinal não pausa, conclui ou aprova um Run. |
| Escolha de modelos | Poderia recomendar o nível de capacidade adequado a uma tarefa. | Prioridade menor: fallback automático e mudanças silenciosas de modelo são proibidos. Não copiar sem adaptação os exemplos de cascata das bibliotecas. |

### Enquadramento nas autoridades atuais

| Autoridade local | Consequência para Jev |
| --- | --- |
| `PRODUCT.md:53-63` | Conversation/Frame já exigem interpretação inspecionável, correções e aceitação explícita. O sinal de Jev pode ajudar essa experiência sem ganhar autoridade canónica. |
| `PRODUCT.md:46` | Attention tem conteúdo e ordenação definidos. Não usar Jev para esconder falhas críticas ou alterar silenciosamente a ordem aprovada; começar com sinais auxiliares na conversa. |
| `PRODUCT.md:61,69` e `AGENTS.md` Safety And Privacy | Tornar visível que TypeSafe recebe os excertos; obter a autorização adequada e proteger a chave fora do renderer/configuração do repositório. Local-first não significa que uma chamada cloud seja local. |
| `docs/adr/0009-provider-neutral-agent-runtime-and-turn-contracts.md:17-28,37-43` | Fornecedores emitem observações/propostas; coordenador e Execution mantêm autoridade. Chamadas durante Runs precisam de admissão, orçamento, atribuição e recuperação. Context record de Conversation não é Invocation context record de Execution. |
| `docs/adr/0017-evidence-to-memory-invalidation-and-trusted-read-authority.md:19-20,47-48` | Confiança de Memory vem das dependências exatas de Evidence. Um score Jev não substitui esses vínculos nem aceita/invalida uma Memory Revision. |
| `PRODUCT.md:112,118,124` | Jev não cria um veredito universal de Evidence, não resolve Findings e não autoriza Completion/Integration. Falha nunca degrada para limpo; modelo não muda automaticamente. |
| `apps/harness/src/process-bootstrap.ts:97,113` em main `97678d2` | Ainda não há comandos de domínio de produto nessa composição nem produtores reais de Conversation/Frame/Memory. PC-S1 continua separado na worktree; esta pesquisa não identifica uma integração Jev já existente. |

Uma avaliação não generativa de Conversation precisa de um contrato próprio para pedido, contexto, resultado e custos; não deve fabricar uma resposta de assistente para reutilizar um registo que exige `responseMessageId`. Para Execution, uma futura interface de avaliação tem de respeitar as autoridades do Run; não basta chamar o SDK por fora do runtime e esconder o custo. A escolha concreta de interfaces pertence ao futuro desenho, não a esta pesquisa.

### Integração técnica que merece avaliação, não implementação agora

O SDK direto `@typesafe-ai/sdk` ou HTTP direto atrás de uma interface nossa parecem caminhos mais estreitos do que introduzir outro framework só para classificar. Se futuramente já existir uma dependência compatível do AI SDK, comparar a sua API experimental com o percurso direto; a existência de integrações não justifica trocar a decisão Mastra nem copiar ferramentas/fallbacks automáticos de outro framework.

A referência oficial do SDK confirma defaults importantes: `jev-latest`, **2 retries automáticos**, timeout de **10.000 ms por tentativa sem orçamento total**, e logging `debug` que inclui corpos **não redigidos**. [S26] Para um futuro adaptador Ragnarok, propor versão concreta fixada, retries desativados no SDK e geridos pela autoridade apropriada, orçamento total explícito, validação própria da resposta e logger que nunca recebe corpos sensíveis. Uma repetição após timeout não pode esconder outro pedido/custo. Estas escolhas ainda precisam de contrato e testes.

Também não confundir Choice `confidence` com Noul: um Noul perto de zero pode ser uma negação confiante. Tipar cada família de resposta e calibrar o uso pretendido evita um único «confidence > X» aplicado indevidamente a todas as saídas.

## 8. Primeiro ensaio recomendado

**Escolha: deteção de correções na Conversation, inicialmente em avaliação silenciosa.** Silenciosa significa não orientar a experiência durante o ensaio; continua a ser uma chamada externa que só pode ocorrer depois de autorizar dados, fornecedor e custo.

- Preparar exemplos curtos anonimizados ou sintéticos em português europeu: correção clara, pergunta neutra, mudança de objetivo, frustração sobre o produto, ironia, negação e «ok/continua» ambíguos. Incluir casos em que o assistente estava certo mas o utilizador discordou.
- Rotular o que é observável: «expressa correção», «não expressa correção» e «contexto insuficiente». Não rotular «entendimento mútuo garantido» como se fosse acessível ao modelo.
- Comparar regras simples, comportamento do modelo principal sem Jev e Jev no mesmo conjunto. Separar calibração de limiares e avaliação final para não ajustar tudo aos mesmos exemplos.
- Medir falsos alarmes, correções perdidas, abstenções, custo total e latência ponta a ponta. Avaliar português europeu diretamente; não traduzir implicitamente a conversa para inglês e chamar isso desempenho no idioma original.
- Só passar para sugestões visíveis se acrescentar deteções úteis e reduzir mal-entendidos sem aumentar perguntas redundantes. Antes de produção, fixar tratamento de erros, dados/retensão e versão/critério, e repetir a avaliação após mudanças materiais.

**Momento no roadmap:** depois de PC-S1 e da Conversation persistente, junto da primeira integração real de modelo/Frame. Agora podemos preparar os exemplos e o critério; instalar Jev no produto ou atribuir-lhe autoridade atrasaria a fatia atual sem prova de benefício. Não foram feitos benchmarks próprios, chamadas pagas ou alterações ao plano aprovado nesta investigação.

## Follow-up Research 2026-09-19T23:48:49+0100 — Ideias para implementações futuras

### Contexto e estatuto

O utilizador sugeriu classificar pedidos com Jev para ajudar a escolher os Workers e as suas tarefas. Depois perguntou pelo papel de Jev no auto-melhoramento, explicitamente fora de v1 e possivelmente em v2. Após discutir as possibilidades e os limites, pediu: «regista isto que falamos sobre o jev para implementacoes futuras».

Este registo preserva **direções a explorar**, não uma decisão de integrar Jev, uma arquitetura aprovada ou uma promessa de entrega em v2. O primeiro ensaio recomendado na secção 8 continua distinto destas hipóteses. Quando uma ideia for escolhida, segue investigação atualizada e desenho/contrato RPIV próprios; não altera PC-S1 ou a ordem já aprovada do trabalho.

### JEV-F01 — Triagem de pedidos e composição de equipas de Workers

**Objetivo:** ajudar a preparar uma Delegation plan adequada, evitando tanto falta de competências como Workers desnecessários.

Percurso proposto:

1. Jev recebe o pedido e um conjunto delimitado de factos pertinentes: estado do trabalho, contexto autorizado, restrições, investigação já disponível e catálogo elegível de competências/tarefas.
2. Classifica aspetos como investigação/implementação/correção/validação, clareza do objetivo, competências possivelmente necessárias e pré-requisitos por esclarecer. Mantém «outra/indeterminada» e a possibilidade de não sugerir delegação.
3. O Waypoint parent ou responsável apropriado usa esses sinais para **propor** Workers, objetivos concretos, limites, dependências, critérios de conclusão e paralelismo. Jev pode selecionar opções ou modelos de tarefa já definidos; não escreve sozinho um plano arbitrário nem os seus argumentos textuais.
4. O utilizador revê a proposta no ponto de aprovação definido. Só o coordenador determinístico cria/despacha os Workers autorizados sob o plano e a política aplicáveis.

Exemplo discutido: perante «corrige a duplicação de mensagens depois de reiniciar», os sinais podem sugerir persistência, reprodução e validação independente. Um plano poderia ter Investigador, Implementador e Validador, mas o Investigador pode ser desnecessário se já houver reprodução e causa confirmadas. Classificar apenas o prompt, ignorando o estado atual, pode desperdiçar trabalho.

**Duas variantes a comparar:** triagem antes da geração do plano; avaliação de um plano já proposto para sinalizar competências ausentes, decomposição fraca ou delegação excessiva. Podem ser complementares, mas não se presume que duas chamadas tragam mais valor do que uma ou do que nenhuma.

**Limites a preservar:** categoria não é tarefa completa; confiança não é autorização; mais Workers não significa melhor resultado. Não introduzir um pipeline obrigatório para todos os pedidos. Alterações de plano, modelo, permissões ou orçamento continuam nos responsáveis e aprovações existentes. Uma previsão Jev não cria uma Task DAG, não atribui uma tarefa canónica e não executa ferramentas.

**Gatilho para refinar:** quando a preparação/aprovação de Runs e o catálogo de capacidades tiverem contratos concretos, comparar estes usos com planeamento sem Jev. Medir clareza percebida pelo utilizador, qualidade da divisão, dependências falhadas, trabalho redundante, custo e resultados reais; não usar apenas o número de Workers como sucesso.

### JEV-F02 — Auto-melhoramento governado da harness

**Horizonte:** fora de v1; candidato a exploração em v2 ou posterior. Melhorar o comportamento do Ragnarok não significa treinar os pesos de Jev.

**Papel de Jev:** classificar episódios e contribuir para avaliar propostas. Um modelo generativo formula as alterações; factos, métricas, decisões e promoção não ficam sob autoridade de Jev.

| Etapa | Responsabilidade | Papel possível de Jev |
| --- | --- | --- |
| Observar | Registar pedido, plano, intervenções humanas, tentativas e resultados reais com identidade/proveniência. | Sem papel obrigatório; não inventa factos de execução. |
| Classificar | Distinguir sinais de mal-entendido, contexto insuficiente, tarefas mal delimitadas ou validação inadequada. | Sugere categorias sobre episódios curtos, incluindo «não é possível determinar»; uma categoria não prova causalidade. |
| Encontrar padrões | Agregar frequência, custo, tempo e consequências através de código. | Ajuda a agrupar significados, não faz a aritmética nem substitui resultados verificáveis. |
| Propor | Um modelo generativo prepara uma alteração pequena, explícita e versionada. | Pode ajudar a priorizar hipóteses, sem reescrever a configuração em uso. |
| Comparar | Executar versões atual/proposta em casos reservados para avaliação, com testes e apreciação independente/humana. | É um avaliador semântico auxiliar, não o único juiz de sucesso. |
| Adotar ou rejeitar | Rever melhorias e regressões, aprovar uma versão e preservar a possibilidade de voltar atrás. | Não promove a própria proposta nem expande permissões automaticamente. |

Exemplo discutido: episódios sugerem que certos pedidos de correção entram em implementação antes de haver uma reprodução clara. Isso pode justificar investigar uma regra condicional de preparação: propor primeiro uma tarefa curta de reprodução quando ela falta. Comparar se reduz alterações inúteis e correções de entendimento, se mantém a correção do resultado e se o custo compensa; verificar também que não piora casos simples com causa já conhecida.

**Começar por superfícies delimitadas e reversíveis:** instruções dos Workers; preparação/seleção de contexto; composição da equipa e dependências; pontos de esclarecimento com o utilizador. Alterar o próprio código/distribuição da harness fica para um passo posterior, não é o primeiro mecanismo de aprendizagem.

**Proteção contra melhoria aparente:** o mesmo avaliador não deve inventar o critério de sucesso e ser o único a confirmar que foi atingido. Menos correções humanas pode significar entendimento melhor ou desistência; menos Workers pode reduzir custo e piorar validação. Combinar feedback explícito, resultados reais, casos não usados para formular a melhoria e regressões de casos antes bem-sucedidos. Fixar versões do modelo, critérios e ambiente na comparação; não mover os critérios para fazer o candidato parecer melhor.

**Forma desejada de apresentação:** «detetámos este padrão; propomos esta mudança; esta é a comparação com o comportamento anterior». A harness não muda silenciosamente de comportamento. Propostas e versões anteriores ficam inspecionáveis, alterações são reversíveis e a pessoa mantém a decisão final de promoção. A aceitação de preferências/decisões também não cria Verified Memory automaticamente.

**Precedente local:** `.rpiv/artifacts/solutions/2026-08-31_20-24-41_self-evolving-harness-and-developer-leverage.md:53-55,131,251-281` já exige propostas imutáveis, identidades exatas, avaliação em casos reservados, regressões explícitas, aprovação humana e reversibilidade; mantém a auto-evolução para depois de execução/prova/recuperação confiáveis. Jev seria um componente possível desse ciclo, não substitui essas condições.

**Gatilho para refinar:** existir execução normal confiável, episódios atribuídos, avaliações independentes e controlo de versões/recuperação suficientes para comparar mudanças. Antes de qualquer ensaio cloud, aprovar dados, fornecedor e custo. Não se fizeram experiências de auto-melhoramento ou inferência Jev neste registo.
