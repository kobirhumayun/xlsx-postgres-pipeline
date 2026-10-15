// Real pg_dump -> restore round trip with a restricted target role.
// Run after building xlsx-postgres-pipeline-backup. Uses only a local database
// and uniquely named disposable databases/role; never restores over app data.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());
const base = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Verification requires a local DATABASE_URL; cloud targets are never tested.");
const stamp = Date.now();
const source = `xpp_backup_source_${stamp}`;
const target = `xpp_backup_target_${stamp}`;
const role = `xpp_backup_user_${stamp}`;
const password = randomBytes(24).toString("hex");
const temp = await mkdtemp(path.join(os.tmpdir(), "xpp-backup-"));
const admin = new pg.Client({ connectionString: base.toString() });
const createdDatabases = [];
let createdRole = false;
let sourceClient, targetClient;
function connection(database, cloudRole = false, docker = false) {
  const url = new URL(base);
  url.pathname = `/${database}`;
  url.search = "";
  if (docker) url.hostname = "db";
  if (cloudRole) { url.username = role; url.password = password; }
  return url.toString();
}
function run(script, filename, mode = "empty") {
  const result = spawnSync("docker", [
    "run", "--rm", "--network", process.env.BACKUP_TEST_NETWORK || "xlsx-postgres-pipeline_default",
    "--entrypoint", "bash", "--mount", `type=bind,src=${temp},dst=/work`,
    ...["DATABASE_URL", "BACKUP_DATABASE_URL", "RESTORE_DATABASE_URL", "BACKUP_DIR", "RESTORE_MODE", "RETENTION_DAYS"].flatMap((key) => ["-e", key]),
    "xlsx-postgres-pipeline-backup", `/usr/local/bin/${script}.sh`, ...(filename ? [`/work/${filename}`] : []),
  ], {
    encoding: "utf8", timeout: 90000,
    env: { ...process.env, DATABASE_URL: connection(source, false, true), BACKUP_DATABASE_URL: connection(source, false, true),
      RESTORE_DATABASE_URL: connection(target, true, true), BACKUP_DIR: "/work", RESTORE_MODE: mode, RETENTION_DAYS: "7" },
  });
  if (result.error) throw result.error;
  return { status: result.status, output: result.stdout + result.stderr };
}
await admin.connect();
try {
  await admin.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
  createdRole = true;
  await admin.query(`CREATE DATABASE "${source}"`); createdDatabases.push(source);
  await admin.query(`CREATE DATABASE "${target}" OWNER "${role}"`); createdDatabases.push(target);
  sourceClient = new pg.Client({ connectionString: connection(source) }); await sourceClient.connect();
  targetClient = new pg.Client({ connectionString: connection(target, true) }); await targetClient.connect();
  await sourceClient.query("CREATE TYPE public.state AS ENUM ('ready', 'done'); CREATE TABLE public.pipeline_check (id serial PRIMARY KEY, label text NOT NULL, state public.state DEFAULT 'ready'); INSERT INTO public.pipeline_check (label) VALUES ('alpha'), ('beta'), ('gamma');");
  let result = run("backup"); assert.equal(result.status, 0, result.output);
  const filename = (await readdir(temp)).find((name) => /^backup_.*\.sql\.gz$/.test(name));
  assert.ok(filename);
  const sql = gunzipSync(await readFile(path.join(temp, filename))).toString("utf8");
  assert.match(sql, /-- Dumped by pg_dump version 16\./);
  assert.doesNotMatch(sql, /^.*OWNER TO |^(GRANT|REVOKE) /m);
  result = run("restore", filename); assert.equal(result.status, 0, result.output);
  const count = async () => Number((await targetClient.query("SELECT count(*) FROM public.pipeline_check")).rows[0].count);
  assert.equal(await count(), 3);
  assert.equal((await targetClient.query("SELECT reltuples FROM pg_class WHERE oid='public.pipeline_check'::regclass")).rows[0].reltuples, 3);
  console.log("Real PostgreSQL 16 dump restored with a non-superuser role, including sequence/type/data and statistics.");

  result = run("restore", filename); assert.notEqual(result.status, 0);
  assert.match(result.output, /target contains user objects/); assert.equal(await count(), 3);
  await targetClient.query("INSERT INTO public.pipeline_check (label) VALUES ('keep on failure')");
  await writeFile(path.join(temp, "broken.sql.gz"), gzipSync(sql + "\nSELECT 1/0;\n"));
  result = run("restore", "broken.sql.gz", "replace"); assert.notEqual(result.status, 0);
  assert.match(result.output, /division by zero/); assert.equal(await count(), 4);
  console.log("Nonempty target blocked; failed replacement rolled back DROP/CREATE/COPY and retained existing rows.");

  await writeFile(path.join(temp, "newer.sql.gz"), gzipSync(sql.replace(/-- Dumped by pg_dump version .*/, "-- Dumped by pg_dump version 18.6")));
  result = run("restore", "newer.sql.gz", "replace"); assert.notEqual(result.status, 0);
  assert.match(result.output, /are incompatible/); assert.equal(await count(), 4);
  result = run("restore", filename, "replace"); assert.equal(result.status, 0, result.output);
  assert.equal(await count(), 3);
  console.log("Newer dump rejected before changes; explicit compatible replacement succeeded.");
} finally {
  if (sourceClient) await sourceClient.end();
  if (targetClient) await targetClient.end();
  for (const database of createdDatabases.reverse()) await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  if (createdRole) await admin.query(`DROP ROLE "${role}"`);
  await admin.end();
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(temp).startsWith("xpp-backup-"));
  await rm(temp, { recursive: true, force: true });
  console.log("Disposable databases, role, and archive files removed.");
}
