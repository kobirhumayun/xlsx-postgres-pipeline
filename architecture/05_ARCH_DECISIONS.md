# Architecture Decisions (Must decide before coding)

## Next.js setup note
The project prompt contains conflicting guidance:
- Language: JavaScript
- Also mentions "Next.js App Router, TypeScript"

Decision rule:
- Prefer JavaScript for implementation.
- Use JSDoc type annotations + runtime validation where appropriate.
- Include eslint + prettier. (Typecheck can be omitted unless TS is introduced.)

## ORM / DB access (choose ONE)
Pick exactly one approach and implement fully:
1) Prisma ORM (recommended)
2) Drizzle ORM
3) node-postgres + SQL files

Must justify choice in README.
