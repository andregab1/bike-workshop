# BikeWorkshop / BikeFlow

Base da V1 do sistema operacional para oficinas de bicicletas, seguindo a
Especificação Mestra V1.1. A implementação começa pela fundação e evolui pelo
backlog numerado do documento.

## Desenvolvimento

```bash
corepack pnpm install
corepack pnpm dev
```

A aplicação fica em `http://localhost:3000`; o health check de desenvolvimento
fica em `http://localhost:3000/health`.

## Verificações

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm check:frontend
corepack pnpm build
```

## Banco de dados local

Copie `.env.example` para `.env` quando necessário e execute:

```bash
corepack pnpm db:start
corepack pnpm db:deploy
corepack pnpm db:generate
```

O PostgreSQL fica disponível em `localhost:5432`. A API
`GET /api/health` retorna `200` quando o banco está conectado e `503` quando o
serviço está indisponível.

### Alternativa nativa no Windows

Nesta máquina, o Docker/WSL2 não inicia porque a virtualização está desativada.
Com PostgreSQL 18 instalado, o projeto usa um cluster isolado em
`.postgres-data`, restrito a `127.0.0.1:5433`:

```bash
corepack pnpm db:native:init
corepack pnpm db:native:start
corepack pnpm db:native:create
corepack pnpm db:deploy
```

Para esse modo, use
`DATABASE_URL="postgresql://bikeflow@127.0.0.1:5433/bikeflow?schema=public"`.

## Estado atual

- Fundação Next.js com App Router e TypeScript strict (TASK-001).
- Front de referência BikeFlow integrado à rota inicial, com textos em UTF-8.
- Interações locais de navegação, pesquisa, filtros, formulários e feedbacks.
- Clientes e bicicletas com ficha, edição, arquivamento e persistência local.
- Seletor de bicicletas da nova OS vinculado ao cliente escolhido.
- Ordens de serviço persistentes com itens, totais e transições operacionais.
- Estoque persistente com ledger, entradas, inventário físico e consumo idempotente por OS.
- Catálogo de serviços e checklists persistentes com snapshots nas ordens.
- Fundação PostgreSQL/Prisma 7, Zod e health check server-side.
- Models e APIs tenant-scoped para oficina, clientes e bicicletas.
- Interface de clientes/bicicletas sincronizada com PostgreSQL; localStorage é apenas cache/fallback.
- Catálogos de serviços/checklists sincronizados com PostgreSQL e protegidos para OWNER.
- Estoque e ledger persistentes com Decimal, autoria, transações e proteção contra saldo negativo.
- Nenhum domínio, banco ou autenticação foi adicionado antes da task correspondente.

## APIs atuais

- `GET/POST /api/customers`
- `GET/PATCH/DELETE /api/customers/:id`
- `POST /api/customers/:id/bikes`
- `PATCH/DELETE /api/bikes/:id`
- `GET/POST /api/services`
- `PATCH/DELETE /api/services/:id`
- `GET/POST /api/checklists`
- `PATCH/DELETE /api/checklists/:id`
- `GET/POST /api/inventory`
- `GET /api/inventory/movements`
- `POST /api/inventory/:id/entry`
- `POST /api/inventory/:id/physical-count`
- `POST /api/inventory/:id/exit`

O modo de desenvolvimento resolve a oficina exclusivamente no servidor pelas
variáveis `DEMO_*`. Nenhuma rota aceita `workshopId` enviado pelo navegador.
