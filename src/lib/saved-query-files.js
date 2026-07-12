const METADATA_PREFIX = "xpp";

export function toSavedQuerySqlFile(savedQuery) {
    const lines = [
        metadataLine("name", savedQuery.name),
        metadataLine("version", "1"),
        metadataLine("databaseName", savedQuery.databaseName),
        metadataLine("description", savedQuery.description),
    ];

    lines.push("", savedQuery.query.trimEnd(), "");
    return lines.join("\n");
}

export function parseSavedQuerySqlFile(content, filename = "", options = {}) {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    const metadata = {};
    let index = 0;

    while (index < lines.length) {
        const match = lines[index].match(/^--\s*xpp:([A-Za-z0-9_-]+):\s?(.*)$/);
        if (!match) break;

        metadata[match[1]] = match[2].trim();
        index += 1;
    }

    while (index < lines.length && lines[index].trim() === "") {
        index += 1;
    }

    const query = lines.slice(index).join("\n").trim();
    const name = (metadata.name || nameFromFilename(filename)).trim();

    if (options.requireMetadata) {
        const missingFields = ["name", "version"]
            .filter((field) => !Object.prototype.hasOwnProperty.call(metadata, field));

        if (missingFields.length > 0) {
            throw new Error(`Missing required metadata: ${missingFields.join(", ")}.`);
        }

        if (metadata.version !== "1") {
            throw new Error(`Unsupported xpp file version: ${metadata.version || "empty"}.`);
        }
    }

    if (!name) {
        throw new Error("Query name is required in metadata or filename.");
    }

    if (!query) {
        throw new Error("SQL query body is empty.");
    }

    return {
        name,
        description: metadata.description || null,
        databaseName: metadata.databaseName || null,
        query,
    };
}

export function savedQueryFileName(savedQuery, usedNames = new Set()) {
    const baseSlug = slugify(savedQuery.name || "saved-query");
    let filename = `${baseSlug}.sql`;
    let suffix = 2;

    while (usedNames.has(filename.toLowerCase())) {
        filename = `${baseSlug}-${suffix}.sql`;
        suffix += 1;
    }

    usedNames.add(filename.toLowerCase());
    return filename;
}

function metadataLine(key, value) {
    return `-- ${METADATA_PREFIX}:${key}: ${sanitizeMetadataValue(value)}`;
}

function sanitizeMetadataValue(value) {
    return String(value ?? "")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function nameFromFilename(filename) {
    const baseName = filename
        .replace(/^.*[\\/]/, "")
        .replace(/\.sql$/i, "")
        .replace(/[-_]+/g, " ")
        .trim();

    return baseName.replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
    const slug = String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return slug || "saved-query";
}
