import { buildOfficialAddress } from './normalizeService';
import {
  readXlsxByHeaders,
  findColumnIndices,
  createXlsxBlob,
  buildDateSuffix,
} from './xlsxReaderService';

export interface AddressOptimizeResult {
  processedCount: number;
  outputFileName: string;
  blob: Blob;
}

export async function optimizeAddressesFile(file: File): Promise<AddressOptimizeResult> {
  const { headers, rows } = await readXlsxByHeaders(file);

  if (rows.length === 0) {
    return { processedCount: 0, outputFileName: '', blob: new Blob() };
  }

  const indices = findColumnIndices(headers);

  if (indices.destinationAddress === -1) {
    throw new Error(
      'Coluna de endereço não encontrada. Verifique se a planilha possui um cabeçalho de endereço (ex: "Destination Address", "Endereco").',
    );
  }

  let processedCount = 0;

  const optimizedRows = rows.map((row) => {
    const addressCell = row[indices.destinationAddress]?.trim();

    if (addressCell) {
      const optimized = buildOfficialAddress(addressCell);
      if (optimized && optimized !== addressCell) {
        row[indices.destinationAddress] = optimized;
        processedCount++;
      } else if (optimized) {
        row[indices.destinationAddress] = optimized;
      }
    }

    return row;
  });

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const outputFileName = `EnderecosOtimizados_${day}_${month}.xlsx`;

  const blob = createXlsxBlob(headers, optimizedRows, 'Enderecos');

  return { processedCount, outputFileName, blob };
}
