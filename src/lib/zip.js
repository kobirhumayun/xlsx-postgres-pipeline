import {
    strFromU8,
    strToU8,
    unzipSync,
    Zip,
    ZipDeflate,
    zipSync,
} from "fflate";

const MAX_ZIP_BYTES = 25 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5000;

export function createZip(files) {
    const entries = {};

    for (const file of files) {
        entries[file.name] = typeof file.data === "string"
            ? strToU8(file.data)
            : new Uint8Array(file.data);
    }

    return Buffer.from(zipSync(entries, { level: 6 }));
}

export function createZipStream(files) {
    let archive;

    return new ReadableStream({
        start(controller) {
            try {
                archive = new Zip((error, chunk, final) => {
                    if (error) {
                        controller.error(error);
                        return;
                    }

                    controller.enqueue(chunk);
                    if (final) controller.close();
                });

                for (const file of files) {
                    const entry = new ZipDeflate(file.name, { level: 6 });
                    archive.add(entry);
                    entry.push(
                        typeof file.data === "string"
                            ? strToU8(file.data)
                            : new Uint8Array(file.data),
                        true
                    );
                }

                archive.end();
            } catch (error) {
                controller.error(error);
            }
        },
        cancel() {
            archive?.terminate();
        },
    });
}

export function readZipTextFiles(data, predicate = () => true) {
    const input = data instanceof Uint8Array ? data : new Uint8Array(data);

    if (input.byteLength > MAX_ZIP_BYTES) {
        throw new Error("ZIP file exceeds the 25 MB import limit.");
    }

    let entries;
    try {
        entries = unzipSync(input);
    } catch {
        throw new Error("The ZIP file is invalid or unsupported.");
    }

    const names = Object.keys(entries);
    if (names.length > MAX_ZIP_ENTRIES) {
        throw new Error("ZIP file contains too many entries.");
    }

    const totalBytes = names.reduce((sum, name) => sum + entries[name].byteLength, 0);
    if (totalBytes > MAX_UNZIPPED_BYTES) {
        throw new Error("ZIP contents exceed the 100 MB import limit.");
    }

    return names
        .filter((name) => !name.endsWith("/") && predicate(name))
        .map((name) => ({
            name,
            text: strFromU8(entries[name]),
        }));
}
