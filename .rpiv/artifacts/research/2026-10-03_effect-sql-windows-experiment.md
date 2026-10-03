---
date: 2026-10-03
author: OpenCode
commit: 8f58420
branch: main
repository: slopstop
status: in-progress
---

# Effect SQL — experiência delimitada no Windows

Experiência autorizada pela aprovação das quatro propostas de migração. **Não escolhe o cliente SQL definitivo nem altera a aplicação.** Claude implementa os schemas na worktree `ragnarok-effect`; OpenCode executou esta experiência apenas em Temp.

## Configuração

- Windows, Node24.20.0, pnpm11.5.1.
- `effect@4.0.0`, `@effect/sql-libsql@4.0.0`, `@libsql/client@0.17.4`, `libsql@0.5.29` fixado por override, `zod@4.4.3` para o worker existente.
- Diretório: `C:/Users/pedro/AppData/Local/Temp/opencode/ragnarok-effect-sql-spike`.
- Instalação isolada com `pnpm install --ignore-scripts`; nenhum package/lockfile da aplicação foi alterado.
- Script: `compare.mjs`, SHA-256 `45b3153c3c29f001f1057e827d10d78c82c554afc1f881178ebc9a0109a27bd5`.
- Lock: `pnpm-lock.yaml`, SHA-256 `ff53f2f6120a03833f03fb7fff01b63f88cd5c11053ce47f6277953e73fb634a`.
- Worker importado da worktree preservada `ragnarok-pc-s1/apps/harness/src/storage/local-libsql-worker-client.ts`, SHA-256 `ad5f2fbe2cc7856b64d65e16bd3414f3f5ed0f54d6043940795519aa2513b7f3`.
- Comando: `node --experimental-transform-types compare.mjs`. A opção serve apenas para importar o TypeScript existente sem alterar/buildar o projeto.

Context7 foi consultado antes da experiência; o código oficial e o pacote fixado4.0.0 foram inspecionados para confirmar API e finalização. A primeira tentativa falhou por usar um caminho Windows em vez de URL `file:///` no import; corrigido apenas no script descartável. A primeira execução válida parou no EBUSY do Effect. A versão final regista essa diferença como resultado para completar os restantes casos; não a transforma num passe.

## Resultados observados

Uma matriz completa, no processo25080, com bases novas em `Temp/opencode/sql-comparison-ez8DqZ`. Valores temporais são observações desta execução, não benchmarks.

| Caso | Resultado |
| --- | --- |
| Worker atual: commit e rollback | Passaram; apenas a linha confirmada persistiu |
| Worker atual: escrita com fence SQL antigo | Recusada pelo predicado; valor confirmado preservado |
| Worker atual: renomear enquanto aberto | EBUSY, controlo negativo válido |
| Worker atual: aguardar close, renomear e apagar | Passou;18ms nesta execução |
| Effect SQL: commit e rollback | Passaram; apenas a linha confirmada persistiu |
| Effect SQL: escrita com fence SQL antigo | Não alterou o valor confirmado |
| Effect SQL: renomear enquanto aberto | EBUSY |
| Effect SQL: aguardar ManagedRuntime.dispose, renomear | EBUSY imediato; não passou o requisito de libertação imediata |
| Effect SQL sem transação explícita: dispose e renomear | EBUSY imediato |
| SDK libSQL direto: transaction.close, sdk.close e renomear | EBUSY imediato |
| Effect SQL: commit real seguido de perda simulada da confirmação | Exit Failure/SqlError, mas uma linha permaneceu gravada |

O último caso substitui temporariamente o método commit de um cliente descartável: primeiro confirma realmente a transação, depois lança um erro. Isso prova que uma falha devolvida ao chamador não permite inferir rollback. Não reproduz uma queda real nem substitui os testes de reconciliação da aplicação.

## Interpretação

1. Effect SQL realiza as operações básicas testadas. Não foi encontrada aqui uma razão para rejeitar Effect como modelo de execução.
2. **Eliminar agora o worker e passar diretamente ao cliente libSQL na thread do harness não tem prova suficiente.** A libertação imediata, demonstrada pelo worker, falhou nas variantes diretas após close/dispose.
3. O SDK direto também apresentou EBUSY. O resultado não demonstra um defeito exclusivo do Effect SQL. Não foi identificado o mecanismo de retenção nem medido o tempo até libertar sem fechar o processo.
4. Classificação e reconciliação de commit incerto continuam a pertencer à aplicação. A perda da confirmação não constitui prova de rollback.
5. Não se decidiu conservar a arquitetura atual para sempre. Um adaptador de recursos/worker sob Effect pode ser avaliado separadamente; uma fronteira nativa gerida não é automaticamente uma camada legacy.

## Limites deliberados

- Uma execução completa da matriz; não é benchmark estatístico, stress test ou diagnóstico dos crashes antigos.
- O fence verifica apenas o predicado SQL, não a lease/fencing completos entre processos.
- Não foram medidas responsividade do event loop, concorrência ou recuperação de queda real.
- Nenhum teste Electron empacotado ou de todos os dados foi realizado.
- A escolha definitiva do cliente SQL permanece com o utilizador. A migração Schema pode continuar independentemente.

## Fontes primárias

- [LibsqlClient4.0.0](https://github.com/Effect-TS/effect/blob/effect%404.0.0/packages/sql/libsql/src/LibsqlClient.ts): configuração gerida/liveClient, finalizador SDK e transações.
- [Metadados npm do adaptador4.0.0](https://registry.npmjs.org/@effect/sql-libsql/4.0.0).
- [SqlClient4.0.0](https://github.com/Effect-TS/effect/blob/effect%404.0.0/packages/effect/src/sql/SqlClient.ts): finalização transacional; não presumir que a falha de commit chega apenas pelo canal de erros esperados.

Resultado transmitido ao Claude como dados experimentais, não como autorização para trocar ou eliminar o cliente atual.
