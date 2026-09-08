# BikeFlow — mapa funcional de Ordens de Serviço

Data: 2026-08-23  
Status da etapa: `conditionally_complete`  
Método: rastreamento estático UI → JavaScript → API → serviço → Prisma/PostgreSQL. Casos dinâmicos ainda não executados nesta etapa são marcados como `not_executed_static_evidence`.

## Escopo e fonte esperada

- Incluído: lista, criação, detalhe, itens, checklist, orçamento, mecânico, estados, estoque, histórico, WhatsApp e impressão.
- Excluído por enquanto: correções, autenticação real, testes destrutivos, envio efetivo de WhatsApp e homologação mobile.
- Oráculo: texto da interface, schemas Zod, serviço de domínio, modelo Prisma e comportamento profissional esperado explicitamente solicitado pelo proprietário.
- Ambiguidades que exigem decisão: política de cancelamento, edição após início, desconto/acréscimo, validade do orçamento, sinal/pagamento e autorização por papel.

## Atores atuais

| Ator | Implementação atual | Situação profissional |
|---|---|---|
| Proprietário | Contexto fixo `OWNER` | Não há login, sessão nem usuário real |
| Mecânico | Nome livre gravado na OS | Não é uma conta, não possui permissão nem identidade auditável |
| Cliente | Registro associado à bicicleta | Não possui portal, aceite autenticado ou confirmação de envio |
| Oficina | Workshop derivado de configuração demo | Estrutura multi-oficina existe no banco, mas isolamento não foi homologado |

## Estados da OS

```text
OPEN --(aprovação + mecânico)--> IN_PROGRESS --(estoque suficiente)--> READY --(retirada)--> COMPLETED
                                      ^                              |
                                      |---------(reabrir)------------|

O cancelamento agora aceita `OPEN`, `IN_PROGRESS` e `READY`; em `READY`, o saldo consumido é revertido. `COMPLETED` permanece terminal.
```

Regras positivas encontradas:

- Totais são recalculados no servidor.
- Alterar itens invalida uma aprovação anterior.
- Marcar `READY` consome estoque em transação serializável.
- Repetir `READY` é idempotente enquanto a OS já está pronta.
- Reabrir cria movimentos de reversão e preserva o ledger.
- `COMPLETED` bloqueia edição de conteúdo.

## Inventário de controles e conexões

| ID | Controle/jornada | Cadeia implementada | Efeito persistido | Estado da análise | Lacuna principal |
|---|---|---|---|---|---|
| OS-UI-001 | Nova OS | modal → `POST /api/work-orders` → `create` | OS, linhas e atividade | `not_executed_static_evidence` | Criação permite `initialStatus=IN_PROGRESS` pela API |
| OS-UI-002 | Busca da lista | filtro DOM local | Nenhum | `not_executed_static_evidence` | Pesquisa só o lote já carregado; sem busca/paginação no servidor |
| OS-UI-003 | Aba Ativas | filtro DOM por status | Nenhum | `not_executed_static_evidence` | Não possui estado na URL nem acessibilidade de tab |
| OS-UI-004 | Aba Prontas | filtro DOM por status | Nenhum | `not_executed_static_evidence` | Mesmo risco de lote local |
| OS-UI-005 | Aba Finalizadas | filtro DOM por status | Nenhum | `not_executed_static_evidence` | Não inclui canceladas nem paginação histórica |
| OS-UI-006 | Filtro Status | controle → estado combinado → linhas da OS | Nenhum | `not_executed_static_evidence` | Implementado; pendente validação visual em navegador |
| OS-UI-007 | Filtro Prazo | controle → parser de data local → ordenação/filtro combinado | Nenhum | `not_executed_static_evidence` | Implementado para datas ISO; textos legados ficam sem ordenação cronológica |
| OS-UI-008 | Abrir linha da OS | `selectedOrderId` em memória → detalhe | Nenhum | `not_executed_static_evidence` | Sem rota/deep link; refresh perde seleção |
| OS-UI-009 | Diagnóstico | debounce 500 ms → `PATCH /api/work-orders/:id` | Texto + atividade | `not_executed_static_evidence` | Escrita de snapshot completo e corrida com outras edições |
| OS-UI-010 | Adicionar serviço | modal → PATCH completo | Linha snapshot + totais + atividade | `not_executed_static_evidence` | Sem editar quantidade/preço/desconto após inclusão |
| OS-UI-011 | Remover serviço | confirmação → PATCH completo | Remove/recria linhas | `not_executed_static_evidence` | Concorrência pode causar perda de atualização |
| OS-UI-012 | Adicionar peça | modal → PATCH completo | Linha snapshot; ainda sem baixa | `not_executed_static_evidence` | Seleção por nome e preço manual; sem reserva de estoque |
| OS-UI-013 | Remover peça | confirmação → PATCH completo | Remove/recria linhas | `not_executed_static_evidence` | Não há política após reserva, pois reserva não existe |
| OS-UI-014 | Aplicar checklist | cópia local → PATCH | JSON snapshot + atividade | `not_executed_static_evidence` | Sem remover/trocar checklist explicitamente |
| OS-UI-015 | Resultado do checklist | select/input → PATCH completo | JSON snapshot | `not_executed_static_evidence` | Sem evidência/foto, responsável por item ou obrigatoriedade configurável |
| OS-UI-016 | Atribuir mecânico | clique no texto → `POST /assign` | Nome + atividade | `not_executed_static_evidence` | Mecânico é texto livre, não usuário/papel/capacidade |
| OS-UI-017 | Aprovar orçamento | modal → `POST /approve` | decisão + nota + data + atividade | `not_executed_static_evidence` | Aceite é lançado pela oficina; sem identidade/evidência do cliente |
| OS-UI-018 | Recusar orçamento | modal → `POST /reject` | decisão + nota + atividade | `not_executed_static_evidence` | Recusa não cancela nem cria fluxo de revisão formal |
| OS-UI-019 | Iniciar serviço | `POST /start` | `IN_PROGRESS` + atividade | `not_executed_static_evidence` | Regra pode ser contornada na criação direta pela API |
| OS-UI-020 | Marcar pronta | confirmação → `POST /ready` | status, baixa e ledger | `not_executed_static_evidence` | Sem reserva prévia; duas OS podem prometer a mesma peça até a baixa |
| OS-UI-021 | Reabrir | botão `•••` somente em READY → `POST /reopen` | status, reversão e atividade | `not_executed_static_evidence` | `•••` não é menu; nos demais estados apenas mostra toast |
| OS-UI-022 | Concluir retirada | `POST /complete` | `COMPLETED` + atividade | `not_executed_static_evidence` | Não exige pagamento, comprovante, recebedor ou confirmação |
| OS-UI-023 | Cancelar OS | modal com motivo → `POST /cancel` | status, atividade e possível reversão | `passed` por API | UI visual ainda não homologada em navegador real |
| OS-UI-024 | WhatsApp | template → `wa.me` + `POST /contact` | atividade com texto | `not_executed_static_evidence` | Histórico afirma contato sem confirmar envio/entrega |
| OS-UI-025 | Imprimir/PDF | nova janela → GET individual → impressão | Nenhum | `not_executed_static_evidence` | PDF não é armazenado/versionado; dados legais da oficina incompletos |
| OS-UI-026 | Histórico | atividades incluídas em todas as consultas | Leitura | `not_executed_static_evidence` | Lista geral carrega históricos completos e sem paginação |

## Dependência ponta a ponta

```text
Navegação/lista em public/bikeflow.html
  -> estado global/localStorage em public/bikeflow.js
  -> fetch JSON pela função api()
  -> Route Handler em src/app/api/work-orders/**
  -> getRequestContext() com usuário demo OWNER
  -> workOrderService
  -> transação Prisma quando definida
  -> PostgreSQL (work_orders, linhas, activities, inventory_movements)
  -> resposta completa
  -> substituição do objeto no array global
  -> localStorage + renderização manual do DOM
```

## Achados confirmados nesta etapa

### QA-OS-009 — filtros de Status e Prazo não funcionam — corrigido estaticamente

- Tipo: defeito.
- Severidade: média; prioridade sugerida: P1.
- Evidência atual: `orders()` mantém estado combinado de aba, busca, status e prazo; datas ISO são validadas e ordenadas cronologicamente.
- Evolução concluída: `expectedDate` armazena a data civil e `expectedNote` preserva observações; o backfill separou os valores legados sem descarte.

### QA-OS-010 — risco de perda de atualização concorrente

- Tipo: risco de integridade.
- Severidade: alta; prioridade sugerida: P0.
- Evidência: diagnóstico, serviço, peça e checklist enviam snapshots completos; não há versão/ETag/`updatedAt` esperado nem bloqueio otimista.
- Cenário: autosave do diagnóstico e inclusão de peça em paralelo podem terminar fora de ordem e a última resposta sobrescrever estado mais novo.
- Recomendação de teste: duas requisições PATCH concorrentes com snapshots divergentes e verificação por leitura fresca.

### QA-OS-011 — ausência de reserva de estoque

- Tipo: risco de regra de negócio.
- Severidade: alta em oficinas com múltiplas OS; prioridade sugerida: P1.
- Evidência: peças são somente linhas da OS até `READY`; o saldo só é debitado ao finalizar o serviço.
- Impacto: duas OS podem usar/prometer a mesma última peça e uma falhar apenas no fim.
- Critério pendente: decidir entre reserva ao aprovar, ao iniciar ou política explícita de não reserva.

### QA-OS-012 — consulta geral não é escalável

- Tipo: risco de desempenho e privacidade.
- Severidade: média; prioridade sugerida: P1.
- Evidência: `GET /api/work-orders` retorna todas as OS com cliente, bicicleta, linhas, estoque e histórico completo, sem paginação.
- Impacto: resposta cresce continuamente e transfere dados pessoais/operacionais além do necessário para a lista.

## Próxima subetapa

Criar e executar a matriz de testes da OS por estado e decisão: criação, aprovação, mecânico, edição concorrente, estoque insuficiente, READY idempotente, reabertura repetida, conclusão, refresh/deep link, falha de rede e controles órfãos.
