"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/api-client";
import ExcelJS from "exceljs";

const emptyFlexibleForm = {
  databaseName: "",
  tableName: "",
  sheetName: "",
};

const POSTGRES_TYPES = ["TEXT", "NUMERIC", "INTEGER", "BOOLEAN", "DATE", "TIMESTAMP", "JSONB"];

export default function ImportPage() {
  const [summary, setSummary] = useState(null);
  const [errors, setErrors] = useState([]);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  // Flexible import state
  const [flexibleFormState, setFlexibleFormState] = useState(emptyFlexibleForm);
  const [dbList, setDbList] = useState([]);
  const [tableList, setTableList] = useState([]);
  const [tableColumns, setTableColumns] = useState([]);
  const [tableColumnsStatus, setTableColumnsStatus] = useState({ type: "idle", message: "" });
  const [fileHeaders, setFileHeaders] = useState([]);
  const [fileHeaderStatus, setFileHeaderStatus] = useState({ type: "idle", message: "" });

  // Creation Mode State
  const [creationMode, setCreationMode] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [previewColumns, setPreviewColumns] = useState([]); // { name: string, type: string }[]

  // Load databases on mount
  useEffect(() => {
    fetchJson("/api/structure").then(data => {
      if (data.items) setDbList(data.items);
    }).catch(console.error);
  }, []);

  // Load tables when DB changes
  useEffect(() => {
    if (flexibleFormState.databaseName) {
      fetchJson(`/api/structure?database=${flexibleFormState.databaseName}`).then(data => {
        if (data.type === 'tables') setTableList(data.items);
      }).catch(console.error);
    } else {
      setTableList([]);
    }
  }, [flexibleFormState.databaseName]);

  // Load table columns when table changes (ONLY if not in creation mode)
  useEffect(() => {
    if (creationMode) return;

    if (flexibleFormState.databaseName && flexibleFormState.tableName) {
      setTableColumnsStatus({ type: "loading", message: "Loading table columns..." });
      fetchJson(
        `/api/structure?database=${flexibleFormState.databaseName}&table=${encodeURIComponent(flexibleFormState.tableName)}`
      )
        .then(data => {
          if (data.type === "columns") {
            setTableColumns(data.items);
            setTableColumnsStatus({ type: "success", message: "" });
          } else {
            setTableColumns([]);
            setTableColumnsStatus({ type: "error", message: "No columns found for this table." });
          }
        })
        .catch(error => {
          console.error(error);
          setTableColumns([]);
          setTableColumnsStatus({ type: "error", message: "Failed to load columns." });
        });
    } else {
      setTableColumns([]);
      setTableColumnsStatus({ type: "idle", message: "" });
    }
  }, [flexibleFormState.databaseName, flexibleFormState.tableName, creationMode]);

  useEffect(() => {
    if (!file) {
      setFileHeaders([]);
      setFileHeaderStatus({ type: "idle", message: "" });
      setPreviewColumns([]);
      return;
    }

    let cancelled = false;

    const extractHeaders = async () => {
      try {
        setFileHeaderStatus({ type: "loading", message: "Reading headers..." });
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheet = flexibleFormState.sheetName
          ? workbook.getWorksheet(flexibleFormState.sheetName)
          : workbook.worksheets[0];

        if (!worksheet) {
          throw new Error("Worksheet not found in file.");
        }

        const headerRow = worksheet.getRow(1);
        const extracted = [];
        if (Array.isArray(headerRow.values) && headerRow.values.length > 1) {
          for (let i = 1; i < headerRow.values.length; i += 1) {
            const value = headerRow.values[i];
            if (value === null || value === undefined) continue;
            const text = typeof value === "object" ? (value.text ?? value.result ?? "") : value;
            const header = String(text).trim();
            if (header) extracted.push(header);
          }
        } else if (headerRow.cellCount > 0) {
          for (let i = 1; i <= headerRow.cellCount; i += 1) {
            const cell = headerRow.getCell(i);
            const value = cell.value;
            const text = typeof value === "object" ? (value?.text ?? value?.result ?? "") : value;
            const header = String(text ?? "").trim();
            if (header) extracted.push(header);
          }
        }

        if (!cancelled) {
          // Check for duplicates
          const seen = new Set();
          const duplicates = new Set();
          extracted.forEach(h => {
            if (seen.has(h)) {
              duplicates.add(h);
            } else {
              seen.add(h);
            }
          });

          if (duplicates.size > 0) {
            setFileHeaders([]);
            setPreviewColumns([]);
            setFileHeaderStatus({
              type: "error",
              message: `Duplicate headers detected: ${Array.from(duplicates).join(", ")}. Please ensure all column headers are unique.`
            });
            return;
          }

          setFileHeaders(extracted);
          setFileHeaderStatus({ type: "success", message: "" });

          // Auto-populate preview columns for creation mode
          // Simple sanitization for column names: lowercase, replace spaces with _, remove special chars
          const initialColumns = extracted.map(h => ({
            name: h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_'),
            type: "TEXT",
            isIndexed: false
          }));

          // STRICT CHECK: Check for normalized name collisions
          // e.g. "Name" and "name" both -> "name". This is fatal for table creation.
          const normalizedCounts = {};
          initialColumns.forEach(col => {
            normalizedCounts[col.name] = (normalizedCounts[col.name] || 0) + 1;
          });

          const collisionList = Object.entries(normalizedCounts)
            .filter(([_, count]) => count > 1)
            .map(([name]) => name);

          if (collisionList.length > 0) {
            setPreviewColumns([]); // Clear previews to block creation
            setFileHeaderStatus({
              type: "error",
              message: `Column name collisions detected. distinct headers normalize to the same database column: ${collisionList.join(", ")}. Please rename headers in Excel to be distinct (e.g. "Name", "name" -> "name" conflict).`
            });
            return;
          }

          setPreviewColumns(initialColumns);
        }
      } catch (error) {
        console.error("Failed to read headers", error);
        if (!cancelled) {
          setFileHeaders([]);
          setFileHeaderStatus({ type: "error", message: error.message || "Failed to read headers." });
        }
      }
    };

    extractHeaders();

    return () => {
      cancelled = true;
    };
  }, [file, flexibleFormState.sheetName]);

  const headerComparison = useMemo(() => {
    if (creationMode) return { missingColumns: [], extraHeaders: [] }; // Not relevant in creation mode

    if (!tableColumns.length || !fileHeaders.length) {
      return { missingColumns: [], extraHeaders: [] };
    }
    const tableColumnNames = tableColumns.map(column => column.name);
    const tableSet = new Set(tableColumnNames);
    const headerSet = new Set(fileHeaders);

    const missingColumns = tableColumns.filter(column => {
      const isMissing = !headerSet.has(column.name);
      // It's strictly missing if:
      // 1. Not in header
      // 2. AND is NOT nullable
      // 3. AND has NO default value
      // (If it has a default, Postgres fills it. If it is nullable, NULL fills it.)
      const isRequired = column.is_nullable === 'NO' && column.column_default === null;
      return isMissing && isRequired;
    }).map(c => c.name);
    const extraHeaders = fileHeaders.filter(name => !tableSet.has(name));

    return { missingColumns, extraHeaders };
  }, [fileHeaders, tableColumns, creationMode]);

  const handleFlexibleChange = (event) => {
    const { name, value } = event.target;
    setFlexibleFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
  };

  const handlePreviewColumnChange = (index, field, value) => {
    const newCols = [...previewColumns];
    newCols[index] = { ...newCols[index], [field]: value };
    setPreviewColumns(newCols);
  };

  const handleTableCreate = async () => {
    if (!newTableName || !previewColumns.length) return false;

    try {
      setLoading(true);
      setStatus({ type: "loading", message: "Creating table..." });

      const res = await fetchJson("/api/structure", {
        method: "POST",
        body: JSON.stringify({
          databaseName: flexibleFormState.databaseName,
          tableName: newTableName,
          columns: previewColumns
        })
      });

      // Refresh table list
      if (flexibleFormState.databaseName) {
        const data = await fetchJson(`/api/structure?database=${flexibleFormState.databaseName}`);
        if (data.type === 'tables') setTableList(data.items);
      }

      // Switch mode and select new table
      setFlexibleFormState(prev => ({ ...prev, tableName: res.fullName }));
      setCreationMode(false);
      setStatus({ type: "success", message: `Table ${res.fullName} created! Ready to import.` });
      return true;
    } catch (err) {
      console.error("Failed to create table", err);
      setStatus({ type: "error", message: err.message || "Failed to create table" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setStatus({ type: "error", message: "Please select a file to upload." });
      return;
    }

    if (creationMode) {
      // Create table first
      const success = await handleTableCreate();
      if (!success) return; // Stop if creation failed
      // Fall through to import...
    }

    setStatus({ type: "idle", message: "" });
    setSummary(null);
    setErrors([]);
    setLoading(true);

    try {
      const payload = new FormData();
      const url = "/api/import/flexible";

      if (flexibleFormState.databaseName) payload.append("databaseName", flexibleFormState.databaseName);

      // If we just created a table, flexibleFormState.tableName is already updated by handleTableCreate
      // However, React state updates might be async? 
      // Actually, since we await handleTableCreate, and it calls setFlexibleFormState, 
      // but in the SAME render cycle the state won't be updated yet for this function scope.
      // We need to use the new name if we just created it.

      let targetTableName = flexibleFormState.tableName;
      if (creationMode) {
        // We need to reconstruct the full name or pass it back from handleTableCreate
        // Ideally handleTableCreate should return the new name or we assume logic.
        // Let's rely on constructing it: public.newTableName (since our API returns public.name)
        targetTableName = `public.${newTableName}`;
      }

      payload.append("tableName", targetTableName);
      payload.append("sheetName", flexibleFormState.sheetName);
      payload.append("file", file);

      const data = await fetchJson(url, {
        method: "POST",
        body: payload,
      });

      setSummary(data.summary);
      setErrors(data.errors ?? []);
      setStatus({ type: "success", message: "Import completed." });
    } catch (error) {
      console.error("Failed to import file", error);
      if (error.payload?.errors) {
        setErrors(error.payload.errors);
      }
      if (error.payload?.summary) {
        setSummary(error.payload.summary);
      }
      let errorMsg = error.message || "Failed to import file.";
      if (error.payload?.mismatch) {
        const m = error.payload.mismatch;
        const details = [];
        if (m.missingColumns?.length) details.push(`Missing: ${m.missingColumns.join(", ")}`);
        if (m.extraHeaders?.length) details.push(`Extra: ${m.extraHeaders.join(", ")}`);
        if (details.length) errorMsg += ` (${details.join("; ")})`;
      }
      setStatus({
        type: "error",
        message: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Import Runs
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Upload Excel files
          </h1>
          <p className="text-base text-zinc-600">
            Import Excel data directly into your database tables. First row must be headers.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Flexible Import
              </h2>
              <p className="text-sm text-zinc-500">
                Import into any database table. Ensure Excel headers match table columns.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setCreationMode(!creationMode);
                setStatus({ type: "idle", message: "" });
                setNewTableName("");
              }}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${creationMode
                ? "bg-zinc-900 text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
            >
              {creationMode ? "Cancel Creation" : "+ Create New Table"}
            </button>
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Database
              <select
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="databaseName"
                value={flexibleFormState.databaseName}
                onChange={handleFlexibleChange}
              >
                <option value="">-- Select Database --</option>
                {dbList.map(db => (
                  <option key={db} value={db}>{db}</option>
                ))}
              </select>
              <span className="text-xs text-zinc-500">Select database to populate table list.</span>
            </label>

            {!creationMode ? (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Table Name
                <input
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  name="tableName"
                  value={flexibleFormState.tableName}
                  onChange={handleFlexibleChange}
                  list="table-options"
                  placeholder="public.my_table"
                  required={!creationMode}
                />
                <datalist id="table-options">
                  {tableList.map(t => (
                    <option key={t.fullName} value={t.fullName} />
                  ))}
                </datalist>
              </label>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <label className="flex flex-col gap-2 text-sm font-medium text-blue-900">
                  New Table Name
                  <input
                    className="rounded-lg border border-blue-200 px-3 py-2 text-sm"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="my_new_table"
                    pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
                    title="Alphanumeric and underscores only, must start with letter."
                    required={creationMode}
                  />
                  <span className="text-xs text-blue-700">Name for the new table. (Letters, numbers, underscores only)</span>
                </label>
              </div>
            )}

            <label className="flex flex-col gap-2 text-sm font-medium">
              Sheet name (optional)
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                name="sheetName"
                value={flexibleFormState.sheetName}
                onChange={handleFlexibleChange}
                placeholder="Sheet1"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Excel file
              <input
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                required
              />
            </label>

            {/* Creation Mode Editor */}
            {creationMode && file && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">Define Table Schema</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-200 text-zinc-500">
                      <tr>
                        <th className="py-2 pr-4">Excel Header</th>
                        <th className="py-2 pr-4">Column Name (SQL)</th>
                        <th className="py-2 pr-4">Data Type</th>
                        <th className="py-2">Index?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewColumns.map((col, idx) => (
                        <tr key={idx} className="border-b border-zinc-100 last:border-0">
                          <td className="py-2 pr-4 font-medium text-zinc-700">
                            {fileHeaders[idx] || <i>(Column {idx + 1})</i>}
                          </td>
                          <td className="py-2 pr-4">
                            <input
                              className="w-full rounded border border-zinc-200 px-2 py-1"
                              value={col.name}
                              onChange={(e) => handlePreviewColumnChange(idx, 'name', e.target.value)}
                            />
                          </td>
                          <td className="py-2">
                            <select
                              className="w-full rounded border border-zinc-200 px-2 py-1"
                              value={col.type}
                              onChange={(e) => handlePreviewColumnChange(idx, 'type', e.target.value)}
                            >
                              {POSTGRES_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pl-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                              checked={col.isIndexed || false}
                              onChange={(e) => handlePreviewColumnChange(idx, 'isIndexed', e.target.checked)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {fileHeaderStatus.message && (
                  <p className={`mt-3 text-sm ${fileHeaderStatus.type === "error" ? "text-red-600 font-medium" : "text-zinc-500"}`}>
                    {fileHeaderStatus.message}
                  </p>
                )}
                {previewColumns.length === 0 && !fileHeaderStatus.message && <p className="text-zinc-500">No columns detected.</p>}
              </div>
            )}

            {/* Existing Table Inspector */}
            {!creationMode && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">Table columns</h3>
                  {tableColumnsStatus.message && (
                    <span className="text-xs text-zinc-500">{tableColumnsStatus.message}</span>
                  )}
                </div>
                {!tableColumns.length && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Select a database and table to load columns.
                  </p>
                )}
                {tableColumns.length > 0 && (
                  <div className="mt-3 grid gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Required columns
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tableColumns.filter(column => column.is_nullable === "NO").map(column => {
                          const isMissing = fileHeaders.length > 0 && headerComparison.missingColumns.includes(column.name);
                          return (
                            <span
                              key={column.name}
                              className={`rounded-full px-3 py-1 text-xs font-medium ${isMissing
                                ? "bg-red-100 text-red-700"
                                : "bg-emerald-100 text-emerald-700"
                                }`}
                            >
                              {column.name}
                            </span>
                          );
                        })}
                        {tableColumns.filter(column => column.is_nullable === "NO").length === 0 && (
                          <span className="text-xs text-zinc-500">No required columns.</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Column details
                      </p>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {tableColumns.map(column => {
                          const isMissing = fileHeaders.length > 0 && headerComparison.missingColumns.includes(column.name);
                          return (
                            <div
                              key={column.name}
                              className={`rounded-lg border px-3 py-2 text-xs ${isMissing ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-700"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold">{column.name}</span>
                                <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                                  {column.is_nullable === "NO" ? "Required" : "Optional"}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-zinc-500">
                                {column.data_type} · Position {column.ordinal_position}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Header check
                      </p>
                      {fileHeaderStatus.message && (
                        <p
                          className={`mt-2 text-xs ${fileHeaderStatus.type === "error"
                            ? "text-red-600"
                            : "text-zinc-500"
                            }`}
                        >
                          {fileHeaderStatus.message}
                        </p>
                      )}
                      {!fileHeaders.length && !fileHeaderStatus.message && (
                        <p className="mt-2 text-xs text-zinc-500">
                          Upload a file to compare its headers to the table definition.
                        </p>
                      )}
                      {fileHeaders.length > 0 && (
                        <div className="mt-2 grid gap-2 text-xs">
                          <div>
                            <span className="font-semibold text-zinc-700">Missing columns:</span>{" "}
                            {headerComparison.missingColumns.length
                              ? headerComparison.missingColumns.join(", ")
                              : "None"}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-700">Extra headers:</span>{" "}
                            {headerComparison.extraHeaders.length
                              ? headerComparison.extraHeaders.join(", ")
                              : "None"}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading || fileHeaderStatus.type === "error"}
              >
                {loading ? (creationMode ? "Creating & Importing..." : "Importing...") : (creationMode ? "Create & Import" : "Start import")}
              </button>
              {status.message && (
                <span
                  className={`text-sm ${status.type === "error"
                    ? "text-red-600"
                    : "text-emerald-600"
                    }`}
                >
                  {status.message}
                </span>
              )}
            </div>
          </form>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Import summary</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Total rows", value: summary?.totalRows ?? 0 },
              { label: "Parsed OK", value: summary?.okRows ?? 0 },
              { label: "Errors", value: summary?.errorRows ?? 0 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm"
              >
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Row errors</h2>
            <span className="text-sm text-zinc-500">
              {errors.length} rows
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Errors</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((row) => (
                  <tr
                    key={`${row.rowNumber}`}
                    className="border-t border-zinc-100 text-zinc-700"
                  >
                    <td className="px-4 py-3 font-medium">{row.rowNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                      {typeof row.error === 'string' ? row.error : JSON.stringify(row.errors || row.error)}
                    </td>
                  </tr>
                ))}
                {errors.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-sm text-zinc-500"
                      colSpan={2}
                    >
                      No errors reported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
