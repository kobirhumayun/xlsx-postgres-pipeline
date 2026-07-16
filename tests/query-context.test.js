import { describe, expect, it } from "vitest";
import { repositoryBundleFiles } from "@/lib/repository-bundle.js";
import {
  collectDatabaseSchema,
  repositorySchemaFiles,
  schemaCatalog,
  schemaExportFiles,
  schemaMarkdown,
  schemaReadme,
  tableMarkdown,
  tableSql,
} from "@/lib/schema-export.js";
import { fixtureSchema } from "./fixtures/schema.js";

function catalogClient({ tables = [], columns = [], constraints = [], indexes = [], database = "reporting" } = {}) {
  return {
    query: async (sql, params) => {
      if (sql.includes("current_database()")) return { rows: [{ name: database }] };
      if (sql.includes("FROM pg_class c")) return { rows: tables, params };
      if (sql.includes("FROM pg_attribute a")) return { rows: columns, params };
      if (sql.includes("FROM pg_constraint con")) return { rows: constraints, params };
      if (sql.includes("FROM pg_index idx")) return { rows: indexes, params };
      throw new Error(`Unexpected catalog query: ${sql}`);
    },
  };
}

describe("PostgreSQL schema collection", () => {
  it("returns an empty schema and filters system schema selections", async () => {
    const calls = [];
    const client = catalogClient();
    const originalQuery = client.query;
    client.query = async (...args) => {
      calls.push(args);
      return originalQuery(...args);
    };

    const result = await collectDatabaseSchema(client, {
      schemas: [" public ", "pg_catalog", "pg_toast_temp_1", ""],
      includeViews: true,
      includeIndexes: false,
      includeConstraints: false,
      includeRowCounts: false,
    });

    expect(result).toMatchObject({
      database: "reporting",
      schemas: [],
      options: {
        includeViews: true,
        includeIndexes: false,
        includeConstraints: false,
        includeRowCounts: false,
      },
    });
    expect(calls[1][1]).toEqual([["r", "p", "v", "m"], ["public"]]);
    expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
  });

  it("enriches catalog rows with columns, constraints, indexes, and references", async () => {
    const client = catalogClient({
      tables: [{
        oid: 10,
        schema: "public",
        name: "orders",
        kind: "table",
        comment: "Orders",
        estimated_rows: -2.4,
        view_definition: null,
      }],
      columns: [
        { relation_oid: 10, ordinal: 1, name: "id", type: "integer", nullable: false, default_value: null, identity: "a", generated: "", comment: null },
        { relation_oid: 10, ordinal: 2, name: "customer_id", type: "integer", nullable: false, default_value: null, identity: "d", generated: "", comment: "Customer" },
        { relation_oid: 10, ordinal: 3, name: "slug", type: "text", nullable: true, default_value: "lower(name)", identity: "", generated: "s", comment: null },
      ],
      constraints: [
        { relation_oid: 10, name: "orders_pkey", type: "p", definition: "PRIMARY KEY (id)", columns: ["id"], referenced_table: null },
        { relation_oid: 10, name: "orders_customer_fk", type: "f", definition: "FOREIGN KEY (customer_id) REFERENCES public.customers(id)", columns: "{customer_id}", referenced_schema: "public", referenced_table: "customers", referenced_columns: "{id}" },
        { relation_oid: 10, name: "orders_slug_key", type: "u", definition: "UNIQUE (slug)", columns: '{"slug"}', referenced_table: null },
        { relation_oid: 10, name: "orders_check", type: "c", definition: "CHECK (id > 0)", columns: "{}", referenced_table: null },
        { relation_oid: 10, name: "orders_exclude", type: "x", definition: "EXCLUDE ...", columns: "{id,slug}", referenced_table: null },
      ],
      indexes: [{
        relation_oid: 10,
        name: "orders_customer_idx",
        is_unique: false,
        is_primary: false,
        definition: "CREATE INDEX orders_customer_idx ON public.orders (customer_id)",
      }],
    });

    const result = await collectDatabaseSchema(client);
    const table = result.schemas[0].tables[0];
    expect(table).toMatchObject({
      fullName: "public.orders",
      estimatedRows: 0,
      primaryKey: ["id"],
      indexes: [{ name: "orders_customer_idx", isUnique: false, isPrimary: false }],
    });
    expect(table.columns.map(({ identity, generated, primaryKey }) => ({ identity, generated, primaryKey })))
      .toEqual([
        { identity: "always", generated: null, primaryKey: true },
        { identity: "by default", generated: null, primaryKey: false },
        { identity: null, generated: "stored", primaryKey: false },
      ]);
    expect(table.columns[1].references).toEqual([{
      constraint: "orders_customer_fk",
      schema: "public",
      table: "customers",
      columns: ["id"],
    }]);
    expect(table.uniqueConstraints[0].columns).toEqual(["slug"]);
    expect(table.checkConstraints[0].columns).toEqual([]);
  });
});

describe("schema context rendering", () => {
  it("renders table DDL with identity, defaults, constraints, indexes, and comments", () => {
    const sql = tableSql(fixtureSchema().schemas[0].tables[0]);

    expect(sql).toContain('"id" integer GENERATED ALWAYS AS IDENTITY NOT NULL');
    expect(sql).toContain('"total" numeric DEFAULT 0');
    expect(sql).toContain('CONSTRAINT "orders_pkey" PRIMARY KEY (id)');
    expect(sql).toContain('CONSTRAINT "orders_total_key" UNIQUE ("total")');
    expect(sql).toContain("FOREIGN KEY (customer_id) REFERENCES public.customers(id)");
    expect(sql).toContain("CREATE INDEX orders_customer_idx");
    expect(sql).not.toContain("CREATE UNIQUE INDEX orders_pkey");
    expect(sql).toContain("-- id: Primary identifier.");
  });

  it.each(["view", "materialized_view"])("renders an available %s definition", (kind) => {
    const table = fixtureSchema().schemas[0].tables[0];
    const sql = tableSql({
      ...table,
      kind,
      name: "order_totals",
      fullName: "public.order_totals",
      viewDefinition: "SELECT id FROM public.orders;;;\n",
    });

    expect(sql).toContain(`CREATE ${kind === "view" ? "VIEW" : "MATERIALIZED VIEW"} "public"."order_totals" AS`);
    expect(sql).toContain("SELECT id FROM public.orders;");
    expect(sql).not.toContain("orders;;;;");
  });

  it("documents a view whose definition is unavailable", () => {
    const table = fixtureSchema().schemas[0].tables[0];
    expect(tableSql({ ...table, kind: "view", viewDefinition: null }))
      .toContain("View definition is unavailable");
  });

  it("renders readable Markdown and a relationship catalog", () => {
    const schema = fixtureSchema();
    expect(schemaReadme(schema)).toContain("No table data or sample rows are included");
    expect(schemaMarkdown(schema)).toContain("## Schema: public");
    expect(tableMarkdown(schema.schemas[0].tables[0])).toContain("Customer | orders");
    expect(schemaCatalog(schema)).toContain(
      "public.orders(customer_id) -> public.customers(id)",
    );
    expect(schemaCatalog(schema)).toContain("Customer \\| orders for reporting.");
  });

  it("creates compact repository files and full schema export files", () => {
    const schema = fixtureSchema();
    expect(repositorySchemaFiles(schema).map(({ name }) => name)).toEqual([
      "schema/catalog.md", "schema/tables/public-orders.sql",
    ]);
    expect(schemaExportFiles(schema).map(({ name }) => name)).toEqual([
      "schema/README.md",
      "schema/database.schema.json",
      "schema/database.schema.md",
      "schema/tables/public-orders.md",
      "schema/tables/public-orders.sql",
    ]);
  });
});

describe("repository bundle", () => {
  it("contains deterministic schema context, selected queries, and a fingerprint", () => {
    const schema = fixtureSchema();
    const savedQueries = [
      { name: "Sales Report", databaseName: "reporting", description: null, query: "SELECT 1;" },
      { name: "Unassigned", databaseName: null, description: null, query: "SELECT 2;" },
    ];
    const generatedAt = new Date("2026-01-01T00:00:00.000Z");
    const { files, manifest } = repositoryBundleFiles(schema, savedQueries, generatedAt);
    const names = files.map(({ name }) => name);

    expect(names).toContain("queries/reporting/sales-report.sql");
    expect(names).toContain("queries/unassigned/unassigned.sql");
    expect(names).not.toContain("schema/database.schema.json");
    expect(manifest).toMatchObject({
      format: "xpp-repository-bundle",
      version: 1,
      database: "reporting",
      counts: { tables: 1, views: 0, queries: 2, selectedDatabaseQueries: 1, unassignedQueries: 1 },
    });
    expect(manifest.schemaFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.warnings).toEqual(["1 query file(s) have no databaseName and require review."]);

    const readme = files.find(({ name }) => name === "README.md").data;
    const agents = files.find(({ name }) => name === "AGENTS.md").data;
    expect(readme).toMatch(/temporary table must be created, used, and dropped in the same file/i);
    expect(readme).toMatch(/Treat source tables as read-only/i);
    expect(agents).toMatch(/connections are not shared across runs/i);
    expect(agents).toMatch(/Import saves it without execution/i);
  });

  it("produces the same fingerprint when only the generation time changes", () => {
    const first = repositoryBundleFiles(fixtureSchema(), [], new Date("2026-01-01"));
    const second = repositoryBundleFiles(fixtureSchema(), [], new Date("2027-01-01"));
    expect(first.manifest.schemaFingerprint).toBe(second.manifest.schemaFingerprint);
  });
});
