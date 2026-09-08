# BikeFlow — homologação da interface de OS

Data: 2026-08-23  
Resultado: `conditionally_complete`  
Confiança: alta para API/concorrrência; média para evidência estática da interface; baixa para renderização visual, pois os navegadores automatizados não inicializaram o processo gráfico deste Windows.

## Ambiente e limitações

- Aplicação: build de produção em `http://127.0.0.1:3000`.
- Chrome headless: `blocked`, processo GPU encerrou com falha fatal.
- Edge headless: `blocked`, mesma falha no processo GPU.
- Edge normal com depuração local: `blocked`, porta 9222 não ficou disponível.
- Nenhum caso visual foi promovido para `passed` por inspeção de código.
- Não foram testados visualmente: desktop, mobile, contraste, zoom, leitor de tela e impressão.

## Casos e resultados

| ID | Caso | Status | Evidência/resultado |
|---|---|---|---|
| OS-UI-TC-001 | Carregar OS no Chrome headless | `blocked` | processo GPU fatal; nenhum DOM confiável retornado |
| OS-UI-TC-002 | Carregar OS no Edge headless | `blocked` | processo GPU fatal; nenhum DOM confiável retornado |
| OS-UI-TC-003 | Automatizar Edge normal por CDP | `blocked` | conexão local 9222 recusada |
| OS-UI-TC-004 | Duplo início da mesma OS | `passed` | respostas 200 e 409; apenas uma atividade “Serviço iniciado” |
| OS-UI-TC-005 | Duplo clique em READY | `passed` | reexecução concorrente: respostas 200/200, status READY e uma única atividade de baixa |
| OS-UI-TC-006 | Abrir detalhe por URL/refresh | `not_executed_static_evidence` | URL agora usa `#order-detail/{id}` e a hidratação restaura ou rejeita o ID informado |
| OS-UI-TC-007 | Operar linhas da lista por teclado | `not_executed_static_evidence` | helper adiciona `tabindex`, `role`, nome e Enter/Espaço às linhas e cards clicáveis |
| OS-UI-TC-008 | Atribuir mecânico por teclado | `not_executed_static_evidence` | controle recebe semântica e teclado enquanto a OS permite atribuição |
| OS-UI-TC-009 | Foco de modal | `not_executed_static_evidence` | foco inicial, trap de Tab, Escape e retorno ao invocador implementados; labels dinâmicos ligados por `for`/ID |
| OS-UI-TC-010 | Botões de ícone acessíveis | `not_executed_static_evidence` | botões `?` e `⚙` agora possuem `aria-label` descritivo |
| OS-UI-TC-011 | Filtros Status/Prazo | `not_executed_static_evidence` | mecanismo único combina busca, aba, status e prazo; datas ISO são ordenadas cronologicamente e atrasos são calculados no dia local |
| OS-UI-TC-012 | Loading das ações principais | `not_executed_static_evidence` | transições e confirmação READY desabilitam o botão e exibem “Processando...” durante a requisição |

Contagem: 2 `passed`, 0 `failed`, 3 `blocked`, 7 `not_executed_static_evidence`.

## Defeitos e riscos

### QA-OS-017 — duplo READY expõe erro interno — corrigido

- Tipo: defeito de concorrência/UX.
- Severidade: média; prioridade sugerida: P1.
- Reprodução anterior: 1/1. Reexecução após correção: `passed`.
- Passos: disparar simultaneamente duas chamadas `POST /ready` para a mesma OS em serviço.
- Esperado: ambas retornam sucesso idempotente ou a segunda retorna conflito de domínio compreensível.
- Atual: duas chamadas simultâneas retornam 200, com uma única atividade/baixa.
- Correção: retry limitado de conflitos `P2034` em transações serializáveis e bloqueio temporário do botão.

### QA-OS-018 — detalhe não possui deep link — corrigido estaticamente

- Tipo: defeito de navegação/lifecycle.
- Severidade: média; prioridade sugerida: P1.
- Evidência estática: `showPage()` grava somente `#order-detail`; `selectedOrderId` não está na URL.
- Impacto: refresh, favorito, compartilhamento, voltar/avançar e abertura em nova guia não preservam a OS.

### QA-OS-019 — controles essenciais não são operáveis por teclado — corrigido estaticamente

- Tipo: defeito de acessibilidade.
- Severidade: média; prioridade sugerida: P1.
- Afetados: linhas de OS, cards clicáveis e atribuição de mecânico.
- Evidência: `div` com `onclick`, sem semântica, foco ou teclado equivalente.

### QA-OS-020 — gerenciamento de foco incompleto nos modais — corrigido estaticamente

- Tipo: defeito de acessibilidade/lifecycle.
- Severidade: média; prioridade sugerida: P1.
- Evidência: há foco inicial e Escape, mas não há focus trap nem retorno ao elemento invocador.
- Impacto: usuário de teclado pode navegar para conteúdo atrás do modal e perder o ponto de retorno.

### QA-OS-021 — ausência de estado de carregamento nas transições — corrigido estaticamente

- Tipo: risco de UX/concorrrência.
- Severidade: média; prioridade sugerida: P1.
- Evidência estática e dinâmica: botões principais permanecem habilitados; duplo READY alcançou um 500.

### QA-OS-009 — filtro Prazo não usa a data real — corrigido estaticamente

- Severidade: média; prioridade sugerida: P1.
- Estado: Status e Prazo compartilham a mesma regra de filtragem; prazo ordena datas ISO reais, mantém previsões desconhecidas depois das conhecidas e não marca OS encerradas como atrasadas.

## O que funcionou nesta rodada

- Duplo `start` não duplicou atividade e a segunda chamada recebeu conflito de domínio 409.
- Duplo `READY` retornou 200/200 e não duplicou baixa nem atividade.
- Matriz de regressão ampliada: 21/21 casos `passed`, incluindo data estruturada, limpeza e data inválida.
- Dados sintéticos `qa-matrix-*` removidos após a execução.

## Próximas correções recomendadas

1. Reexecutar filtros, deep link, teclado, foco, responsividade e contraste em navegador com GPU disponível.
2. Associar mensagens de validação dinâmica aos campos com `aria-describedby`/`aria-invalid`.
3. Validar visualmente a criação e impressão de OS com data e observação de prazo em navegador disponível.
