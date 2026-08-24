# PopPol — Popularidade Política

Plataforma cívica para descobrir políticos, acompanhar contexto e registrar apoio ou crítica de forma transparente.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/poppol/src/App.tsx` — interface de descoberta e perfis públicos.
- `artifacts/poppol/src/index.css` — tokens visuais e responsividade.
- `lib/api-spec/openapi.yaml` — contrato da API e fonte dos hooks gerados.
- `artifacts/api-server/src/routes/politicians.ts` — dados e endpoints públicos de políticos, atividade e manifestações.

## Architecture decisions

- A manifestação é tratada como participação cívica contextualizada, com apoio e crítica separados visualmente.
- O ranking usa um índice público composto por apoio menos crítica, sem ocultar políticos com índice baixo.
- A interface evita linguagem de ataque pessoal e mantém o foco em cargos, contexto e histórico.

## Product

Usuários podem pesquisar e filtrar representantes por nível e região, explorar um perfil com biografia, mandatos, histórico e sentimento público, e registrar uma manifestação com feedback imediato.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- O contrato OpenAPI precisa ser atualizado antes de regenerar os clientes com `pnpm --filter @workspace/api-spec run codegen`.
- Os workflows gerenciados são `artifacts/api-server: API Server` e `artifacts/poppol: web`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
