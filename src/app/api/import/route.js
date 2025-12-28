import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { buildBusinessKey, buildNormalizedRow, hashRow } from "@/lib/ingest";

const formSchema = z.object({
  datasetId: z.string().min(1, "Dataset ID is required"),
  sheetName: z.string().optional(),
});

const getHeaderRow = (worksheet) => {
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values.slice(1).map((value) =>
    String(value || "").trim()
  );
  return headers.filter(Boolean);
};

const buildRawRow = (headers, row) => {
  const rowValues = {};
  headers.forEach((header, index) => {
    rowValues[header] = row.getCell(index + 1).value ?? null;
  });
  return rowValues;
};

export async function POST(request) {
  try {
    const formData = await request.formData();
    const parsed = formSchema.parse({
      datasetId: formData.get("datasetId"),
      sheetName: formData.get("sheetName") || undefined,
    });
    const file = formData.get("file");

    if (!file) {
      return Response.json({ error: "File is required." }, { status: 400 });
    }

    const datasetId = Number(parsed.datasetId);
    if (!Number.isInteger(datasetId) || datasetId <= 0) {
      return Response.json({ error: "Dataset ID is invalid." }, { status: 400 });
    }

    const dataset = await prisma.dataset.findUnique({
      where: { id: datasetId },
    });
    if (!dataset) {
      return Response.json({ error: "Dataset not found." }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = Buffer.from(await file.arrayBuffer());
    await workbook.xlsx.load(buffer);

    const sheetName = parsed.sheetName || dataset.defaultSheetName;
    const worksheet =
      (sheetName && workbook.getWorksheet(sheetName)) || workbook.worksheets[0];

    if (!worksheet) {
      return Response.json({ error: "Worksheet not found." }, { status: 400 });
    }

    const headers = getHeaderRow(worksheet);
    if (!headers.length) {
      return Response.json(
        { error: "Worksheet header row is empty." },
        { status: 400 }
      );
    }

    const importRun = await prisma.importRun.create({
      data: {
        datasetId: dataset.id,
        fileName: file.name || "upload.xlsx",
        fileHash: hashRow({ name: file.name, size: file.size }),
        totalRows: 0,
        okRows: 0,
        errorRows: 0,
        notes: null,
      },
    });

    const mapping = dataset.mapping ?? {};
    const pkFields = Array.isArray(dataset.pkFields) ? dataset.pkFields : [];
    let totalRows = 0;
    let okRows = 0;
    let errorRows = 0;
    const errors = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!row || row.cellCount === 0) {
        continue;
      }
      totalRows += 1;
      const rawRow = buildRawRow(headers, row);
      const { normalized, errors: rowErrors } = buildNormalizedRow(rawRow, mapping);
      const businessKey = buildBusinessKey(normalized, pkFields);
      if (!businessKey) {
        rowErrors.businessKey = "Missing primary key fields";
      }
      const parsedOk = Object.keys(rowErrors).length === 0;

      if (!parsedOk) {
        errorRows += 1;
        errors.push({ rowNumber, errors: rowErrors });
      } else {
        okRows += 1;
      }

      const rowHash = hashRow({ rawRow, normalized });

      await prisma.rawRow.create({
        data: {
          datasetId: dataset.id,
          importRunId: importRun.id,
          rowNumber,
          businessKey: businessKey ?? `row-${rowNumber}`,
          rowJson: {
            raw: rawRow,
            normalized,
          },
          rowHash,
          parsedOk,
          parseErrors: rowErrors,
        },
      });

      if (businessKey) {
        await prisma.curatedRow.upsert({
          where: {
            datasetId_businessKey: {
              datasetId: dataset.id,
              businessKey,
            },
          },
          update: {
            normalized,
            typedColumns: normalized,
            lastImportRunId: importRun.id,
          },
          create: {
            datasetId: dataset.id,
            businessKey,
            normalized,
            typedColumns: normalized,
            lastImportRunId: importRun.id,
          },
        });
      }
    }

    const updatedImportRun = await prisma.importRun.update({
      where: { id: importRun.id },
      data: {
        totalRows,
        okRows,
        errorRows,
      },
    });

    return Response.json({
      importRun: updatedImportRun,
      summary: {
        totalRows,
        okRows,
        errorRows,
      },
      errors,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid import payload", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("Failed to import worksheet", error);
    return Response.json(
      { error: "Failed to import worksheet" },
      { status: 500 }
    );
  }
}
