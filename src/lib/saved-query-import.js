import { parseSavedQuerySqlFile } from "./saved-query-files.js";
import { readZipTextFiles } from "./zip.js";

export const SAVED_QUERY_IMPORT_MODES = {
    upsert: "upsert",
    create: "create",
    copy: "copy",
    replace: "replace",
};

export function normalizeImportMode(mode) {
    return Object.values(SAVED_QUERY_IMPORT_MODES).includes(mode)
        ? mode
        : SAVED_QUERY_IMPORT_MODES.upsert;
}

export async function expandSavedQueryImportFiles(files) {
    const expanded = [];

    for (const file of files) {
        const filename = file.name || "query.sql";

        if (!filename.toLowerCase().endsWith(".zip")) {
            expanded.push(file);
            continue;
        }

        try {
            const archiveFiles = readZipTextFiles(
                await file.arrayBuffer(),
                (name) => /(^|\/)queries\/.*\.sql$/i.test(name)
            );

            if (archiveFiles.length === 0) {
                expanded.push({
                    name: filename,
                    importError: "ZIP file does not contain any queries/**/*.sql files.",
                });
                continue;
            }

            expanded.push(...archiveFiles.map((entry) => ({
                name: entry.name,
                text: async () => entry.text,
            })));
        } catch (error) {
            expanded.push({
                name: filename,
                importError: error.message || "Failed to read ZIP file.",
            });
        }
    }

    return expanded;
}

export async function planSavedQueryImport(files, existingQueries, mode = "upsert") {
    const importMode = normalizeImportMode(mode);
    const existingByIdentity = new Map(
        existingQueries.map((savedQuery) => [
            queryIdentity(savedQuery),
            savedQuery,
        ])
    );
    const reservedIdentities = importMode === SAVED_QUERY_IMPORT_MODES.replace
        ? new Set()
        : new Set(existingByIdentity.keys());
    const seenInputIdentities = new Set();
    const operations = [];

    for (const file of files) {
        const filename = file.name || "query.sql";

        if (file.importError) {
            operations.push({
                filename,
                action: "error",
                error: file.importError,
            });
            continue;
        }

        if (!filename.toLowerCase().endsWith(".sql")) {
            operations.push({
                filename,
                action: "error",
                error: "Only .sql files can be imported.",
            });
            continue;
        }

        try {
            const parsed = parseSavedQuerySqlFile(await file.text(), filename, {
                requireMetadata: true,
            });
            const inputKey = queryIdentity(parsed);

            if (seenInputIdentities.has(inputKey) && importMode !== SAVED_QUERY_IMPORT_MODES.copy) {
                operations.push({
                    filename,
                    name: parsed.name,
                    action: "skipped",
                    error: "Duplicate query name in the selected files.",
                });
                continue;
            }

            seenInputIdentities.add(inputKey);

            if (importMode === SAVED_QUERY_IMPORT_MODES.copy) {
                const finalName = uniqueCopyName(parsed, reservedIdentities);
                reservedIdentities.add(queryIdentity({ ...parsed, name: finalName }));
                operations.push({
                    filename,
                    name: finalName,
                    originalName: parsed.name,
                    action: "created",
                    data: { ...parsed, name: finalName },
                });
                continue;
            }

            if (importMode === SAVED_QUERY_IMPORT_MODES.create) {
                if (existingByIdentity.has(inputKey) || reservedIdentities.has(inputKey)) {
                    operations.push({
                        filename,
                        name: parsed.name,
                        action: "skipped",
                        error: "A saved query with this name already exists.",
                    });
                    continue;
                }

                reservedIdentities.add(inputKey);
                operations.push({
                    filename,
                    name: parsed.name,
                    action: "created",
                    data: parsed,
                });
                continue;
            }

            if (importMode === SAVED_QUERY_IMPORT_MODES.replace) {
                const finalName = uniqueCopyName(parsed, reservedIdentities, false);
                reservedIdentities.add(queryIdentity({ ...parsed, name: finalName }));
                operations.push({
                    filename,
                    name: finalName,
                    originalName: finalName === parsed.name ? undefined : parsed.name,
                    action: "created",
                    data: { ...parsed, name: finalName },
                });
                continue;
            }

            const existing = existingByIdentity.get(inputKey);
            operations.push({
                filename,
                name: parsed.name,
                action: existing ? "updated" : "created",
                existingId: existing?.id,
                data: parsed,
            });
            reservedIdentities.add(inputKey);
        } catch (error) {
            operations.push({
                filename,
                action: "error",
                error: error.message || "Failed to parse file.",
            });
        }
    }

    const replaceDatabaseNames = importMode === SAVED_QUERY_IMPORT_MODES.replace
        ? uniqueDatabaseNames(operations
            .filter((operation) => operation.action === "created")
            .map((operation) => operation.data.databaseName))
        : [];
    const replaceDatabaseKeys = new Set(replaceDatabaseNames.map(normalizeDatabaseName));

    return {
        mode: importMode,
        willReplaceExisting: importMode === SAVED_QUERY_IMPORT_MODES.replace,
        replaceCount: importMode === SAVED_QUERY_IMPORT_MODES.replace
            ? existingQueries.filter((query) => replaceDatabaseKeys.has(normalizeDatabaseName(query.databaseName))).length
            : 0,
        replaceDatabaseNames,
        summary: summarizeOperations(operations),
        operations,
    };
}

export function summarizeOperations(operations) {
    return operations.reduce(
        (summary, operation) => {
            if (operation.action === "created") summary.created += 1;
            if (operation.action === "updated") summary.updated += 1;
            if (operation.action === "skipped") summary.skipped += 1;
            if (operation.action === "error") summary.errors += 1;
            return summary;
        },
        { created: 0, updated: 0, skipped: 0, errors: 0 }
    );
}

function normalizeName(name) {
    return String(name || "").trim().toLowerCase();
}

function normalizeDatabaseName(databaseName) {
    return String(databaseName || "").trim().toLowerCase();
}

function uniqueDatabaseNames(databaseNames) {
    const byKey = new Map();
    for (const databaseName of databaseNames) {
        const normalized = String(databaseName || "").trim() || null;
        byKey.set(normalizeDatabaseName(normalized), normalized);
    }
    return [...byKey.values()];
}

function queryIdentity(query) {
    return `${normalizeDatabaseName(query.databaseName)}\u0000${normalizeName(query.name)}`;
}

function uniqueCopyName(query, reservedIdentities, alwaysCopy = true) {
    const trimmedName = String(query.name || "Imported Query").trim() || "Imported Query";
    const baseKey = queryIdentity({ ...query, name: trimmedName });

    if (!alwaysCopy && !reservedIdentities.has(baseKey)) {
        return trimmedName;
    }

    if (alwaysCopy && !reservedIdentities.has(baseKey)) {
        return trimmedName;
    }

    let suffix = 2;
    let candidate = `${trimmedName} (${suffix})`;

    while (reservedIdentities.has(queryIdentity({ ...query, name: candidate }))) {
        suffix += 1;
        candidate = `${trimmedName} (${suffix})`;
    }

    return candidate;
}
