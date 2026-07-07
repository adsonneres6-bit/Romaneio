import { buildOfficialAddress } from './normalizeService';
import {
  readXlsxByHeaders,
  findColumnIndices,
  createXlsxBlob,
  buildDateSuffix,
} from './xlsxReaderService';

export interface FrotaOptimizeResult {
  totalRows: number;
  outputRows: number;
  duplicatesRemoved: number;
  outputFileName: string;
  headers: string[];
  rows: string[][];
  blob: Blob;
}

export async function optimizeFrotaFile(file: File): Promise<FrotaOptimizeResult> {
  const { headers, rows } = await readXlsxByHeaders(file);

  if (rows.length === 0) {
    return {
      totalRows: 0,
      outputRows: 0,
      duplicatesRemoved: 0,
      outputFileName: '',
      headers,
      rows: [],
    };
  }

  const indices = findColumnIndices(headers);

  if (indices.destinationAddress === -1) {
    throw new Error(
      'Coluna de endereço não encontrada. Verifique se a planilha possui um cabeçalho de endereço (ex: "Destination Address", "Endereco").',
    );
  }

  const seqIdx = indices.sequence;
  const addrIdx = indices.destinationAddress;

  // Step 1: Standardize all addresses
  const standardizedRows = rows.map((row) => {
    const newRow = [...row];
    const addressCell = newRow[addrIdx]?.trim();
    if (addressCell) {
      newRow[addrIdx] = buildOfficialAddress(addressCell);
    }
    return newRow;
  });

  // Step 2: Consolidate duplicates by address, concatenating Sequence values
  const addressMap = new Map<string, number>();
  const consolidatedRows: string[][] = [];

  for (const row of standardizedRows) {
    const address = (row[addrIdx] ?? '').trim().toLowerCase();

    if (!address) {
      consolidatedRows.push(row);
      continue;
    }

    const existingIndex = addressMap.get(address);

    if (existingIndex === undefined) {
      // First occurrence — keep the row
      addressMap.set(address, consolidatedRows.length);
      consolidatedRows.push(row);
    } else {
      // Duplicate — concatenate sequence into the first occurrence
      const existingRow = consolidatedRows[existingIndex];

      if (seqIdx !== -1) {
        const existingSeq = (existingRow[seqIdx] ?? '').trim();
        const newSeq = (row[seqIdx] ?? '').trim();

        if (newSeq) {
          existingRow[seqIdx] = existingSeq ? `${existingSeq},${newSeq}` : newSeq;
        }
      }
    }
  }

  const duplicatesRemoved = standardizedRows.length - consolidatedRows.length;

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const outputFileName = `RomaneioFrota_${day}_${month}.xlsx`;

  const blob = createXlsxBlob(headers, consolidatedRows, 'Entregas');

  return {
    totalRows: rows.length,
    outputRows: consolidatedRows.length,
    duplicatesRemoved,
    outputFileName,
    headers,
    rows: consolidatedRows,
    blob,
  };
}
