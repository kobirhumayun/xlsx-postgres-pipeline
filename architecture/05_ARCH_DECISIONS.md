# Architecture Decisions (Must decide before coding)

## Language decision (locked)
- Implementation language is **JavaScript-only**.
- Do NOT introduce TypeScript files, TS config, or TS build steps.
- Use **JSDoc** for type-like documentation where helpful.
- Use runtime validation for inputs (e.g., schemas) in server routes.

Rationale:
- The project non-negotiable requirement is JavaScript.
- JSDoc + runtime validation provides sufficient safety without TS overhead.

## ORM / DB access (choose ONE)
Pick exactly one approach and implement fully:
1) Prisma ORM (recommended)

Must justify choice in README.
