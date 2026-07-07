import * as XLSX from 'xlsx';
import type { RawRow } from '../types';

export interface ImportResult {
  rows: RawRow[];
  headers: string[];
}

export async function importXlsx(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  if (data.length < 2) {
    return { rows: [], headers: [] };
  }

  const headers = (data[0] ?? []).map((h) => String(h ?? ''));
  const body = data.slice(1);

  const rows: RawRow[] = body.map((row, index) => {
    const cells = row.map((c) => String(c ?? '').trim());
    return {
      colA: cells[0] ?? '',
      sequence: cells[1] ?? '',
      colC: cells[2] ?? '',
      spxTn: cells[3] ?? '',
      destinationAddress: cells[4] ?? '',
      colF: cells[5] ?? '',
      colG: cells[6] ?? '',
      colH: cells[7] ?? '',
      colI: cells[8] ?? '',
      colJ: cells[9] ?? '',
      extra: cells.slice(10),
      originalIndex: index,
    };
  });

  return { rows, headers };
}

/**
 * Importa um PDF com colunas "#" (sequence) e "Notes" (SPX TN).
 * O campo Notes contém um ";" ao final de cada SPX TN que deve ser removido.
 */
export async function importPdf(file: File): Promise<ImportResult> {
  try {
    const pdfjs = await import('pdfjs-dist');

    // Configura o worker usando o padrão new URL (compatível com Vite)
    const workerUrl = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).href;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({
      data: buffer,
      // Tenta usar worker; se falhar, fallback para main thread
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    const pageLines: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();

      type TextItem = { str: string; x: number; y: number };
      const items: TextItem[] = [];

      for (const item of content.items) {
        if (!('str' in item) || !(item as { str: string }).str) continue;
        const str = (item as { str: string }).str;
        const transform = (item as { transform?: number[] }).transform;
        if (!transform) {
          items.push({ str, x: 0, y: 0 });
          continue;
        }
        items.push({ str, x: transform[4], y: transform[5] });
      }

      const yMap = new Map<number, TextItem[]>();
      for (const item of items) {
        const yKey = Math.round(item.y);
        if (!yMap.has(yKey)) yMap.set(yKey, []);
        yMap.get(yKey)!.push(item);
      }

      const sortedYs = [...yMap.keys()].sort((a, b) => b - a);
      for (const y of sortedYs) {
        const lineItems = yMap.get(y)!;
        lineItems.sort((a, b) => a.x - b.x);
        const lineText = lineItems.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
        if (lineText) pageLines.push(lineText);
      }
    }

    const fullText = pageLines.join('\n');
    return parsePdfText(fullText);
  } catch (err) {
    const message =
      err instanceof Error
        ? `Erro ao processar PDF: ${err.message}`
        : 'Erro ao processar PDF. Verifique se o arquivo é válido.';
    throw new Error(message);
  }
}

/**
 * Parseia o texto extraído do PDF (já dividido em linhas por coordenada Y).
 *
 * Layout real do PDF (4 colunas):
 *   #  |  Address  |  Estimated Arrival Time  |  Notes (SPX TN com ;)
 *
 * Exemplo de linha reconstruída:
 *   "1 Avenida Matapi, 40, Ap 707 bl 3, São Paulo 19:00 BR268251580957W;"
 *
 * Estratégia de parse:
 *   1. Linha começa com dígito(s) seguido de espaço + texto (o #).
 *   2. Contém um token de horário HH:MM que separa Address de Notes.
 *   3. O SPX TN é o token após o horário, terminando com ";" (removido).
 */
function parsePdfText(text: string): ImportResult {
  const rows: RawRow[] = [];
  let originalIndex = 0;

  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  // Padrão principal: <#> <Address> <HH:MM> <SPX_TN>;
  // O horário HH:MM é o âncora que separa endereço de Notes.
  // Captura: (sequence)(address)(time)(spxTn)
  const lineRegex = /^(\d+)\s+(.+?)\s+(\d{1,2}:\d{2})\s+([A-Za-z0-9]{6,})\s*;*\s*$/;

  for (const line of lines) {
    const m = line.match(lineRegex);
    if (!m) continue;

    const sequence = m[1].trim();
    const address = m[2].trim();
    const spxTn = m[4].replace(/;+$/, '').trim();

    // Ignora cabeçalhos e linhas sem endereço real
    if (!address || !spxTn) continue;

    rows.push({
      colA: '',
      sequence,
      colC: '',
      spxTn,
      destinationAddress: address,
      colF: '',
      colG: '',
      colH: '',
      colI: '',
      colJ: '',
      extra: [],
      originalIndex: originalIndex++,
    });
  }

  // Fallback: sem horário no PDF, tenta extrair apenas # e SPX TN
  if (rows.length === 0) {
    const tokenRegex = /(\d+)\s+([A-Za-z0-9]{6,})\s*;+/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(text)) !== null) {
      rows.push({
        colA: '',
        sequence: match[1],
        colC: '',
        spxTn: match[2].replace(/;+$/, '').trim(),
        destinationAddress: '',
        colF: '',
        colG: '',
        colH: '',
        colI: '',
        colJ: '',
        extra: [],
        originalIndex: originalIndex++,
      });
    }
  }

  return {
    rows,
    headers: ['#', 'Address', 'Estimated Arrival Time', 'Notes'],
  };
}
