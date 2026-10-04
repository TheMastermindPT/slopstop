---
date: 2026-10-04
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: proposal
tags: [effect, sql, storage, registration, decision-input]
---

# Código SQL do Storage e do registo em Effect: prós e contras

Documento de decisão para o utilizador. Não altera a decisão SQL aprovada em `evidence/2026-10-03_effect-sql-owner-decision.md`: libSQL e worker dedicado como fronteira nativa; o ciclo de vida do worker passa para Effect (feito); o Drizzle mantém-se para o esquema; o Effect SQL não foi adotado, nem no harness nem dentro do worker.

## O que está hoje em Promises

Cerca de 25 módulos do harness executam SQL (Storage, registo, repositório e ledger canónicos, recuperação do writer), com cerca de 9 mil linhas nos ficheiros principais. A coordenação à volta deles já é Effect; os corpos das operações (consultas, transações, classificação de erros) continuam `async/await`, e a ponte de Promises do serviço do application.db existe por causa deles.

## Três caminhos possíveis

| | 1. Manter como está | 2. Effect sobre o worker atual | 3. Adotar o Effect SQL |
| --- | --- | --- | --- |
| O que é | Corpos SQL em Promises, coordenação em Effect (estado atual) | Reescrever os corpos SQL como programas Effect, a falar com o **mesmo worker** (sem biblioteca nova) | Trocar o cliente pelo `@effect/sql` com driver libSQL |
| Decisão SQL atual | Compatível | Compatível (o worker continua a ser a fronteira) | **Contraria** a decisão aprovada |
| Risco técnico | Nenhum novo | Médio-alto: mexe no writer, no commit incerto e na reconciliação | Alto: a experiência viu EBUSY no Windows (ficheiros presos depois de fechar) |

O caminho 3 fica de fora salvo nova decisão, porque a experiência de 03/10 mostrou ficheiros presos no Windows com clientes diretos e com o Effect SQL, que o worker atual não tem. A comparação real é entre **1 e 2**.

## Prós do caminho 2

1. **Um só estilo de código.** Desaparecem a ponte de Promises do application.db e as chamadas avulsas ao Effect. Agentes que escrevem código geram código melhor quando o projeto é coerente.
2. **Erros tipados.** As distinções que hoje dependem de classes de exceção e `instanceof` (`broken` vs `pending-recovery` vs `unavailable`) passam para o tipo da função: o compilador avisa quando um caso fica por tratar. Reforça a regra permanente *degrade-distinguishes-broken*.
3. **Recursos garantidamente fechados.** Clientes e transações como recursos com "abrir/usar/fechar" garantido pelo Effect. Os defeitos de hoje (lease que não era libertada, cliente que contava como "visto" cedo demais) são exatamente desta família.
4. **Testes mais simples.** Trocar o worker por um duplo de teste através de Layers, sem fixtures manuais.

## Contras do caminho 2

1. **Tamanho e risco.** São ~25 módulos na zona mais sensível: exclusividade do writer, commit incerto e reconciliação. Os 517 testes de reconciliação protegem, mas uma regressão aqui custa caro.
2. **Armadilha de semântica.** A decisão aprovada avisa: interromper um Effect não prova que o trabalho nativo terminou. A reescrita tem de manter o fecho limitado, o commit incerto e o "precisa de recuperação", sem se apoiar na interrupção do Effect para isso.
3. **Custo de oportunidade.** Atrasa o PC-S1 e a Conversation, que são a prioridade da tese (o Ragnarok a ser usado).
4. **Desempenho e depuração.** Hoje já se viu custo de arranque do Effect nos workers; mais Effect no caminho quente pede medição. Os stack traces ficam menos diretos.
5. **O ganho é interno.** O utilizador do produto não nota diferença; o código atual funciona e está testado.

## Estimativa honesta

A migração até aqui foi muito mais rápida do que estimado (passos de 7 a 35 minutos em vez de sessões inteiras), mas este é o código mais delicado. Ordem de grandeza: **meio dia a dois dias de trabalho do implementador**, com incerteza alta, mais revisão.

## Recomendação do coordenador

- **Agora não.** Primeiro o push, o PC-S1 e a Conversation.
- **Código SQL novo nasce em Effect** (por exemplo, a persistência da Conversation), escrito sobre o worker atual. Assim a parte nova já fica coerente.
- **O código SQL existente** migra numa passagem dedicada e limitada, mais tarde, módulo a módulo, com medição de desempenho antes e depois.
- **Riscos a aceitar com esta recomendação:** dois estilos de SQL durante algum tempo, que contraria parcialmente a preferência "sem camadas legacy" (o estado misto continua temporário e com fim marcado).
- **Nunca o caminho 3** sem resolver primeiro o problema dos ficheiros presos no Windows.

## Perguntas para o utilizador

1. Concordas com "agora não, código novo em Effect, o existente numa passagem dedicada mais tarde"?
2. Ou preferes fazer já o caminho 2, antes do PC-S1, para fechar de vez os dois estilos?

## Decisão do utilizador (2026-10-04)

- **Agora não.** Concorda com a recomendação: código SQL novo em Effect sobre o worker atual; o existente numa passagem dedicada mais tarde.
- A passagem dedicada fica para **depois do protótipo `claude -p` e da análise de custos de API pelo utilizador**. O utilizador sublinhou que, se o custo da API for demasiado alto para o que a app entrega, o projeto deixa de ser válido; essa análise é por isso um ponto de decisão sobre a viabilidade do projeto.
- **Condicional aprovado (2026-10-04):** se a análise de custos der resposta positiva sobre a viabilidade, segue-se o **caminho 2** (corpos SQL em Effect sobre o worker atual, sem biblioteca nova), em passagem dedicada, limitada e módulo a módulo, com medição de desempenho antes e depois.
- Ordem aprovada: fechar o gate e push → protótipo `claude -p` + avaliação de custos (incluindo o Waypoint parent por API com Opus) → decisão de viabilidade do utilizador → restante opção C, PC-S1, Conversation e, se a resposta for positiva, o caminho 2.
