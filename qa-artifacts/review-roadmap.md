# BikeFlow — roteiro de revisão profissional

Data: 2026-08-23
Ambiente: desenvolvimento local, Next.js 16.3.1, PostgreSQL 18 em `127.0.0.1:5433`
Escopo desta fase: auditoria e priorização; nenhuma correção de código de produção autorizada.

## Ordem de revisão

1. Ordens de Serviço (criação, orçamento, execução, estoque, conclusão, histórico, WhatsApp e impressão)
2. Clientes e Bicicletas
3. Estoque e movimentações
4. Catálogo de serviços e checklists
5. Catálogo de peças
6. Dashboard, busca e navegação
7. Segurança, papéis, multi-oficina, resiliência, acessibilidade e observabilidade

## Critérios transversais

- jornada feliz, validações negativas e limites;
- estados permitidos, proibidos, repetição e recuperação;
- autorização por papel e isolamento entre oficinas;
- persistência após recarregar e acesso direto por API;
- concorrência, idempotência e integridade transacional;
- falha de banco/rede, feedback e recuperação;
- desktop/mobile, acessibilidade, idioma, moeda e horário;
- privacidade, auditoria, paginação, desempenho e observabilidade.

## Evidências iniciais

- Build de produção: aprovado.
- TypeScript: aprovado.
- Sintaxe dos frontends: aprovada.
- Health/database: HTTP 200, conectado.
- Testes automatizados existentes: nenhum detectado.
- Autenticação atual: contexto fixo de desenvolvimento.

## Achados preliminares da OS

- QA-OS-001 (alto): importação automática do cache/seeds cria dados no PostgreSQL ao abrir o frontend e já produziu duplicações com novas chaves de navegador.
- QA-OS-002 (alto): `initialStatus=IN_PROGRESS` é aceito pelo POST público e contorna as regras de aprovação e mecânico aplicadas somente à transição `start`.
- QA-OS-003 (alto para produção): não há autenticação real; todas as requisições usam `development-user` e papel `OWNER`.
- QA-OS-004 (médio): atraso usa a propriedade local `overdue`, que não existe no modelo persistido; indicadores de atraso não são confiáveis após sincronização.
- QA-OS-005 (médio): `CANCELLED` existe no estado e nos filtros, mas não há jornada ou endpoint de cancelamento.
- QA-OS-006 (médio): o histórico registra “Contato pelo WhatsApp” após abrir o link, mas não comprova que a mensagem foi enviada.
- QA-OS-007 (médio): acesso direto/refresh da página de detalhe não identifica a OS na URL; `selectedOrderId` começa com um ID legado fixo.
- QA-OS-008 (alto estrutural): não existe suíte unitária, de integração, contrato ou E2E para regras críticas da OS e estoque.
- QA-OS-013 (alto, corrigido e verificado): `READY` agora exige aprovação vigente após alteração de itens.
- QA-OS-014 (alto, corrigido e verificado): criação pública agora permanece `OPEN`.
- QA-OS-015 (alto, corrigido e verificado): versão otimista retorna `STALE_WORK_ORDER` e preserva a atualização mais nova.
- QA-OS-016 (médio, corrigido e verificado): cancelamento auditado, idempotente e com reversão de estoque para OS pronta.

Estes achados ainda passarão por casos rastreáveis e triagem final antes da recomendação de correções.
