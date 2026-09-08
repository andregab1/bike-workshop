# BikeFlow — Threat Model

## Escopo e premissas

- Aplicação restrita à oficina, sem exposição pública planejada.
- Banco atual contém somente dados de teste.
- Produção armazenará dados pessoais de clientes e histórico técnico.
- Usuários internos terão papéis distintos e poderão usar computadores compartilhados.
- PostgreSQL, armazenamento de documentos e aplicação ficam sob controle da oficina.

## Ativos

- Dados pessoais de clientes e identificação de bicicletas.
- Ordens de serviço, diagnósticos, aprovações, retiradas e garantias.
- Estoque físico, reservas, custos e ledger de movimentações.
- Credenciais, sessões, papéis e vínculos com oficinas.
- PDFs oficiais, anexos, trilha de auditoria e configuração da oficina.

## Fronteiras de confiança

1. Navegador e aplicação Next.js.
2. Route Handlers e camada de serviços.
3. Better Auth e contexto ativo da oficina.
4. Prisma e PostgreSQL.
5. Sistema de arquivos/armazenamento de documentos.
6. Links externos de comunicação, como WhatsApp.

Toda entrada do navegador é não confiável. IDs, papel, oficina, valores, estoque e estado da OS devem ser revalidados no servidor.

## Capacidades do atacante

- Membro autenticado tentando executar ação fora do próprio papel.
- Usuário de outra unidade alterando IDs em requisições.
- Pessoa com acesso a computador compartilhado e sessão não encerrada.
- Repetição ou concorrência de requisições críticas.
- Manipulação de payloads, URLs, preços, quantidades e transições.
- Acesso indevido a arquivo local, backup ou máquina da oficina.

## Ameaças e controles

| Prioridade | Ameaça | Impacto | Controle requerido |
|---|---|---|---|
| Crítica | IDOR entre oficinas | Exposição/alteração de clientes, OS e estoque | `workshopId` somente da sessão; filtro em toda consulta; testes cruzados de API |
| Crítica | Reserva/consumo concorrente | Venda duplicada ou estoque negativo | Transação serializável, releitura, constraint, retry e idempotência |
| Alta | Permissão contornada por endpoint | Preço, cancelamento, estoque ou conclusão indevidos | Permissão por ação dentro do service; UI apenas como apoio |
| Alta | Sessão abandonada em computador comum | Acesso por pessoa não autorizada | Expiração, logout claro, bloqueio de tela e revogação de sessões |
| Alta | Alteração silenciosa de histórico | Perda de rastreabilidade | Eventos append-only, versões imutáveis, estornos e motivos obrigatórios |
| Alta | Cache de oficina anterior | Vazamento local entre unidades | Não persistir dados de domínio no navegador; invalidar cache na troca |
| Média | CSRF em mutações com cookie | Ações disparadas por origem externa | Validar `Origin`/host, SameSite e método; token quando necessário |
| Média | Exposição de custo/PII em DTO | Privacidade e informação comercial | DTO mínimo e permissão `VIEW_COST` |
| Média | Documento órfão ou substituído | Inconsistência documental | Chave gerada no servidor, hash, versão, escrita coordenada e armazenamento privado |
| Média | Perda local de banco/documentos | Interrupção e perda histórica | Backup cifrado, restauração testada e retenção definida |
| Média | XSS em conteúdo cadastrado | Roubo de sessão/ações no navegador | `textContent`/escaping, CSP, sem HTML arbitrário e testes |
| Baixa | Link do WhatsApp tratado como envio | Auditoria falsa | Registrar apenas `LINK_OPENED` sem API oficial |

## Regras de segurança da implementação

- Route Handler é endpoint público mesmo quando a UI está protegida.
- Autenticação, autorização e tenant devem ser verificados perto do banco.
- Prisma permanece somente no servidor.
- Ações críticas são transacionais, auditadas e idempotentes.
- Movimentações e versões históricas não são apagadas ou sobrescritas.
- Erros não expõem stack, SQL, Prisma, tokens ou segredos.
- Arquivos ficam fora do banco e nunca são servidos por caminho informado pelo cliente.
- Produção deve usar HTTPS mesmo em rede privada.

## Validação obrigatória antes de produção

- Teste direto de acesso cruzado entre duas oficinas.
- Testes de papéis para toda ação sensível.
- Concorrência real em PostgreSQL para reservas e movimentos.
- Revisão de sessão em computador compartilhado.
- Teste de restauração de backup do banco e documentos.
- Varredura de headers, CSP, cookies e retorno mínimo das APIs.

## Risco residual

Implantação restrita reduz ataque remoto oportunista, mas não elimina navegador comprometido, usuário interno, sessão abandonada, malware na máquina e falha operacional. Backup, controle físico e atualização do host continuam responsabilidades da oficina.
