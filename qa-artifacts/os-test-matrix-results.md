# BikeFlow — resultados da matriz de estados da OS

Data: 2026-08-23  
Ambiente: desenvolvimento local, API de produção Next.js em `127.0.0.1:3000`, PostgreSQL 18 em `127.0.0.1:5433`  
Execução: `node qa-artifacts/run-os-api-matrix.mjs`  
Resultado: `conditionally_complete`  
Confiança: média — contratos e persistência foram exercitados via API; UI, papéis, tenant, mobile, acessibilidade e falhas de rede continuam não testados.

## Resumo

| Status | Quantidade |
|---|---:|
| `passed` | 10 |
| `failed` | 4 |
| `blocked` | 0 |
| `not_tested` | 0 |
| Total executado | 14 |

Todos os quatro registros sintéticos foram removidos. Consulta final: `remaining_qa_matrix = 0`.

## Casos executados

| ID | Caso | Resultado | Evidência principal |
|---|---|---|---|
| OS-TC-001 | Criar e reler OS aberta | `passed` | HTTP 200, `OPEN`, total 5000 |
| OS-TC-002 | Bloquear início sem aprovação | `passed` | 409 `QUOTE_NOT_APPROVED` |
| OS-TC-003 | Aprovar orçamento | `passed` | 200, `APPROVED` persistido |
| OS-TC-004 | Bloquear início sem mecânico | `passed` | 409 `MECHANIC_REQUIRED` |
| OS-TC-005 | Iniciar com aprovação e mecânico | `passed` | 200, `IN_PROGRESS` |
| OS-TC-006 | Exigir nova aprovação após mudar orçamento em execução | `failed` | aprovação virou `PENDING`, mas READY retornou 200 |
| OS-TC-007 | READY repetido é idempotente | `passed` | uma única atividade `STOCK_CONSUMED` |
| OS-TC-008 | Bloquear edição após conclusão | `passed` | 409 `WORK_ORDER_LOCKED` |
| OS-TC-009 | Impedir criação direta em execução | `failed` | POST retornou 201 `IN_PROGRESS` |
| OS-TC-010 | Rejeitar snapshot obsoleto | `failed` | PATCH antigo retornou 200 e reduziu serviços de 2 para 1 |
| OS-TC-011 | Rejeitar quantidade zero | `passed` | 400 `VALIDATION_ERROR` |
| OS-TC-012 | Rollback com estoque insuficiente | `passed` | 409, OS continuou `IN_PROGRESS`, saldo 12 → 12 |
| OS-TC-013 | Consultar OS inexistente | `passed` | 404 `WORK_ORDER_NOT_FOUND` |
| OS-TC-014 | Cancelar OS aberta | `failed` | rota retornou 404 |

## Defeitos reproduzidos

### QA-OS-013 — orçamento pendente não bloqueia READY

- Severidade: alta.
- Prioridade sugerida: P0.
- Reprodutibilidade: 1/1 nesta execução; caminho determinístico por contrato atual.
- Pré-condição: OS aprovada e iniciada.
- Passos mínimos:
  1. Alterar os itens durante `IN_PROGRESS`.
  2. Confirmar que `approvalStatus` voltou para `PENDING`.
  3. Executar `POST /ready`.
- Esperado: 409 até nova aprovação ou uma política explícita de aditivo aprovado.
- Atual: HTTP 200 e OS `READY`.
- Impacto: serviço pode ser entregue com valor diferente do aprovado.
- Causa provável: `ready` valida status e itens, mas não valida aprovação; `decideQuote` só aceita OS `OPEN`, portanto a nova aprovação também fica impossível pela API atual.

### QA-OS-014 — criação direta contorna o workflow

- Severidade: alta.
- Prioridade sugerida: P0.
- Reprodutibilidade: 1/1; determinístico pelo schema.
- Passo mínimo: `POST /api/work-orders` com `initialStatus: "IN_PROGRESS"`.
- Esperado: criação pública sempre `OPEN`; importação deve usar mecanismo interno e restrito.
- Atual: HTTP 201, `IN_PROGRESS`, sem mecânico e com aprovação pendente.
- Impacto: qualquer consumidor da API contorna aprovação e atribuição obrigatórias.

### QA-OS-015 — snapshot obsoleto causa perda de atualização

- Severidade: alta.
- Prioridade sugerida: P0.
- Reprodutibilidade: 1/1 com sequência stale determinística.
- Passos mínimos:
  1. Ler uma OS com um serviço.
  2. Atualizá-la para dois serviços.
  3. Enviar o snapshot antigo com um serviço.
- Esperado: 409 de conflito ou preservação da alteração mais nova.
- Atual: HTTP 200; a OS voltou de dois para um serviço.
- Impacto: autosave do diagnóstico, checklist e inclusão de itens podem apagar trabalho uns dos outros.
- Causa provável: PATCH aceita coleção completa sem versão esperada, ETag ou controle otimista.

### QA-OS-016 — cancelamento ausente

- Severidade: média.
- Prioridade sugerida: P1.
- Reprodutibilidade: 1/1.
- Esperado: transição auditada para `CANCELLED`, com regra explícita de estoque/aprovação.
- Atual: rota inexistente, HTTP 404.
- Impacto: ordens desistidas permanecem abertas ou precisam ser tratadas fora do sistema.

## Cobertura ainda pendente

- autenticação, papéis OWNER/MECHANIC e isolamento entre duas oficinas;
- cliques reais, duplo clique, loading, refresh, voltar e deep link;
- baixa e reversão com peça real em ciclos repetidos nesta matriz;
- indisponibilidade/timeout do banco e perda de resposta após commit;
- viewport mobile, teclado, leitor de tela e contraste;
- datas, atraso, timezone, moeda e limites máximos;
- impressão e WhatsApp em navegadores reais.

## Ordem recomendada de correção

1. QA-OS-015 — controle de versão e PATCH granular.
2. QA-OS-014 — remover `initialStatus` do contrato público.
3. QA-OS-013 — criar fluxo de aditivo/reaprovação durante execução e bloquear READY pendente.
4. QA-OS-016 — implementar cancelamento com decisão explícita sobre estoque e histórico.

## Reexecução após correções — 2026-08-23

Comando: `node qa-artifacts/run-os-api-matrix.mjs`  
Run ID: `1787461043362`

| Status | Quantidade |
|---|---:|
| `passed` | 13 |
| `failed` | 1 |
| Total | 14 |

- QA-OS-013: corrigido e verificado. Após alteração do orçamento, `READY` retornou 409 enquanto a aprovação estava pendente.
- QA-OS-014: corrigido e verificado. `initialStatus=IN_PROGRESS` não controla mais a criação; a resposta permaneceu `OPEN`.
- QA-OS-015: corrigido e verificado. Snapshot com versão antiga retornou 409 e os dois serviços permaneceram persistidos.
- QA-OS-016: permanece aberto. `POST /cancel` retornou 404.
- Limpeza: quatro OS sintéticas removidas; `remaining_qa = 0`.

Resultado desta correção: `conditionally_complete`, pois cancelamento e as demais categorias pendentes da auditoria da OS ainda não foram validados.

## Reexecução após implementar cancelamento — 2026-08-23

Comando: `node qa-artifacts/run-os-api-matrix.mjs`  
Run ID: `1787461408549`

| Status | Quantidade |
|---|---:|
| `passed` | 18 |
| `failed` | 0 |
| Total | 18 |

Cobertura nova:

- cancelamento de OS aberta com motivo e auditoria;
- repetição idempotente sem duplicar atividade;
- bloqueio de cancelamento após conclusão;
- motivo vazio rejeitado com `VALIDATION_ERROR`;
- cancelamento de OS pronta com reversão do estoque;
- saldo confirmado por leitura fresca: 12 antes e 12 depois;
- limpeza: 2 movimentos e 5 OS sintéticas removidos; `remaining_qa = 0`.

QA-OS-016 foi corrigido e verificado. A matriz de API/estado atualmente possui 18 casos aprovados. A auditoria geral da OS continua `conditionally_complete` porque autenticação, tenant, UI real, mobile, acessibilidade e falhas de dependência ainda permanecem fora desta rodada.
