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

        const stream = new ReadableStream({
            async start(controller) {
                // Adapter to pipe ExcelJS writes to the Web ReadableStream controller
                const writerAdapter = {
                    write: (chunk) => controller.enqueue(chunk),
                    end: () => controller.close(),
                    on: (event, fn) => { },
                    once: (event, fn) => { },
                    emit: (event, ...args) => { },
                };

                const workbookWriter = new ExcelJS.stream.xlsx.WorkbookWriter({
                    stream: writerAdapter,
                    useStyles: false,
                    useSharedStrings: false
                });

                const worksheet = workbookWriter.addWorksheet("Export");

                let cursor;
                const closeCursor = async () => {
                    if (!cursor) return;
                    await new Promise((resolve, reject) => {
                        cursor.close((err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            resolve();
                        });
                    });
                };
                try {
                    cursor = client.query(new Cursor(query));

                    let isFirstBatch = true;
                    // Read in batches of 1000
                    const BATCH_SIZE = 1000;

                    const readBatch = () => {
                        return new Promise((resolve, reject) => {
                            cursor.read(BATCH_SIZE, (err, rows) => {
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

                        // Explicitly commit rows to free memory in ExcelJS stream writer
                        // worksheet.commit(); // Not needed per row if addRow().commit() is called? 
                        // Actually addRow returns Row object. Calling commit() on it frees it.
                    }

                    await workbookWriter.commit();
                } catch (err) {
                    console.error("Stream generation error", err);
                    controller.error(err);
                } finally {
                    try {
                        await closeCursor();
                    } catch (closeError) {
                        console.error("Cursor close error", closeError);
                    }
                    // Release DB resources when stream is done or errors
                    if (client) client.release();
                    if (pool && pool !== getDbPool()) {
                        // We can't await here easily inside start() without holding up the close?
                        // But safe to trigger and forget or await.
                        pool.end().catch(console.error);
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
        if (client) client.release();
        return Response.json(
            { error: "Export failed", details: error.message },
            { status: 500 }
        );
    }
}
