import { describe, expect, it, vi } from "vitest";
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
        estimated_rows: 12.4,
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
      estimatedRows: 12,
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

describe("schema row count fallback", () => {
  function rowCountClient(tables, count = async () => ({ rows: [{ row_count: "29" }] })) {
    const catalog = catalogClient({ tables });
    return {
      query: vi.fn(async (sql, params) => {
        if (sql === "BEGIN READ ONLY" || sql === "ROLLBACK" || sql.includes("set_config")) {
          return { rows: [] };
        }
        if (sql.startsWith("SELECT count(*)")) return count(sql);
        return catalog.query(sql, params);
      }),
    };
  }

  function relation(name, estimated_rows, kind = "table") {
    return { oid: name, schema: "public", name, kind, estimated_rows };
  }

  it("counts unknown ordinary tables while preserving valid estimates and real zeroes", async () => {
    const client = rowCountClient([
      relation("paid_prc_al_arafah_prev_was_process", -1),
      relation("sub_prc_al_arafah_process", -1),
      relation("known", 86.4),
      relation("empty", 0),
    ], async (sql) => ({ rows: [{ row_count: sql.includes("paid_prc") ? "29" : "30" }] }));
    const result = await collectDatabaseSchema(client);
    expect(result.schemas[0].tables.map(({ estimatedRows, rowCountSource }) => [estimatedRows, rowCountSource]))
      .toEqual([[29, "count"], [30, "count"], [86, "catalog"], [0, "catalog"]]);
    expect(client.query.mock.calls.filter(([sql]) => sql.startsWith("SELECT count(*)"))).toHaveLength(2);
    expect(schemaCatalog(result)).toContain("public.sub_prc_al_arafah_process | table | 30 |");
    expect(client.query.mock.calls.filter(([sql]) => sql === "ROLLBACK")).toHaveLength(2);
    expect(client.query.mock.calls.find(([sql]) => sql.includes("set_config"))[1]).toEqual(["2000ms"]);
  });

  it.each(["57014", "42501", "42P01"])("exports unknown and cleans up after PostgreSQL error %s", async (code) => {
    const client = rowCountClient([relation("unavailable", -1)], async () => {
      throw Object.assign(new Error("Count unavailable"), { code });
    });
    const result = await collectDatabaseSchema(client);
    const table = result.schemas[0].tables[0];
    expect(table).toMatchObject({ estimatedRows: null, rowCountSource: "unknown" });
    expect(schemaCatalog(result)).toContain("public.unavailable | table | unknown |");
    expect(tableMarkdown(table)).toContain("Estimated rows: unknown");
    const calls = client.query.mock.calls.map(([sql]) => sql);
    expect(calls.indexOf("ROLLBACK")).toBeGreaterThan(calls.findIndex((sql) => sql.startsWith("SELECT count(*)")));
    expect(calls.indexOf("ROLLBACK")).toBeLessThan(calls.findIndex((sql) => sql.includes("FROM pg_attribute a")));
  });

  it("propagates unexpected database failures after rolling back", async () => {
    const client = rowCountClient([relation("broken", -1)], async () => {
      throw Object.assign(new Error("Connection lost"), { code: "08006" });
    });
    await expect(collectDatabaseSchema(client)).rejects.toThrow("Connection lost");
    expect(client.query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
  });

  it("does not count when row counts are disabled or execute unknown views and partitioned parents", async () => {
    const disabled = rowCountClient([relation("ordinary", -1)]);
    const result = await collectDatabaseSchema(disabled, { includeRowCounts: false });
    expect(result.schemas[0].tables[0]).toMatchObject({ estimatedRows: null, rowCountSource: "omitted" });
    expect(schemaCatalog(result)).not.toContain("unknown");
    expect(tableMarkdown(result.schemas[0].tables[0])).not.toContain("Estimated rows:");
    const otherKinds = rowCountClient([
      relation("view", -1, "view"),
      relation("materialized", -1, "materialized_view"),
      relation("partitioned", -1, "partitioned_table"),
    ]);
    const others = await collectDatabaseSchema(otherKinds, { includeViews: true });
    expect(others.schemas[0].tables.every((table) => table.rowCountSource === "unknown")).toBe(true);
    for (const client of [disabled, otherKinds]) {
      expect(client.query.mock.calls.some(([sql]) => sql === "BEGIN READ ONLY")).toBe(false);
    }
  });

  it("quotes identifiers in the fallback and treats missing estimates as unknown", async () => {
    const client = rowCountClient([{ ...relation('a"b', null), schema: 's"c' }]);
    await collectDatabaseSchema(client);
    expect(client.query).toHaveBeenCalledWith('SELECT count(*) AS row_count FROM ONLY "s""c"."a""b"');
  });

  it("stops starting counts when the shared five-second budget expires", async () => {
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const client = rowCountClient([relation("first", -1), relation("second", -1)], async () => {
      now = 5001;
      throw Object.assign(new Error("Timed out"), { code: "57014" });
    });
    const result = await collectDatabaseSchema(client);
    expect(result.schemas[0].tables.map((table) => table.rowCountSource)).toEqual(["unknown", "unknown"]);
    expect(client.query.mock.calls.filter(([sql]) => sql.startsWith("SELECT count(*)"))).toHaveLength(1);
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
