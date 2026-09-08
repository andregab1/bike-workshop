# BikeFlow — validação de prazo estruturado da OS

Data: 2026-08-23  
Resultado: `conditionally_complete`  
Ambiente: Next.js 16.3.1, PostgreSQL 18, produção local em `http://127.0.0.1:3000`.

## Escopo e contrato

- `expectedDate`: data civil opcional armazenada como PostgreSQL `DATE`.
- `expectedNote`: observação textual opcional, independente da data.
- Backfill: textos `AAAA-MM-DD` válidos migrados para data; demais textos preservados como observação.
- O campo legado `expectedText` foi removido depois do backfill.

## Evidências executadas

| Caso | Status | Resultado |
|---|---|---|
| OS-TC-019 — criar e reler data + observação | `passed` | `2026-09-15` e “Retirada após as 14h” preservados em leitura fresca |
| OS-TC-020 — limpar ambos os campos | `passed` | API e leitura fresca retornaram `null`/`null` |
| OS-TC-021 — data impossível `2026-02-30` | `passed` | HTTP 400 `VALIDATION_ERROR` |
| Regressão funcional completa da OS | `passed` | 21/21 casos aprovados |
| Schema Prisma | `passed` | `prisma validate` aprovado; 11 migrações e banco atualizado |
| Build de produção | `passed` | compilação, TypeScript e geração das páginas concluídos |
| Frontend estático | `passed` | `node --check public/bikeflow.js` sem erros |
| Dados sintéticos | `passed` | `QAMatrix = 0` após limpeza |

## Risco residual

- Fluxos visuais de criação, ordenação e impressão continuam `not_tested` em navegador devido ao bloqueio gráfico já registrado. O contrato de API e persistência foi validado dinamicamente.
