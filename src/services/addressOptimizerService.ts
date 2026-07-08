import { buildOfficialAddress } from './normalizeService';
import {
  readXlsxByHeaders,
  findColumnIndices,
  createXlsxBlob,
} from './xlsxReaderService';

export interface AddressOptimizeResult {
  processedCount: number;
  outputFileName: string;
  blob: Blob;
}

export async function optimizeAddressesFile(file: File): Promise<AddressOptimizeResult> {
  const startTime = performance.now();
  console.log('[ADDRESS OPTIMIZER] Starting optimization', {
    fileName: file.name,
    fileSize: `${(file.size / 1024).toFixed(2)} KB`,
  });

  const { headers, rows } = await readXlsxByHeaders(file);

  if (rows.length === 0) {
    console.warn('[ADDRESS OPTIMIZER] No rows found, returning empty');
    return { processedCount: 0, outputFileName: '', blob: new Blob() };
  }

  const indices = findColumnIndices(headers);
  console.log('[ADDRESS OPTIMIZER] Column indices found', {
    headers,
    indices,
  });

  if (indices.destinationAddress === -1) {
    throw new Error(
      'Coluna de endereço não encontrada. Verifique se a planilha possui um cabeçalho de endereço (ex: "Destination Address", "Endereco").',
    );
  }

  let processedCount = 0;
  let unchangedCount = 0;
  let alreadyCorrectCount = 0;

  const optimizedRows = rows.map((row) => {
    const addressCell = row[indices.destinationAddress]?.trim();

    if (addressCell) {
      const optimized = buildOfficialAddress(addressCell);
      if (optimized && optimized !== addressCell) {
        row[indices.destinationAddress] = optimized;
        processedCount++;
      } else if (optimized) {
        row[indices.destinationAddress] = optimized;
        alreadyCorrectCount++;
      } else {
        unchangedCount++;
      }
    } else {
      unchangedCount++;
    }

    return row;
  });

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const outputFileName = `EnderecosOtimizados_${day}_${month}.xlsx`;

  const blob = createXlsxBlob(headers, optimizedRows, 'Enderecos');

  const elapsed = performance.now() - startTime;
  console.log('[ADDRESS OPTIMIZER] Optimization complete', {
    totalRows: rows.length,
    processedCount,
    alreadyCorrectCount,
    unchangedCount,
    outputFileName,
    processingTimeMs: elapsed.toFixed(2),
  });

  return { processedCount, outputFileName, blob };
}
