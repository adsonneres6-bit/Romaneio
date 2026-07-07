import * as XLSX from 'xlsx';

export interface XlsxSheetData {
  headers: string[];
  rows: string[][];
}

export interface ColumnIndices {
  sequence: number;
  destinationAddress: number;
  spxTn: number;
}

const HEADER_ALIASES: Record<keyof ColumnIndices, string[]> = {
  sequence: ['sequence', 'seq', 'sequencia', 'sequência', '#', 'numero', 'número'],
  destinationAddress: [
    'destination address',
    'destinationaddress',
    'address',
    'endereco',
    'endereço',
    'destino',
    'destination',
  ],
  spxTn: ['spx tn', 'spxtn', 'spx', 'tn', 'notes', 'tracking', 'rastreamento'],
};

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function readXlsxByHeaders(file: File): Promise<XlsxSheetData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  if (data.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = (data[0] ?? []).map((h) => String(h ?? ''));
  const body = data.slice(1).map((row) => row.map((c) => String(c ?? '')));

  return { headers, rows: body };
}

export function findColumnIndices(headers: string[]): ColumnIndices {
  const normalized = headers.map(normalizeHeader);

  const findIndex = (aliases: string[]): number => {
    for (let i = 0; i < normalized.length; i++) {
      if (aliases.includes(normalized[i])) return i;
    }
    return -1;
  };

  return {
    sequence: findIndex(HEADER_ALIASES.sequence.map(normalizeHeader)),
    destinationAddress: findIndex(HEADER_ALIASES.destinationAddress.map(normalizeHeader)),
    spxTn: findIndex(HEADER_ALIASES.spxTn.map(normalizeHeader)),
  };
}

export function writeXlsx(
  headers: string[],
  rows: string[][],
  sheetName: string,
  outputFileName: string,
): void {
  const sheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, outputFileName);
}

export function createXlsxBlob(
  headers: string[],
  rows: string[][],
  sheetName: string,
): Blob {
  const sheetData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function buildDateSuffix(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}_${month}`;
}
