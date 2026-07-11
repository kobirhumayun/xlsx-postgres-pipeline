import assert from "node:assert/strict";
import test from "node:test";
import {
    parseSavedQuerySqlFile,
    toSavedQuerySqlFile,
} from "../src/lib/saved-query-files.js";
import {
    expandSavedQueryImportFiles,
    planSavedQueryImport,
} from "../src/lib/saved-query-import.js";
import { repositoryBundleFiles } from "../src/lib/repository-bundle.js";
import { tableSql } from "../src/lib/schema-export.js";
import { createZip, createZipStream, readZipTextFiles } from "../src/lib/zip.js";

test("saved query files round trip with required versioned metadata", () => {
    const content = toSavedQuerySqlFile({
        name: "Customer Summary",
        databaseName: "reporting",
        description: "Customer totals.",
        query: "SELECT 1;",
    });

    assert.match(content, /^-- xpp:name: Customer Summary\n-- xpp:version: 1\n-- xpp:databaseName: reporting\n-- xpp:description: Customer totals\./);
    assert.deepEqual(
        parseSavedQuerySqlFile(content, "customer-summary.sql", { requireMetadata: true }),
        {
            name: "Customer Summary",
            databaseName: "reporting",
            description: "Customer totals.",
            query: "SELECT 1;",
        }
    );
    assert.throws(
        () => parseSavedQuerySqlFile("CREATE TABLE example (id int);", "example.sql", { requireMetadata: true }),
        /Missing required metadata/
    );
});

test("saved query import identity includes database name", async () => {
    const queryFile = (databaseName) => ({
        name: `${databaseName}.sql`,
        text: async () => toSavedQuerySqlFile({
            name: "Daily Summary",
            databaseName,
            description: "Daily totals.",
            query: "SELECT 1;",
        }),
    });
    const existing = [{ id: "one", name: "Daily Summary", databaseName: "sales" }];

    const plan = await planSavedQueryImport([
        queryFile("sales"),
        queryFile("reporting"),
    ], existing, "upsert");

    assert.deepEqual(plan.operations.map((operation) => operation.action), ["updated", "created"]);
});

test("replace mode is limited to imported database scopes", async () => {
    const content = toSavedQuerySqlFile({
        name: "Replacement",
        databaseName: "sales",
        description: "Replacement query.",
        query: "SELECT 1;",
    });
    const existing = [
        { id: "sales", name: "Old Sales", databaseName: "sales" },
        { id: "reporting", name: "Old Reporting", databaseName: "reporting" },
    ];
    const plan = await planSavedQueryImport([{
        name: "replacement.sql",
        text: async () => content,
    }], existing, "replace");

    assert.equal(plan.replaceCount, 1);
    assert.deepEqual(plan.replaceDatabaseNames, ["sales"]);
});

test("repository ZIP import reads only queries directory SQL files", async () => {
    const query = toSavedQuerySqlFile({
        name: "Valid Query",
        databaseName: "reporting",
        description: "A valid query.",
        query: "SELECT 1;",
    });
    const zip = createZip([
        { name: "queries/reporting/valid-query.sql", data: query },
        { name: "schema/tables/public-example.sql", data: "CREATE TABLE example (id int);" },
    ]);
    const files = await expandSavedQueryImportFiles([{
        name: "repository.zip",
        arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
    }]);

    assert.equal(files.length, 1);
    assert.equal(files[0].name, "queries/reporting/valid-query.sql");
});

test("ZIP export streams a compressed readable archive", async () => {
    const stream = createZipStream([{
        name: "queries/reporting/example.sql",
        data: "SELECT 1;\n".repeat(100),
    }]);
    const archive = new Uint8Array(await new Response(stream).arrayBuffer());
    const files = readZipTextFiles(archive);

    assert.equal(files[0].name, "queries/reporting/example.sql");
    assert.ok(archive.byteLength < files[0].text.length);
});

test("repository bundle uses compact schema files and a fingerprint", () => {
    const schema = fixtureSchema();
    const { files, manifest } = repositoryBundleFiles(schema, [], new Date("2026-01-01T00:00:00.000Z"));
    const names = files.map((file) => file.name);

    assert.ok(names.includes("schema/catalog.md"));
    assert.ok(names.includes("schema/tables/public-example.sql"));
    assert.ok(!names.includes("schema/database.schema.json"));
    assert.ok(!names.some((name) => name.endsWith(".md") && name.startsWith("schema/tables/")));
    assert.match(manifest.schemaFingerprint, /^[a-f0-9]{64}$/);
});

test("table context emits valid identity and view clauses", () => {
    const table = fixtureSchema().schemas[0].tables[0];
    assert.match(tableSql(table), /GENERATED ALWAYS AS IDENTITY/);

    assert.match(tableSql({
        ...table,
        name: "example_view",
        fullName: "public.example_view",
        kind: "view",
        viewDefinition: "SELECT id FROM public.example",
    }), /CREATE VIEW "public"\."example_view" AS/);
});

function fixtureSchema() {
    return {
        database: "reporting",
        exportedAt: "2026-01-01T00:00:00.000Z",
        options: {
            includeViews: true,
            includeIndexes: true,
            includeConstraints: true,
            includeRowCounts: true,
        },
        schemas: [{
            name: "public",
            tables: [{
                schema: "public",
                name: "example",
                fullName: "public.example",
                kind: "table",
                comment: "Example records.",
                estimatedRows: 10,
                columns: [{
                    ordinal: 1,
                    name: "id",
                    type: "integer",
                    nullable: false,
                    default: null,
                    identity: "always",
                    generated: null,
                    comment: "Primary identifier.",
                    primaryKey: true,
                    references: [],
                }],
                primaryKey: ["id"],
                primaryKeyConstraint: {
                    name: "example_pkey",
                    definition: "PRIMARY KEY (id)",
                },
                foreignKeys: [],
                uniqueConstraints: [],
                checkConstraints: [],
                indexes: [],
                viewDefinition: null,
            }],
        }],
    };
}
