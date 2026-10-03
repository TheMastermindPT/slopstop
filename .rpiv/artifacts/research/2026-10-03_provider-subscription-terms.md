---
date: 2026-10-03
author: coordenador-claude (Claude Code), a pedido de Pedro Mesquita
repository: slopstop
status: research
tags: [strategy, providers, terms, runtime]
---

# Termos dos fornecedores: subscrição vs API para o Ragnarok

Pesquisa web em fontes primárias, verificada a 03/10/2026, para a questão "o Ragnarok corre os agentes ou orquestra os CLIs existentes?". **Não é aconselhamento jurídico.** [V] = fonte primária; [S] = secundária; [I] = inferência.

## Anthropic — regra explícita
- "Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users." Os desenvolvedores "may not collect, store, or intermediate Claude.ai credentials or session tokens"; quem usa o Agent SDK deve usar API key; a aplicação pode acontecer "without prior notice" [V] ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)).
- Permitido: o utilizador final entrar no binário **não modificado** do Claude Code com a sua subscrição, incluindo quando uma plataforma o aloja [V] (mesma página).
- Os limites Pro/Max pressupõem "ordinary, individual usage of Claude Code and the Agent SDK" [V].
- `claude -p` e `stream-json` são interfaces documentadas; `--bare` não usa o login da subscrição e exige `ANTHROPIC_API_KEY` [V] ([headless](https://code.claude.com/docs/en/headless)).
- **Zona cinzenta:** uma GUI de terceiros que lança o `claude -p` não modificado com o login do próprio utilizador conta como "ordinary, individual usage"? Não encontrámos resposta [I].
- Notícia de fevereiro de 2026 sobre a proibição [S] ([The Register](https://www.theregister.com/2026/02/20/anthropic_clarifies_ban_third_party_claude_access/)).
- API por milhão de tokens: Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, Haiku 4.5 $1/$5; Batch com 50% de desconto [V] ([preços](https://platform.claude.com/docs/en/about-claude/pricing)).

## OpenAI — maioritariamente não escrito
- O Codex aceita "Sign in with ChatGPT" (subscrição) ou API key [V] ([Codex auth](https://learn.chatgpt.com/docs/auth)). Para fluxos programáticos, como CI/CD, recomenda API key, faturada às tarifas da API; manda tratar `~/.codex/auth.json` como uma password [V].
- Não encontrámos programa nem proibição explícita sobre terceiros usarem o login do ChatGPT. O suporte do OpenCode a subscrições ChatGPT só tem fonte secundária [S].

## Google — proibição explícita mas vaga
- Aceder aos serviços do Gemini CLI "using third-party software, tools, or services (for example, using OpenClaw with Gemini CLI OAuth)" viola os termos e pode levar a suspensão [V] ([ToS](https://github.com/google-gemini/gemini-cli/blob/HEAD/docs/resources/tos-privacy.md)). Anunciado a 18/03/2026, em vigor a 25/03/2026 [V] ([#22970](https://github.com/google-gemini/gemini-cli/discussions/22970)). O que conta como "third-party software" ficou sem resposta oficial.
- As API keys seguem os termos separados da Gemini API e do Vertex.

## Outros
- GitHub Copilot: os planos pagos podem autenticar-se no OpenCode, segundo um changelog de 16/01/2026 visto só como snippet [S]. Seria permissão por parceiro, não geral.
- OpenRouter: não pesquisado.

## Comparação
| Fornecedor | CLI oficial com a subscrição do utilizador | Terceiro reutilizar tokens da subscrição | API |
| --- | --- | --- | --- |
| Anthropic | Permitido | Proibido, explícito | Por token; obrigatório para desenvolvedores |
| OpenAI | Permitido | Não documentado | Recomendado para automação |
| Google | Permitido | Proibido, vago | Termos separados |
| Copilot | Permitido | Por parceiro [S] | Não verificado |

## Implicações para o Ragnarok [I]
1. **Corrige uma premissa:** não é só a Anthropic que fecha a subscrição. A Google também proíbe explicitamente; a OpenAI é omissa.
2. **Orquestrar CLIs oficiais não modificados**, com o utilizador a autenticar-se pelo fluxo do fornecedor, é o caminho de menor risco para usar subscrições. O Ragnarok nunca lê, copia nem guarda tokens. Risco residual: uso intenso, paralelo e automatizado pode não ser considerado "ordinary, individual usage"; esperar limites e possível intervenção.
3. **API direta** é o caminho sancionado pelos três, pago ao token, com chave do próprio utilizador guardada em `safeStorage`.
4. **Reutilizar tokens de subscrição no runtime do Ragnarok:** proibido na Anthropic e na Google, incerto na OpenAI. Não fazer.
5. **Consequência arquitetural:** o modelo híbrido (orquestrar CLIs para executar com subscrição; API direta quando o Ragnarok precisa de controlar a chamada; o Ragnarok sempre dono de entendimento, decisões e evidência) é compatível com os termos verificados. Para uso pessoal tem baixo risco. Antes de abrir ao público, pedir confirmação escrita à Anthropic sobre a zona cinzenta.

## Lacunas
- Data primária da regra da Anthropic; termos da OpenAI e página do `codex exec` não lidos; changelog do Copilot visto só como snippet; OpenRouter não pesquisado.
