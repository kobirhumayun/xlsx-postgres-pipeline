// Self-contained Docker test: no .env, cloud connection, or existing database.
// Build xlsx-postgres-pipeline-backup first, then run this script with Node.
// Add --app after building the app image to test startup and HTTP endpoints too.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";

const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const label = "xpp.version-test";
const network = `xpp-versions-${stamp}`;
const password = randomBytes(24).toString("hex");
const temp = await mkdtemp(path.join(os.tmpdir(), "xpp-versions-"));
const servers = new Map();
const archives = new Map();
let networkCreated = false;
let app;
const fixture = `CREATE TYPE public.state AS ENUM ('ready','done');
CREATE TABLE public.parent (id serial PRIMARY KEY, label text NOT NULL, state public.state DEFAULT 'ready');
INSERT INTO public.parent (label) VALUES ('alpha'), ('beta'), ('gamma');
CREATE SCHEMA reporting;
CREATE TABLE reporting.child (id integer PRIMARY KEY, parent_id integer REFERENCES public.parent(id), quantity integer CHECK (quantity >= 0));
INSERT INTO reporting.child VALUES (1,1,5);
CREATE INDEX ON reporting.child(parent_id);
CREATE TABLE reporting."odd""table" (value integer);
INSERT INTO reporting."odd""table" VALUES (1),(2);
CREATE MATERIALIZED VIEW reporting.totals AS SELECT count(*) FROM public.parent;
CREATE VIEW public.summary AS SELECT count(*) AS total FROM public.parent;
CREATE FUNCTION public.answer() RETURNS integer LANGUAGE sql AS 'SELECT 42';`;
const snapshot = `SELECT json_build_object(
'rows',(SELECT json_agg(p ORDER BY id) FROM public.parent p),
'children',(SELECT json_agg(c ORDER BY id) FROM reporting.child c),
'view',(SELECT total FROM public.summary),'function',public.answer())::text;`;

function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 180000, ...options });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr };
}
function ok(result) { assert.equal(result.status, 0, result.output); return result.stdout.trim(); }
function sql(major, database, text) {
  return ok(docker(["exec", "-i", servers.get(major), "psql", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], { input: text }));
}
function run(script, source, target, database, directory, filename, mode = "empty") {
  const env = {
    ...process.env,
    BACKUP_DATABASE_URL: `postgresql://postgres:${password}@pg${source}:5432/source${source}?schema=public`,
    RESTORE_DATABASE_URL: `postgresql://migration_user:${password}@pg${target}:5432/${database}`,
    BACKUP_DIR: "/work", RESTORE_MODE: mode, RETENTION_DAYS: "7",
  };
  return docker(["run", "--rm", "--network", network, "--entrypoint", "bash",
    "--mount", `type=bind,src=${directory},dst=/work`,
    ...["BACKUP_DATABASE_URL", "RESTORE_DATABASE_URL", "BACKUP_DIR", "RESTORE_MODE", "RETENTION_DAYS"].flatMap(key => ["-e", key]),
    "xlsx-postgres-pipeline-backup", `/usr/local/bin/${script}.sh`, ...(filename ? [`/work/${filename}`] : []),
  ], { env });
}

try {
  ok(docker(["network", "create", "--label", `${label}=${stamp}`, network]));
  networkCreated = true;
  for (const major of [16, 17, 18]) {
    console.log(`Starting isolated PostgreSQL ${major}...`);
    ok(docker(["pull", `postgres:${major}`]));
    const id = ok(docker(["run", "-d", "--label", `${label}=${stamp}`, "--network", network, "--network-alias", `pg${major}`,
      "-e", "POSTGRES_PASSWORD", `postgres:${major}`], { env: { ...process.env, POSTGRES_PASSWORD: password } }));
    servers.set(major, id);
    let ready = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      if (docker(["exec", id, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.ok(ready, `PostgreSQL ${major} did not become ready`);
    sql(major, "postgres", `CREATE ROLE migration_user LOGIN PASSWORD '${password}'; CREATE DATABASE source${major};`);
    sql(major, `source${major}`, fixture);
    const directory = path.join(temp, String(major)); await mkdir(directory);
    const output = ok(run("backup", major, major, "unused", directory));
    assert.match(output, new RegExp(`Using pg_dump ${major} for PostgreSQL source ${major}`));
    const filename = (await readdir(directory)).find(name => /^backup_.*\.sql\.gz$/.test(name)); assert.ok(filename);
    const dump = gunzipSync(await readFile(path.join(directory, filename))).toString("utf8");
    assert.match(dump, new RegExp(`-- Dumped by pg_dump version ${major}\\.`));
    assert.doesNotMatch(dump, /^.*OWNER TO |^(GRANT|REVOKE) /m);
    archives.set(major, { directory, filename, dump });
  }

  for (const [source, target] of [[16,16], [16,17], [16,18], [17,17], [17,18], [18,18]]) {
    const database = `target_${source}_${target}`;
    sql(target, "postgres", `CREATE DATABASE ${database} OWNER migration_user;`);
    const { directory, filename, dump } = archives.get(source);
    const restored = run("restore", source, target, database, directory, filename);
    const output = ok(restored);
    assert.doesNotMatch(restored.output, /WARNING:|permission denied to analyze/);
    assert.match(output, new RegExp(`Using psql ${target} for PostgreSQL target ${target}`));
    assert.deepEqual(JSON.parse(sql(target, database, snapshot)), JSON.parse(sql(source, `source${source}`, snapshot)));
    assert.equal(sql(target, database, "SELECT reltuples FROM pg_class WHERE oid='public.parent'::regclass;"), "3");
    assert.equal(sql(target, database, `SELECT reltuples FROM pg_class WHERE oid='reporting."odd""table"'::regclass;`), "2");
    assert.equal(sql(target, database, "SELECT reltuples FROM pg_class WHERE oid='reporting.totals'::regclass;"), "1");
    // Sequence, ownership, and grants must work for the non-superuser target role.
    sql(target, database, "SET ROLE migration_user; INSERT INTO public.parent(label) VALUES ('delta');");
    assert.equal(sql(target, database, "SELECT id FROM public.parent WHERE label='delta';"), "4");
    console.log(`PASS PostgreSQL ${source} -> ${target}: matching clients, restricted role, data, types, FK/index, sequence, view/function, statistics.`);
    if (source === 16 && target === 18) {
      const blocked = run("restore", source, target, database, directory, filename);
      assert.notEqual(blocked.status, 0); assert.match(blocked.output, /target contains user objects/);
      await writeFile(path.join(directory, "broken.sql.gz"), gzipSync(dump + "\nSELECT 1/0;\n"));
      const failed = run("restore", source, target, database, directory, "broken.sql.gz", "replace");
      assert.notEqual(failed.status, 0); assert.match(failed.output, /division by zero/);
      assert.equal(sql(target, database, "SELECT count(*) FROM public.parent;"), "4");
      ok(run("restore", source, target, database, directory, filename, "replace"));
      assert.equal(sql(target, database, "SELECT count(*) FROM public.parent;"), "3");
      console.log("PASS 16 -> 18: occupied target blocked, failed replacement rolled back, explicit replacement succeeded.");
    }
  }
  sql(16, "postgres", "CREATE DATABASE downgrade_test OWNER migration_user;");
  const { directory, filename } = archives.get(18);
  const blocked = run("restore", 18, 16, "downgrade_test", directory, filename);
  assert.notEqual(blocked.status, 0); assert.match(blocked.output, /are incompatible/);
  assert.equal(sql(16, "downgrade_test", "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public';"), "0");
  console.log("PASS 18 -> 16: downgrade rejected before SQL changes.");

  if (process.argv.includes("--app")) {
    sql(18, "postgres", "CREATE DATABASE app_test; CREATE DATABASE http_restore_target;");
    const env = { ...process.env,
      DATABASE_URL: `postgresql://postgres:${password}@pg18:5432/app_test?schema=public`,
      BACKUP_DATABASE_URL: `postgresql://postgres:${password}@pg18:5432/app_test?schema=public`,
      RESTORE_DATABASE_URL: `postgresql://postgres:${password}@pg18:5432/http_restore_target`,
    };
    app = ok(docker(["run", "-d", "--label", `${label}=${stamp}`, "--network", network,
      ...["DATABASE_URL", "BACKUP_DATABASE_URL", "RESTORE_DATABASE_URL"].flatMap(key => ["-e", key]),
      "xlsx-postgres-pipeline-app"], { env }));
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const check = docker(["exec", app, "node", "-e", "fetch('http://'+process.env.HOSTNAME+':3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]);
      if (check.status === 0) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.ok(ready, "Isolated app did not become ready");
    ok(docker(["exec", "-i", app, "node"], { input: `
const assert=require('node:assert/strict');
(async()=>{
 const origin='http://'+process.env.HOSTNAME+':3000';
 const backup=await fetch(origin+'/api/backup',{method:'POST'});const b=await backup.json();
 assert.equal(backup.status,200,JSON.stringify(b));assert.match(b.output,/Using pg_dump 18/);
 const restore=await fetch(origin+'/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:b.backups[0].name,confirmationToken:'RESTORE',mode:'empty'})});
 const r=await restore.json();assert.equal(restore.status,200,JSON.stringify(r));assert.match(r.output,/Using psql 18/);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
` }));
    assert.equal(sql(18, "http_restore_target", 'SELECT count(*) FROM public."_prisma_migrations";'),
      sql(18, "app_test", 'SELECT count(*) FROM public."_prisma_migrations";'));
    console.log("PASS isolated app: PostgreSQL 18 migrations/startup, HTTP backup/restore, and automatic client selection.");
  }
} finally {
  for (const id of [...(app ? [app] : []), ...servers.values()]) {
    const owner = ok(docker(["inspect", "--format", `{{ index .Config.Labels "${label}" }}`, id]));
    assert.equal(owner, stamp);
    ok(docker(["rm", "-f", "-v", id]));
  }
  if (networkCreated) {
    assert.equal(ok(docker(["network", "inspect", "--format", `{{ index .Labels "${label}" }}`, network])), stamp);
    ok(docker(["network", "rm", network]));
  }
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith("xpp-versions-"));
  await rm(temp, { recursive: true, force: true });
  console.log("Isolated containers, volumes, network, and backup fixtures removed.");
}
