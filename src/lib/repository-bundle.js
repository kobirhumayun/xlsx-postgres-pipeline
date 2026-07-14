import { savedQueryFileName, toSavedQuerySqlFile } from "./saved-query-files.js";
import { repositorySchemaFiles } from "./schema-export.js";
import { createHash } from "node:crypto";

export function repositoryBundleFiles(schema, savedQueries, generatedAt = new Date(), bundleOptions = {}) {
    const databaseSlug = pathSegment(schema.database);
    const queryGroups = groupQueriesByDatabase(savedQueries);
    const schemaFiles = repositorySchemaFiles(schema);
    const manifest = buildManifest(schema, savedQueries, schemaFiles, generatedAt, bundleOptions);
    const files = [
        {
            name: "README.md",
            data: repositoryReadme(schema.database, databaseSlug),
            date: generatedAt,
        },
        {
            name: "AGENTS.md",
            data: repositoryAgentInstructions(schema.database, databaseSlug),
            date: generatedAt,
        },
        {
            name: "manifest.json",
            data: `${JSON.stringify(manifest, null, 2)}\n`,
            date: generatedAt,
        },
        ...schemaFiles.map((file) => ({
            ...file,
            date: generatedAt,
        })),
    ];

    for (const [group, queries] of queryGroups) {
        const usedNames = new Set();
        for (const savedQuery of queries) {
            files.push({
                name: `queries/${group}/${savedQueryFileName(savedQuery, usedNames)}`,
                data: toSavedQuerySqlFile(savedQuery),
                date: savedQuery.updatedAt || generatedAt,
            });
        }
    }

    return { files, manifest };
}

function buildManifest(schema, savedQueries, schemaFiles, generatedAt, bundleOptions) {
    const tables = schema.schemas.flatMap((entry) => entry.tables);
    const unassignedCount = savedQueries.filter(
        (query) => !query.databaseName?.trim()
    ).length;
    const selectedDatabaseQueryCount = savedQueries.filter(
        (query) => query.databaseName?.trim() === schema.database
    ).length;
    const warnings = [];

    if (unassignedCount > 0) {
        warnings.push(`${unassignedCount} query file(s) have no databaseName and require review.`);
    }

    return {
        format: "xpp-repository-bundle",
        version: 1,
        purpose: "postgresql-data-purification-and-reporting",
        generatedAt: generatedAt.toISOString(),
        database: schema.database,
        schemaCatalog: "schema/catalog.md",
        schemaFingerprint: schemaFingerprint(schemaFiles),
        schemas: schema.schemas.map((entry) => entry.name),
        counts: {
            tables: tables.filter((table) => table.kind === "table" || table.kind === "partitioned_table").length,
            views: tables.filter((table) => table.kind === "view" || table.kind === "materialized_view").length,
            queries: savedQueries.length,
            selectedDatabaseQueries: selectedDatabaseQueryCount,
            unassignedQueries: unassignedCount,
        },
        schemaOptions: schema.options,
        queryOptions: {
            includeUnassignedQueries: bundleOptions.includeUnassignedQueries !== false,
        },
        warnings,
    };
}

function schemaFingerprint(schemaFiles) {
    const hash = createHash("sha256");
    for (const file of schemaFiles.filter((entry) => entry.name.endsWith(".sql"))) {
        hash.update(file.name);
        hash.update("\0");
        hash.update(file.data);
        hash.update("\0");
    }
    return hash.digest("hex");
}

function groupQueriesByDatabase(savedQueries) {
    const groups = new Map();

    for (const query of savedQueries) {
        const group = query.databaseName?.trim()
            ? pathSegment(query.databaseName)
            : "unassigned";
        const queries = groups.get(group) || [];
        queries.push(query);
        groups.set(group, queries);
    }

    return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function repositoryReadme(databaseName, databaseSlug) {
    return `# SQL Query Context Repository

## Repository Purpose

This repository is the version-controlled SQL workspace for transforming related source data into trusted report tables in PostgreSQL database \`${databaseName}\`. Source tables are populated outside these query files. SQL files check, normalize, compare, cross-match, deduplicate, reconcile, and combine source data according to business rules supplied in user prompts.

A query file may be a single read-only query or a multi-statement pipeline step. Pipeline steps may create and drop temporary tables and may create, refresh, or replace concrete report tables when the prompt explicitly requires that behavior. The agent writes SQL files only; importing a file saves it in the application and does not execute it.

## Source Of Truth

- \`schema/catalog.md\` is the compact relation and foreign-key index for \`${databaseName}\`.
- \`schema/tables/*.sql\` contains the canonical table, constraint, index, and view context.
- Files under \`schema/\` are generated. Do not edit them manually.
- Existing queries are grouped under \`queries/<database>/\` using their \`xpp:databaseName\` metadata.
- Read \`manifest.json\` for export counts, options, warnings, and schema fingerprint.

## Agent Workflow

1. Read \`manifest.json\` and \`schema/catalog.md\`.
2. Open the schema SQL for every source, lookup, intermediate, and report table involved.
3. Review related existing queries for established business rules and naming.
4. Translate the prompt into explicit inputs, matching rules, null handling, duplicate handling, output grain, output columns, and refresh behavior.
5. Ask for clarification instead of inventing a key, relationship, threshold, precedence rule, or destructive refresh strategy.
6. Create or update the smallest complete executable SQL file and do not execute it.

## Prompt Contract

A complete business prompt should identify the objective, input tables, matching fields, normalization rules, precedence and tie-breaking, intended output grain and columns, unmatched or rejected record handling, destination report table, refresh strategy, and required reconciliation totals. Infer only facts proven by schema or existing queries. When a required decision is missing, inspect the available context first and then ask a focused clarification question.

## Saved Query File Contract

Each saved query file has two regions:

1. A four-line metadata block at the very beginning of the file.
2. A SQL body containing documentation comments and executable statements.

Store selected-database queries under \`queries/${databaseSlug}/<query-name>.sql\`. Files under \`queries/unassigned/\` have no database assignment and require review before use.

The metadata block must be the first four lines, in this order:

- \`xpp:name\`: human-readable saved-query name. When ordered steps are used, begin it with the same numeric prefix as the filename.
- \`xpp:version\`: file-format version; use \`1\`.
- \`xpp:databaseName\`: target database assignment; use \`${databaseName}\` for this repository.
- \`xpp:description\`: one-line summary of the query's business outcome.

Everything after the metadata block is stored as the saved query's SQL body, including ordinary SQL comments. Importing a file saves that body and never executes it. A Run action executes the entire body in one request. Numeric filename prefixes document the intended order for people and agents; the application does not schedule or execute files automatically.

## File And Execution Model

- Create one file per independently executable query or pipeline step under \`queries/${databaseSlug}/\`.
- A file may contain multiple SQL statements when they form one pipeline step.
- Use ordered names for dependent steps: \`010-normalize-source.sql\`, \`020-cross-match-records.sql\`, \`030-build-final-report.sql\`.
- Match the numeric prefix in \`xpp:name\`, for example \`010 - Normalize Source\`.
- Each Run action uses a database connection for that request only. A temporary table must be created, used, and dropped in the same file. Never expect it to exist for a later file or Run action.
- Use a persistent, schema-qualified intermediate table only when data must pass between files and the prompt authorizes it.
- Start a multi-statement transformation with \`BEGIN;\` and end it with \`COMMIT;\` when all statements can safely run in one transaction.
- Use lowercase kebab-case filenames ending in \`.sql\`. Do not put SQL inside Markdown fences.

## Data Purification Rules

- Treat source tables as read-only unless the prompt explicitly authorizes source updates.
- Use only exported identifiers or explicitly requested new temporary, intermediate, or report objects.
- Prefer declared foreign keys. For business matching on non-key columns, document the exact normalization and match rule in SQL comments.
- Normalize values once before repeated matching. Make trimming, case folding, punctuation removal, date parsing, numeric casting, and null/empty handling explicit.
- Prevent accidental many-to-many row multiplication. Deduplicate or aggregate to the intended grain before joining and define deterministic tie-breaking.
- Preserve unmatched records when required and label match status or rejection reason explicitly.
- Use explicit column lists and schema-qualified persistent table names. Do not use \`SELECT *\` in report definitions.
- For large reusable working sets, prefer a temporary table with indexes on match keys; otherwise prefer CTEs.
- Include relevant reconciliation checks: source, matched, unmatched, duplicate, rejected, and final report counts.

## Temporary And Report Tables

- Name temporary tables with a \`tmp_\` prefix and use \`DROP TABLE IF EXISTS pg_temp.<name>\` before creation and after final use so a persistent table cannot be dropped accidentally.
- Temporary tables are working data only and are not pipeline outputs.
- Concrete report tables are persistent outputs. Always schema-qualify them and list columns explicitly.
- Do not assume whether a report is appended, truncated, upserted, dropped and recreated, or atomically swapped. Follow the prompt and ask when the strategy is missing.
- Keep destructive report changes inside a transaction where PostgreSQL permits it. Never drop or truncate source tables.
- Make reruns predictable: prevent duplicate accumulation and leave no temporary objects behind.

## Required Pipeline File Structure

\`\`\`sql
-- xpp:name: 010 - Purify Customer Orders
-- xpp:version: 1
-- xpp:databaseName: ${databaseName}
-- xpp:description: Normalizes and matches customer orders, then refreshes the approved report table.

-- The saved SQL body begins after the four-line metadata block.
-- Purpose: State the business outcome of this executable step.
-- Inputs: List every source, lookup, intermediate, or report table read.
-- Output: Name the persistent report table, or say "result set only".
-- Refresh strategy: append, truncate/reload, upsert, replace, or none.
-- Business rules: Summarize matching precedence, exclusions, and assumptions.

BEGIN;

DROP TABLE IF EXISTS pg_temp.tmp_normalized_orders;

CREATE TEMP TABLE tmp_normalized_orders AS
SELECT
    o.order_id,
    NULLIF(BTRIM(o.customer_code), '') AS customer_code,
    o.order_amount
FROM public.source_orders AS o;

CREATE INDEX ON tmp_normalized_orders (customer_code);

-- Apply the prompt-approved report refresh strategy using explicit columns.
-- Add reconciliation queries or persisted audit results required by the prompt.

DROP TABLE IF EXISTS pg_temp.tmp_normalized_orders;

COMMIT;
\`\`\`

The example identifiers are placeholders, not exported schema identifiers. Replace them with verified identifiers. Keep the four \`xpp\` metadata comments as the first four lines. The description must be one line. Put detailed purpose, inputs, output, refresh strategy, and business rules in regular SQL comments after the metadata block. End every statement with a semicolon.

## Review Checklist

- Every referenced identifier was verified against the exported schema.
- Every join has a declared key or a documented prompt-approved business rule.
- Output grain, duplicate handling, null handling, and tie-breaking are explicit.
- Source tables are not destructively modified.
- Temporary tables are contained within one file and cleaned up.
- Persistent outputs and refresh behavior exactly match the prompt.
- Reconciliation checks explain how source rows became report rows.
- The script is transactional and rerunnable where required.
- Only intended query files changed; generated schema files did not change.
`;
}

function repositoryAgentInstructions(databaseName, databaseSlug) {
    return `# AGENTS.md

## Mission

Write PostgreSQL query files that purify interrelated source data and produce prompt-defined concrete report tables. Follow \`README.md\` as the complete operating contract.

## Saved Query Contract

- Store selected-database queries under \`queries/${databaseSlug}/<query-name>.sql\`. Files under \`queries/unassigned/\` require database-assignment review.
- Use exactly four leading metadata lines in this order: \`xpp:name\`, \`xpp:version\`, \`xpp:databaseName\`, and \`xpp:description\`.
- Everything after those four lines is the stored SQL body. Import saves it without execution; a Run action executes the entire body in one request.
- Numeric filename prefixes document intended order only; the application does not schedule or execute files automatically.

## Required Process

Read \`manifest.json\`, \`schema/catalog.md\`, relevant \`schema/tables/*.sql\`, and related existing query files before writing SQL.

- Treat \`schema/tables/*.sql\` as canonical structure context for \`${databaseName}\`.
- Do not edit generated files under \`schema/\`.
- Create one independently executable file per query or pipeline step under \`queries/${databaseSlug}/\`.
- Use numeric filename and \`xpp:name\` prefixes when steps have an execution order.
- Keep all temporary-table work in the same file and Run action; connections are not shared across runs.
- Treat source tables as read-only unless source updates are explicitly requested.
- Do not invent identifiers, joins, business rules, precedence, thresholds, or report refresh behavior. Ask when ambiguous.
- Make normalization, output grain, null handling, deduplication, tie-breaking, unmatched handling, and reconciliation explicit.
- Schema-qualify persistent objects, use explicit columns, and avoid accidental many-to-many joins.
- Wrap multi-statement transformations in a transaction when safe and make them rerunnable.
- Use the exact four-line \`xpp\` metadata block and documentation header defined in \`README.md\`.
- Do not execute queries or include SQL in Markdown fences.
`;
}

function pathSegment(value) {
    return String(value || "database")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "database";
}
