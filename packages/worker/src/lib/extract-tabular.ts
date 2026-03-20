import type Papa from "papaparse";

export interface TabularSheet {
  name: string;
  columns: string[];
  dataTypes: Record<string, string>;
  rowCount: number;
  sampleValues: Record<string, unknown[]>;
}

export interface TabularData {
  sheets: TabularSheet[];
  metadata: {
    format: "csv" | "xlsx";
    sheetCount: number;
    totalRows: number;
    filename?: string;
  };
}

function inferDataType(values: unknown[]): string {
  const nonNull = values.filter((v) => v != null && v !== "");
  if (nonNull.length === 0) return "string";

  let hasNumber = false;
  let hasDate = false;
  let hasBool = false;

  for (const v of nonNull) {
    if (typeof v === "boolean") {
      hasBool = true;
    } else if (typeof v === "number") {
      hasNumber = true;
    } else if (v instanceof Date) {
      hasDate = true;
    } else if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) hasDate = true;
      else if (v === "true" || v === "false") hasBool = true;
    }
  }

  if (hasDate) return "date";
  if (hasNumber) return "number";
  if (hasBool) return "boolean";
  return "string";
}

export async function extractCsv(buffer: Buffer, filename?: string): Promise<TabularData> {
  const papaparse: typeof Papa = (await import("papaparse")).default;

  const text = buffer.toString("utf-8");
  const result = papaparse.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  const rows = result.data as Record<string, unknown>[];
  const columns = result.meta.fields ?? [];

  const dataTypes: Record<string, string> = {};
  const sampleValues: Record<string, unknown[]> = {};

  for (const col of columns) {
    const colValues = rows.slice(0, 10).map((r) => r[col]);
    dataTypes[col] = inferDataType(colValues);
    sampleValues[col] = rows
      .slice(0, 3)
      .map((r) => r[col])
      .filter((v) => v != null && v !== "");
  }

  const sheet: TabularSheet = {
    name: filename?.replace(/\.csv$/i, "") ?? "Sheet1",
    columns,
    dataTypes,
    rowCount: rows.length,
    sampleValues,
  };

  return {
    sheets: [sheet],
    metadata: {
      format: "csv",
      sheetCount: 1,
      totalRows: rows.length,
      filename,
    },
  };
}

export async function extractXlsx(buffer: Buffer, filename?: string): Promise<TabularData> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const sheets: TabularSheet[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    const dataTypes: Record<string, string> = {};
    const sampleValues: Record<string, unknown[]> = {};

    for (const col of columns) {
      const colValues = rows.slice(0, 10).map((r) => r[col]);
      dataTypes[col] = inferDataType(colValues);
      sampleValues[col] = rows
        .slice(0, 3)
        .map((r) => r[col])
        .filter((v) => v != null && v !== "");
    }

    sheets.push({
      name: sheetName,
      columns,
      dataTypes,
      rowCount: rows.length,
      sampleValues,
    });
    totalRows += rows.length;
  }

  return {
    sheets,
    metadata: {
      format: "xlsx",
      sheetCount: workbook.SheetNames.length,
      totalRows,
      filename,
    },
  };
}

function formatSample(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return String(value);
}

export function tabularToDescriptor(data: TabularData): string {
  const lines: string[] = [];

  if (data.metadata.filename) {
    lines.push(`Document: "${data.metadata.filename}"`);
  }

  const sheetSummary = data.sheets
    .map((s) => `"${s.name}" (${s.rowCount} rows, ${s.columns.length} columns)`)
    .join(", ");
  lines.push(
    `Tabular data (${data.metadata.format.toUpperCase()}) with ${data.metadata.totalRows} total rows across ${data.metadata.sheetCount} sheet(s): ${sheetSummary}.`,
  );
  lines.push("");

  for (const sheet of data.sheets) {
    lines.push(`Sheet "${sheet.name}" (${sheet.rowCount} rows, ${sheet.columns.length} columns):`);

    if (sheet.columns.length === 0) {
      lines.push("  (empty sheet — no columns)");
    } else {
      for (const col of sheet.columns) {
        const type = sheet.dataTypes[col] ?? "string";
        const samples = sheet.sampleValues[col] ?? [];
        const sampleStr = samples.length > 0 ? `: e.g. ${samples.map(formatSample).join(", ")}` : "";
        lines.push(`  - ${col} (${type})${sampleStr}`);
      }
    }

    if (sheet.rowCount === 0) {
      lines.push("  (0 data rows — headers only)");
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
