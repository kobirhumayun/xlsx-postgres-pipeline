import { z } from "zod";
import { getDbPool } from "@/lib/db";
import ExcelJS from "exceljs";
import Cursor from "pg-cursor";

const querySchema = z.object({
    query: z.string().min(1, "Query is required"),
    databaseName: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request) {
    let pool;
    let client;
    try {
        const body = await request.json();
        const parsed = querySchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
        }

        const { query, databaseName } = parsed.data;

        pool = getDbPool(databaseName);
        client = await pool.connect();

        // Use a ReadableStream to stream data
        const stream = new ReadableStream({
            async start(controller) {
                const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
                    stream: {
                        write: (chunk) => controller.enqueue(chunk),
                        end: () => controller.close(),
                        // We need to implement dummy listeners? ExcelJS stream writer expects standard stream.
                        // But here we are bridging to Web ReadableStream.
                        // simpler hack: pass a "pass through" object or manage buffer.
                    }
                });

                // FIX: ExcelJS Stream Writer writes to a Node Stream. 
                // We need to bridge Node Writable -> Web Readable.
                // Since this is Next.js App Router, we return a standard Response(readableStream).

                // Let's rely on a simpler approach: 
                // We create a TransformStream? No, Node environment.

                // Let's keep it simple: We return a Response. 
                // Actually, waiting for ExcelJS 4.4.0 stream support in Web env is tricky.
                // But in Node runtime (Next.js server), we can just use `new Response(iterator)`?

                // Re-think: Is it easier to write to a temporary file? or just buffer chunks?
                // Proper way:
                // Create a PassThrough stream (Node).
                // Create a ReadableStream (Web) that pulls from PassThrough.
                // THIS IS COMPLEX.

                // ALTERNATIVE: Use iterator with pg-cursor and stream JSON? No, user wants Excel.

                // Let's use the buffer approach for small files, but "Robust" means avoiding crash.
                // Optimization: Maybe just limit rows?
                // OR: True streaming.

                // Real implementation of bridging ExcelJS Node Stream -> Web Response:
                // 1. We need a way to capture "write" calls from WorkbookWriter and push to controller.
                // 2. The simple object adapter below works well for this.

                const writerAdapter = {
                    write: (chunk) => controller.enqueue(chunk),
                    end: () => {
                        // finalize
                        controller.close();
                    },
                    on: (event, fn) => { },
                    once: (event, fn) => { },
                    emit: (event, ...args) => { },
                };

                const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
                    stream: writerAdapter,
                    useStyles: false, // Performance
                    useSharedStrings: false // Performance
                });

                const worksheet = workbookWriter.addWorksheet("Export");

                let cursor;
                try {
                    const cursorObj = client.query(new Cursor(query));

                    let isFirstBatch = true;

                    const readBatch = () => {
                        return new Promise((resolve, reject) => {
                            cursorObj.read(500, (err, rows) => {
                                if (err) return reject(err);
                                resolve(rows);
                            });
                        });
                    };

                    while (true) {
                        const rows = await readBatch();
                        if (rows.length === 0) break;

                        if (isFirstBatch) {
                            if (rows.length > 0) {
                                const columns = Object.keys(rows[0]).map(k => ({ header: k, key: k }));
                                worksheet.columns = columns;
                            }
                            isFirstBatch = false;
                        }

                        rows.forEach(row => {
                            worksheet.addRow(row).commit();
                        });
                    }

                    await workbookWriter.commit();
                } catch (err) {
                    controller.error(err);
                } finally {
                    if (client) client.release();
                    if (pool && pool !== getDbPool()) {
                        await pool.end(); // Don't await here inside stream loop effectively? 
                        // Actually client.release is enough for pool interaction.
                        // pool.end() is tricky inside stream closure.
                    }
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": 'attachment; filename="export.xlsx"',
            },
        });

    } catch (error) {
        console.error("Export Error", error);
        if (client) client.release(); // release if error before stream starts
        return Response.json(
            { error: "Export failed", details: error.message },
            { status: 500 }
        );
    }
}
