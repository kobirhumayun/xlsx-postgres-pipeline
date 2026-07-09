const SYSTEM_SCHEMAS = ["information_schema", "pg_catalog"];

export async function collectDatabaseSchema(client, options = {}) {
    const includeViews = options.includeViews === true;
    const includeIndexes = options.includeIndexes !== false;
    const includeConstraints = options.includeConstraints !== false;
    const includeRowCounts = options.includeRowCounts !== false;
    const schemas = normalizeSchemas(options.schemas);
    const databaseResult = await client.query("SELECT current_database() AS name");
    const databaseName = databaseResult.rows[0]?.name || options.databaseName || "database";
    const tables = await fetchTables(client, { schemas, includeViews, includeRowCounts });
    const relationOids = tables.map((table) => table.oid);

    if (tables.length === 0) {
        return {
            database: databaseName,
            exportedAt: new Date().toISOString(),
            options: { includeViews, includeIndexes, includeConstraints, includeRowCounts },
            schemas: [],
        };
    }

    const [columns, constraints, indexes] = await Promise.all([
        fetchColumns(client, relationOids),
        includeConstraints ? fetchConstraints(client, relationOids) : Promise.resolve([]),
        includeIndexes ? fetchIndexes(client, relationOids) : Promise.resolve([]),
    ]);

    const columnsByRelation = groupBy(columns, "relationOid");
    const constraintsByRelation = groupBy(constraints, "relationOid");
    const indexesByRelation = groupBy(indexes, "relationOid");
    const schemaMap = new Map();

    for (const table of tables) {
        const tableColumns = columnsByRelation.get(table.oid) || [];
        const tableConstraints = constraintsByRelation.get(table.oid) || [];
        const primaryKey = tableConstraints.find((constraint) => constraint.type === "primary_key");
        const foreignKeys = tableConstraints.filter((constraint) => constraint.type === "foreign_key");
        const uniqueConstraints = tableConstraints.filter((constraint) => constraint.type === "unique");
        const checkConstraints = tableConstraints.filter((constraint) => constraint.type === "check");
        const relationIndexes = indexesByRelation.get(table.oid) || [];
        const primaryKeyColumns = primaryKey?.columns || [];

        const enrichedColumns = tableColumns.map((column) => {
            const references = foreignKeys
                .filter((foreignKey) => foreignKey.columns.includes(column.name))
                .map((foreignKey) => ({
                    constraint: foreignKey.name,
                    schema: foreignKey.references.schema,
                    table: foreignKey.references.table,
                    columns: foreignKey.references.columns,
                }));

            return {
                ...column,
                primaryKey: primaryKeyColumns.includes(column.name),
                references,
            };
        });

        const schema = schemaMap.get(table.schema) || {
            name: table.schema,
            tables: [],
        };

        schema.tables.push({
            schema: table.schema,
            name: table.name,
            fullName: `${table.schema}.${table.name}`,
            kind: table.kind,
            comment: table.comment,
            estimatedRows: includeRowCounts ? Math.max(0, Math.round(table.estimatedRows || 0)) : null,
            columns: enrichedColumns,
            primaryKey: primaryKeyColumns,
            primaryKeyConstraint: primaryKey || null,
            foreignKeys,
            uniqueConstraints,
            checkConstraints,
            indexes: relationIndexes,
            viewDefinition: table.viewDefinition,
        });

        schemaMap.set(table.schema, schema);
    }

    return {
        database: databaseName,
        exportedAt: new Date().toISOString(),
        options: { includeViews, includeIndexes, includeConstraints, includeRowCounts },
        schemas: [...schemaMap.values()],
    };
}

export function schemaReadme(schema) {
    return [
        "# Database Schema Export",
        "",
        `Database: ${schema.database}`,
        `Exported at: ${schema.exportedAt}`,
        "",
        "This folder contains metadata-only database structure context for humans and AI agents.",
        "No table data or sample rows are included.",
        "",
        "Files:",
        "",
        "- `database.schema.json`: canonical machine-readable schema metadata.",
        "- `database.schema.md`: AI-friendly database overview.",
        "- `tables/*.md`: per-table Markdown summaries.",
        "- `tables/*.sql`: approximate DDL context for reading, not restore-grade dumps.",
        "",
    ].join("\n");
}

export function schemaMarkdown(schema) {
    const lines = [
        `# Database Schema: ${schema.database}`,
        "",
        `Exported at: ${schema.exportedAt}`,
        "",
        "This export contains metadata only. It does not include table data.",
        "",
    ];

    for (const schemaEntry of schema.schemas) {
        lines.push(`## Schema: ${schemaEntry.name}`, "");

        for (const table of schemaEntry.tables) {
            appendTableMarkdown(lines, table, 3);
        }
    }

    return lines.join("\n");
}

export function tableMarkdown(table) {
    const lines = [];
    appendTableMarkdown(lines, table, 1);
    return lines.join("\n");
}

export function tableSql(table) {
    if (table.kind === "view" || table.kind === "materialized_view") {
        return [
            `-- ${table.fullName}`,
            `-- ${table.kind.replace("_", " ")}`,
            "",
            table.viewDefinition
                ? `${table.viewDefinition.trimEnd()};`
                : `-- View definition is unavailable for ${table.fullName}.`,
            "",
        ].join("\n");
    }

    const definitions = table.columns.map((column) => {
        const parts = [quoteIdent(column.name), column.type];
        if (column.generated) parts.push(`GENERATED ${column.generated}`);
        if (column.identity) parts.push(`IDENTITY ${column.identity}`);
        if (column.default) parts.push(`DEFAULT ${column.default}`);
        if (!column.nullable) parts.push("NOT NULL");
        return `    ${parts.join(" ")}`;
    });

    if (table.primaryKeyConstraint) {
        definitions.push(`    CONSTRAINT ${quoteIdent(table.primaryKeyConstraint.name)} ${table.primaryKeyConstraint.definition}`);
    }

    for (const constraint of table.uniqueConstraints) {
        definitions.push(`    CONSTRAINT ${quoteIdent(constraint.name)} UNIQUE (${constraint.columns.map(quoteIdent).join(", ")})`);
    }

    for (const constraint of table.foreignKeys) {
        definitions.push(`    CONSTRAINT ${quoteIdent(constraint.name)} ${constraint.definition}`);
    }

    for (const constraint of table.checkConstraints) {
        definitions.push(`    CONSTRAINT ${quoteIdent(constraint.name)} ${constraint.definition}`);
    }

    const lines = [
        `-- ${table.fullName}`,
        "-- Approximate schema context generated from PostgreSQL catalogs.",
        "",
        `CREATE TABLE ${quoteIdent(table.schema)}.${quoteIdent(table.name)} (`,
        definitions.join(",\n"),
        ");",
        "",
    ];

    for (const index of table.indexes) {
        if (!index.isPrimary) {
            lines.push(`${index.definition};`);
        }
    }

    lines.push("");
    return lines.join("\n");
}

export function schemaExportFiles(schema) {
    const files = [
        { name: "schema/README.md", data: schemaReadme(schema) },
        { name: "schema/database.schema.json", data: `${JSON.stringify(schema, null, 2)}\n` },
        { name: "schema/database.schema.md", data: schemaMarkdown(schema) },
    ];

    const usedNames = new Set();

    for (const schemaEntry of schema.schemas) {
        for (const table of schemaEntry.tables) {
            const baseName = uniqueFileBase(`${table.schema}.${table.name}`, usedNames);
            files.push({
                name: `schema/tables/${baseName}.md`,
                data: tableMarkdown(table),
            });
            files.push({
                name: `schema/tables/${baseName}.sql`,
                data: tableSql(table),
            });
        }
    }

    return files;
}

function appendTableMarkdown(lines, table, headingLevel) {
    const heading = "#".repeat(headingLevel);
    lines.push(`${heading} ${table.fullName}`, "");

    if (table.comment) {
        lines.push(table.comment, "");
    }

    lines.push(`Kind: ${table.kind}`);
    if (table.estimatedRows !== null) {
        lines.push(`Estimated rows: ${table.estimatedRows}`);
    }
    lines.push("");
    lines.push("| Column | Type | Nullable | Default | Notes |");
    lines.push("| --- | --- | --- | --- | --- |");

    for (const column of table.columns) {
        const notes = [];
        if (column.primaryKey) notes.push("primary key");
        if (column.identity) notes.push(`identity ${column.identity}`);
        if (column.generated) notes.push(`generated ${column.generated}`);
        for (const reference of column.references) {
            notes.push(`FK to ${reference.schema}.${reference.table}.${reference.columns.join(", ")}`);
        }

        lines.push([
            escapeMarkdownCell(column.name),
            escapeMarkdownCell(column.type),
            column.nullable ? "yes" : "no",
            escapeMarkdownCell(column.default || ""),
            escapeMarkdownCell(notes.join("; ")),
        ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
    }

    lines.push("");

    if (table.primaryKey.length > 0) {
        lines.push(`Primary key: ${table.primaryKey.join(", ")}`, "");
    }

    if (table.foreignKeys.length > 0) {
        lines.push("Foreign keys:");
        for (const foreignKey of table.foreignKeys) {
            lines.push(`- ${foreignKey.name}: ${foreignKey.columns.join(", ")} -> ${foreignKey.references.schema}.${foreignKey.references.table}.${foreignKey.references.columns.join(", ")}`);
        }
        lines.push("");
    }

    if (table.indexes.length > 0) {
        lines.push("Indexes:");
        for (const index of table.indexes) {
            lines.push(`- ${index.name}${index.isUnique ? " unique" : ""}: ${index.definition}`);
        }
        lines.push("");
    }

    if (table.checkConstraints.length > 0) {
        lines.push("Checks:");
        for (const check of table.checkConstraints) {
            lines.push(`- ${check.name}: ${check.definition}`);
        }
        lines.push("");
    }
}

async function fetchTables(client, { schemas, includeViews, includeRowCounts }) {
    const relKinds = includeViews ? ["r", "p", "v", "m"] : ["r", "p"];
    const params = [relKinds];
    const schemaFilter = schemas.length > 0
        ? `AND n.nspname = ANY($${params.push(schemas)}::text[])`
        : "AND n.nspname NOT IN ('information_schema', 'pg_catalog') AND n.nspname NOT LIKE 'pg_toast%'";

    const result = await client.query(
        `
        SELECT
            c.oid,
            n.nspname AS schema,
            c.relname AS name,
            c.relkind,
            CASE c.relkind
                WHEN 'r' THEN 'table'
                WHEN 'p' THEN 'partitioned_table'
                WHEN 'v' THEN 'view'
                WHEN 'm' THEN 'materialized_view'
                ELSE c.relkind::text
            END AS kind,
            obj_description(c.oid, 'pg_class') AS comment,
            ${includeRowCounts ? "c.reltuples" : "NULL"} AS estimated_rows,
            CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) ELSE NULL END AS view_definition
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind::text = ANY($1::text[])
          ${schemaFilter}
        ORDER BY n.nspname, c.relname
        `,
        params
    );

    return result.rows.map((row) => ({
        oid: row.oid,
        schema: row.schema,
        name: row.name,
        kind: row.kind,
        comment: row.comment || null,
        estimatedRows: row.estimated_rows,
        viewDefinition: row.view_definition || null,
    }));
}

async function fetchColumns(client, relationOids) {
    const result = await client.query(
        `
        SELECT
            a.attrelid AS relation_oid,
            a.attnum AS ordinal,
            a.attname AS name,
            pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
            NOT a.attnotnull AS nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS default_value,
            a.attidentity AS identity,
            a.attgenerated AS generated,
            col_description(a.attrelid, a.attnum) AS comment
        FROM pg_attribute a
        LEFT JOIN pg_attrdef ad
          ON ad.adrelid = a.attrelid
         AND ad.adnum = a.attnum
        WHERE a.attrelid = ANY($1::oid[])
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attrelid, a.attnum
        `,
        [relationOids]
    );

    return result.rows.map((row) => ({
        relationOid: row.relation_oid,
        ordinal: row.ordinal,
        name: row.name,
        type: row.type,
        nullable: row.nullable,
        default: row.default_value || null,
        identity: identityLabel(row.identity),
        generated: generatedLabel(row.generated),
        comment: row.comment || null,
    }));
}

async function fetchConstraints(client, relationOids) {
    const result = await client.query(
        `
        SELECT
            con.oid,
            con.conrelid AS relation_oid,
            con.conname AS name,
            con.contype AS type,
            pg_get_constraintdef(con.oid, true) AS definition,
            ns_ref.nspname AS referenced_schema,
            rel_ref.relname AS referenced_table,
            COALESCE(cols.columns, ARRAY[]::text[]) AS columns,
            COALESCE(ref_cols.columns, ARRAY[]::text[]) AS referenced_columns
        FROM pg_constraint con
        LEFT JOIN pg_class rel_ref ON rel_ref.oid = con.confrelid
        LEFT JOIN pg_namespace ns_ref ON ns_ref.oid = rel_ref.relnamespace
        LEFT JOIN LATERAL (
            SELECT array_agg(att.attname ORDER BY key_order.ordinality) AS columns
            FROM unnest(con.conkey) WITH ORDINALITY AS key_order(attnum, ordinality)
            JOIN pg_attribute att
              ON att.attrelid = con.conrelid
             AND att.attnum = key_order.attnum
        ) cols ON true
        LEFT JOIN LATERAL (
            SELECT array_agg(att.attname ORDER BY key_order.ordinality) AS columns
            FROM unnest(con.confkey) WITH ORDINALITY AS key_order(attnum, ordinality)
            JOIN pg_attribute att
              ON att.attrelid = con.confrelid
             AND att.attnum = key_order.attnum
        ) ref_cols ON true
        WHERE con.conrelid = ANY($1::oid[])
        ORDER BY con.conrelid, con.conname
        `,
        [relationOids]
    );

    return result.rows.map((row) => ({
        relationOid: row.relation_oid,
        name: row.name,
        type: constraintType(row.type),
        definition: row.definition,
        columns: row.columns || [],
        references: row.referenced_table
            ? {
                schema: row.referenced_schema,
                table: row.referenced_table,
                columns: row.referenced_columns || [],
            }
            : null,
    }));
}

async function fetchIndexes(client, relationOids) {
    const result = await client.query(
        `
        SELECT
            idx.indrelid AS relation_oid,
            cls.relname AS name,
            idx.indisunique AS is_unique,
            idx.indisprimary AS is_primary,
            pg_get_indexdef(idx.indexrelid) AS definition
        FROM pg_index idx
        JOIN pg_class cls ON cls.oid = idx.indexrelid
        WHERE idx.indrelid = ANY($1::oid[])
        ORDER BY idx.indrelid, cls.relname
        `,
        [relationOids]
    );

    return result.rows.map((row) => ({
        relationOid: row.relation_oid,
        name: row.name,
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
        definition: row.definition,
    }));
}

function normalizeSchemas(schemas) {
    if (!Array.isArray(schemas)) return [];

    return schemas
        .map((schema) => String(schema || "").trim())
        .filter((schema) => schema && !SYSTEM_SCHEMAS.includes(schema) && !schema.startsWith("pg_toast"));
}

function groupBy(items, key) {
    const groups = new Map();

    for (const item of items) {
        const groupKey = item[key];
        const group = groups.get(groupKey) || [];
        group.push(item);
        groups.set(groupKey, group);
    }

    return groups;
}

function constraintType(type) {
    return {
        p: "primary_key",
        f: "foreign_key",
        u: "unique",
        c: "check",
        x: "exclude",
    }[type] || type;
}

function identityLabel(identity) {
    if (identity === "a") return "always";
    if (identity === "d") return "by default";
    return null;
}

function generatedLabel(generated) {
    if (generated === "s") return "stored";
    return null;
}

function quoteIdent(identifier) {
    return `"${String(identifier).replace(/"/g, '""')}"`;
}

function uniqueFileBase(value, usedNames) {
    const base = slugify(value);
    let filename = base;
    let suffix = 2;

    while (usedNames.has(filename)) {
        filename = `${base}-${suffix}`;
        suffix += 1;
    }

    usedNames.add(filename);
    return filename;
}

function slugify(value) {
    return String(value || "table")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "table";
}

function escapeMarkdownCell(value) {
    return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}
