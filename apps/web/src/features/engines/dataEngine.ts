import * as XLSX from 'xlsx';
import { BrowserEngine, ConvertContext, ConvertResult, EngineError } from './types';

export interface DataPreview {
  headers: string[];
  rows: (string | number | boolean | null)[][];
  totalRows: number;
}

/**
 * Parsed workbooks, keyed by the File, so the preview and the conversion of the
 * same file share one parse. Entries go away with the File.
 */
const workbooks = new WeakMap<File, Promise<XLSX.WorkBook>>();

async function parseWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith('.json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(buffer));
    } catch {
      throw new EngineError('FILE_CORRUPT', `Invalid JSON in ${file.name}`);
    }
    const arrayData = Array.isArray(parsed) ? parsed : [parsed];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(arrayData), 'Data');
    return workbook;
  }
  try {
    return XLSX.read(buffer, { type: 'array', dense: true });
  } catch {
    throw new EngineError('FILE_CORRUPT', `Could not read tabular spreadsheet ${file.name}`);
  }
}

export function loadWorkbook(file: File): Promise<XLSX.WorkBook> {
  let workbook = workbooks.get(file);
  if (!workbook) {
    workbook = parseWorkbook(file);
    // Don't keep a failed parse around.
    workbook.catch(() => workbooks.delete(file));
    workbooks.set(file, workbook);
  }
  return workbook;
}

export async function getPreviewRows(file: File): Promise<DataPreview> {
  try {
    const workbook = await loadWorkbook(file);

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    const rawRows: (string | number | boolean | null)[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: null,
    });

    if (rawRows.length === 0) {
      return { headers: [], rows: [], totalRows: 0 };
    }

    const headers = (rawRows[0] || []).map((h) => String(h ?? ''));
    const rows = rawRows.slice(1, 6);

    return {
      headers,
      rows,
      totalRows: Math.max(0, rawRows.length - 1),
    };
  } catch (err) {
    throw new EngineError(
      'FILE_CORRUPT',
      `Could not parse tabular file ${file.name}: ${(err as Error).message}`
    );
  }
}

export const dataEngine: BrowserEngine = {
  id: 'sheetjs-data',
  async run(
    files: File[],
    options: Record<string, string | number | boolean>,
    targetFormat: string,
    ctx: ConvertContext
  ): Promise<ConvertResult[]> {
    const results: ConvertResult[] = [];
    const total = files.length;
    const delimiter = typeof options.delimiter === 'string' ? options.delimiter : ',';

    for (let i = 0; i < total; i++) {
      if (ctx.signal?.aborted) {
        throw new EngineError('CONVERSION_CANCELLED', 'Operation was cancelled.');
      }

      const file = files[i];
      if (!file) continue;

      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

      try {
        const workbook = await loadWorkbook(file);

        const sheetNames = workbook.SheetNames;
        if (sheetNames.length === 0) {
          throw new EngineError('FILE_CORRUPT', 'Spreadsheet contains no sheets.');
        }

        let outputBlob: Blob;
        let mime = 'application/octet-stream';

        if (targetFormat === 'csv') {
          const firstSheet = workbook.Sheets[sheetNames[0] || ''];
          if (!firstSheet) throw new EngineError('FILE_CORRUPT', 'Worksheet is missing.');
          const csvText = XLSX.utils.sheet_to_csv(firstSheet, { FS: delimiter });
          outputBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
          mime = 'text/csv';
        } else if (targetFormat === 'xlsx') {
          const outBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
          outputBlob = new Blob([outBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        } else if (targetFormat === 'json') {
          // "First row is header" off: return rows as plain arrays instead of objects.
          const rowsOf = (sheet: XLSX.WorkSheet): unknown[] =>
            options.firstRowHeader === false
              ? XLSX.utils.sheet_to_json(sheet, { header: 1 })
              : XLSX.utils.sheet_to_json(sheet);
          let jsonData: unknown;
          if (options.sheet === 'all') {
            // Every sheet, keyed by sheet name.
            jsonData = Object.fromEntries(
              sheetNames.map((name) => [name, rowsOf(workbook.Sheets[name] as XLSX.WorkSheet)])
            );
          } else {
            const firstSheet = workbook.Sheets[sheetNames[0] || ''];
            if (!firstSheet) throw new EngineError('FILE_CORRUPT', 'Worksheet is missing.');
            jsonData = rowsOf(firstSheet);
          }
          const jsonText = JSON.stringify(jsonData, null, 2);
          outputBlob = new Blob([jsonText], { type: 'application/json' });
          mime = 'application/json';
        } else {
          throw new EngineError(
            'UNSUPPORTED_FILE_TYPE',
            `Unsupported target format "${targetFormat}" for data converter.`
          );
        }

        results.push({
          filename: `${baseName}.${targetFormat}`,
          blob: outputBlob,
          mime,
          sizeBytes: outputBlob.size,
        });

        ctx.onProgress(Math.round(((i + 1) / total) * 100));
      } catch (err) {
        if (err instanceof EngineError) throw err;
        throw new EngineError(
          'CONVERSION_FAILED',
          `Data conversion failed for ${file.name}: ${(err as Error).message}`
        );
      }
    }

    return results;
  },
};
