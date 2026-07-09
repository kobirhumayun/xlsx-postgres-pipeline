import { parseSavedQuerySqlFile } from "./saved-query-files.js";

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

export async function planSavedQueryImport(files, existingQueries, mode = "upsert") {
    const importMode = normalizeImportMode(mode);
    const existingByName = new Map(
        existingQueries.map((savedQuery) => [
            normalizeName(savedQuery.name),
            savedQuery,
        ])
    );
    const reservedNames = importMode === SAVED_QUERY_IMPORT_MODES.replace
        ? new Set()
        : new Set(existingByName.keys());
    const seenInputNames = new Set();
    const operations = [];

    for (const file of files) {
        const filename = file.name || "query.sql";

        if (!filename.toLowerCase().endsWith(".sql")) {
            operations.push({
                filename,
                action: "error",
                error: "Only .sql files can be imported.",
            });
            continue;
        }

        try {
            const parsed = parseSavedQuerySqlFile(await file.text(), filename);
            const inputKey = normalizeName(parsed.name);

            if (seenInputNames.has(inputKey) && importMode !== SAVED_QUERY_IMPORT_MODES.copy) {
                operations.push({
                    filename,
                    name: parsed.name,
                    action: "skipped",
                    error: "Duplicate query name in the selected files.",
                });
                continue;
            }

            seenInputNames.add(inputKey);

            if (importMode === SAVED_QUERY_IMPORT_MODES.copy) {
                const finalName = uniqueCopyName(parsed.name, reservedNames);
                reservedNames.add(normalizeName(finalName));
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
                if (existingByName.has(inputKey) || reservedNames.has(inputKey)) {
                    operations.push({
                        filename,
                        name: parsed.name,
                        action: "skipped",
                        error: "A saved query with this name already exists.",
                    });
                    continue;
                }

                reservedNames.add(inputKey);
                operations.push({
                    filename,
                    name: parsed.name,
                    action: "created",
                    data: parsed,
                });
                continue;
            }

            if (importMode === SAVED_QUERY_IMPORT_MODES.replace) {
                const finalName = uniqueCopyName(parsed.name, reservedNames, false);
                reservedNames.add(normalizeName(finalName));
                operations.push({
                    filename,
                    name: finalName,
                    originalName: finalName === parsed.name ? undefined : parsed.name,
                    action: "created",
                    data: { ...parsed, name: finalName },
                });
                continue;
            }

            const existing = existingByName.get(inputKey);
            operations.push({
                filename,
                name: parsed.name,
                action: existing ? "updated" : "created",
                existingId: existing?.id,
                data: parsed,
            });
            reservedNames.add(inputKey);
        } catch (error) {
            operations.push({
                filename,
                action: "error",
                error: error.message || "Failed to parse file.",
            });
        }
    }

    return {
        mode: importMode,
        willReplaceExisting: importMode === SAVED_QUERY_IMPORT_MODES.replace,
        replaceCount: importMode === SAVED_QUERY_IMPORT_MODES.replace ? existingQueries.length : 0,
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

function uniqueCopyName(name, reservedNames, alwaysCopy = true) {
    const trimmedName = String(name || "Imported Query").trim() || "Imported Query";
    const baseKey = normalizeName(trimmedName);

    if (!alwaysCopy && !reservedNames.has(baseKey)) {
        return trimmedName;
    }

    if (alwaysCopy && !reservedNames.has(baseKey)) {
        return trimmedName;
    }

    let suffix = 2;
    let candidate = `${trimmedName} (${suffix})`;

    while (reservedNames.has(normalizeName(candidate))) {
        suffix += 1;
        candidate = `${trimmedName} (${suffix})`;
    }

    return candidate;
}
