import { savedQueryFileName, toSavedQuerySqlFile } from "@/lib/saved-query-files";
import { schemaExportFiles } from "@/lib/schema-export";

export function repositoryBundleFiles(schema, savedQueries, generatedAt = new Date()) {
    const databaseSlug = pathSegment(schema.database);
    const queryGroups = groupQueriesByDatabase(savedQueries);
    const stableSchema = { ...schema };
    delete stableSchema.exportedAt;

    const manifest = buildManifest(schema, savedQueries, generatedAt);
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
        ...schemaExportFiles(stableSchema).map((file) => ({
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

function buildManifest(schema, savedQueries, generatedAt) {
    const tables = schema.schemas.flatMap((entry) => entry.tables);
    const unassignedCount = savedQueries.filter(
        (query) => !query.databaseName?.trim()
    ).length;
    const selectedDatabaseQueryCount = savedQueries.filter(
        (query) => query.databaseName?.trim() === schema.database
    ).length;
    const otherDatabaseQueryCount = savedQueries.length - unassignedCount - selectedDatabaseQueryCount;
    const warnings = [];

    if (unassignedCount > 0) {
        warnings.push(`${unassignedCount} query file(s) have no databaseName and require review.`);
    }
    if (otherDatabaseQueryCount > 0) {
        warnings.push(`${otherDatabaseQueryCount} query file(s) target databases other than the exported schema database.`);
    }

    return {
        format: "xpp-repository-bundle",
        version: 1,
        generatedAt: generatedAt.toISOString(),
        database: schema.database,
        canonicalSchema: "schema/database.schema.json",
        schemas: schema.schemas.map((entry) => entry.name),
        counts: {
            tables: tables.filter((table) => table.kind === "table" || table.kind === "partitioned_table").length,
            views: tables.filter((table) => table.kind === "view" || table.kind === "materialized_view").length,
            queries: savedQueries.length,
            selectedDatabaseQueries: selectedDatabaseQueryCount,
            unassignedQueries: unassignedCount,
            otherDatabaseQueries: otherDatabaseQueryCount,
        },
        schemaOptions: schema.options,
        warnings,
    };
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

This repository contains PostgreSQL schema metadata and saved SQL queries for AI-assisted query development.

## Source Of Truth

- \`schema/database.schema.json\` is the canonical database structure for \`${databaseName}\`.
- \`schema/database.schema.md\` and \`schema/tables/\` are generated reading aids.
- Files under \`schema/\` are generated. Do not edit them manually.
- Existing queries are grouped under \`queries/<database>/\` using their \`xpp:databaseName\` metadata.
- Read \`manifest.json\` for export counts, options, and warnings.

## Agent Workflow

Before proposing SQL, read \`manifest.json\`, \`schema/database.schema.json\`, and relevant files under \`schema/tables/\`. Review existing queries for naming and business conventions.

When creating a query for this schema, add one file under \`queries/${databaseSlug}/\`. Use a lowercase kebab-case filename ending in \`.sql\`. Do not put SQL inside Markdown fences.

Use only tables and columns present in the canonical schema. Prefer declared foreign keys for joins. If a relationship is not declared, state the assumption in \`xpp:description\` or ask for clarification. Use explicit selected columns instead of \`SELECT *\`. Generate read-only SQL unless the prompt explicitly requests DML or DDL.

## Required SQL File Structure

\`\`\`sql
-- xpp:name: Customer Order Summary
-- xpp:version: 1
-- xpp:databaseName: ${databaseName}
-- xpp:description: Summarizes order totals for each customer.

SELECT
    c.id,
    c.name,
    SUM(o.total_amount) AS total_order_amount
FROM public.customers AS c
JOIN public.orders AS o
    ON o.customer_id = c.id
GROUP BY
    c.id,
    c.name;
\`\`\`

Keep metadata comments together at the beginning of the file. The required metadata fields are \`name\`, \`version\`, \`databaseName\`, and \`description\`. End executable statements with semicolons. The application imports the SQL as a saved query; importing does not execute it.

## Review Checklist

- Every identifier exists in the exported schema.
- Joins use documented keys or clearly recorded assumptions.
- The query targets the database named in \`xpp:databaseName\`.
- Parameters or variable assumptions are explained in the description.
- Only the intended new or updated query files are changed.
`;
}

function repositoryAgentInstructions(databaseName, databaseSlug) {
    return `# AGENTS.md

## Query Authoring Rules

Read \`README.md\`, \`manifest.json\`, and \`schema/database.schema.json\` before writing SQL.

- Treat \`schema/database.schema.json\` as canonical for \`${databaseName}\`.
- Do not edit generated files under \`schema/\`.
- Create one query per \`.sql\` file under \`queries/${databaseSlug}/\`.
- Follow the exact leading \`-- xpp:*\` metadata structure documented in \`README.md\`.
- Do not invent identifiers or relationships.
- Prefer declared foreign keys for joins and explicit columns in result sets.
- Produce read-only SQL unless the request explicitly requires DML or DDL.
- Do not execute queries or include SQL in Markdown fences.
`;
}

function pathSegment(value) {
    return String(value || "database")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "database";
}
