import { useRef, useState } from 'react';
import { Upload as UploadIcon, Loader2, Truck, Users, MapPin, FileSpreadsheet, Download } from 'lucide-react';
import { importPdf } from '../services/importService';
import { findByFileName, addFrotaImportEntry, type HistoryEntry } from '../services/historyService';
import { optimizeAddressesFile } from '../services/addressOptimizerService';
import { optimizeFrotaFile } from '../services/frotaOptimizerService';
import { DuplicateFileModal } from './DuplicateFileModal';
import type { RawRow } from '../types';

interface ImportCardsProps {
  onImport: (rows: RawRow[], headers: string[], fileName: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  onResumeEntry: (entry: HistoryEntry) => void;
}

export function ImportCards({ onImport, onError, disabled = false, onResumeEntry }: ImportCardsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [existingEntry, setExistingEntry] = useState<HistoryEntry | null>(null);

  const [addressLoading, setAddressLoading] = useState(false);
  const [addressResult, setAddressResult] = useState<{ blob: Blob; fileName: string } | null>(null);

  const frotaInputRef = useRef<HTMLInputElement>(null);
  const [frotaLoading, setFrotaLoading] = useState(false);
  const [frotaResult, setFrotaResult] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [frotaStats, setFrotaStats] = useState<{ totalRows: number; outputRows: number; duplicatesRemoved: number } | null>(null);

  const processFile = async (file: File) => {
    console.log('[IMPORT CARDS] Starting file processing', {
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(2)} KB`,
      fileType: file.type || 'unknown',
    });

    setValidating(true);
    setFileName(file.name);

    try {
      // Verifica se arquivo ja existe
      const existing = await findByFileName(file.name);
      if (existing) {
        console.log('[IMPORT CARDS] File already exists in history', {
          fileName: file.name,
          existingEntryId: existing.id,
        });
        setPendingFile(file);
        setExistingEntry(existing);
        setValidating(false);
        return;
      }

      console.log('[IMPORT CARDS] Starting import');
      setValidating(false);
      setLoading(true);

      const { rows, headers } = await importPdf(file);

      console.log('[IMPORT CARDS] Import result', {
        rowsFound: rows.length,
        headersCount: headers.length,
        headers,
      });

      if (rows.length === 0) {
        console.error('[IMPORT CARDS] IMPORT RETURNED ZERO ROWS - Check PARSE PDF logs for details');
        onError?.('Nenhum pedido encontrado no arquivo.');
      } else {
        console.log('[IMPORT CARDS] Import successful, passing to callback');
        onImport(rows, headers, file.name);
      }
    } catch (err) {
      console.error('[IMPORT CARDS] Import error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      const msg = err instanceof Error ? err.message : 'Erro ao importar arquivo.';
      onError?.(msg);
    } finally {
      setLoading(false);
      setValidating(false);
    }
  };

  const handleFile = async (file: File) => {
    await processFile(file);
  };

  const handleResumeExisting = () => {
    if (existingEntry) {
      onResumeEntry(existingEntry);
      setExistingEntry(null);
      setPendingFile(null);
    }
  };

  const handleImportAnyway = async () => {
    if (!pendingFile) return;

    console.log('[IMPORT CARDS] Import anyway (duplicate)', {
      fileName: pendingFile.name,
      fileSize: `${(pendingFile.size / 1024).toFixed(2)} KB`,
    });

    setExistingEntry(null);
    setValidating(true);

    try {
      setValidating(false);
      setLoading(true);

      const { rows, headers } = await importPdf(pendingFile);

      console.log('[IMPORT CARDS] Import anyway result', {
        rowsFound: rows.length,
        headersCount: headers.length,
      });

      if (rows.length === 0) {
        console.error('[IMPORT CARDS] IMPORT RETURNED ZERO ROWS - Check PARSE PDF logs for details');
        onError?.('Nenhum pedido encontrado no arquivo.');
      } else {
        onImport(rows, headers, pendingFile.name);
      }
    } catch (err) {
      console.error('[IMPORT CARDS] Import anyway error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      const msg = err instanceof Error ? err.message : 'Erro ao importar arquivo.';
      onError?.(msg);
    } finally {
      setLoading(false);
      setValidating(false);
      setPendingFile(null);
    }
  };

  const isDisabled = disabled || loading || validating;

  const handleAddressFile = async (file: File) => {
    setAddressResult(null);
    setAddressLoading(true);

    try {
      const { blob, outputFileName } = await optimizeAddressesFile(file);
      if (!outputFileName) {
        onError?.('Nenhum endereço encontrado no arquivo.');
      } else {
        setAddressResult({ blob, fileName: outputFileName });
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao processar endereços.';
      onError?.(msg);
    } finally {
      setAddressLoading(false);
    }
  };

  const downloadAddressFile = () => {
    if (!addressResult) return;
    const url = URL.createObjectURL(addressResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = addressResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setAddressResult(null);
  };

  const handleFrotaFile = async (file: File) => {
    setFrotaResult(null);
    setFrotaStats(null);
    setFrotaLoading(true);

    try {
      const result = await optimizeFrotaFile(file);

      if (result.outputRows === 0 && result.totalRows === 0) {
        onError?.('Nenhum dado encontrado no arquivo.');
        return;
      }

      // Persist to database
      try {
        await addFrotaImportEntry(
          file.name,
          result.totalRows,
          result.outputRows,
          result.duplicatesRemoved,
          result.headers,
          result.rows,
        );
      } catch (dbErr) {
        console.error('Failed to persist frota import:', dbErr);
      }

      setFrotaResult({ blob: result.blob, fileName: result.outputFileName });
      setFrotaStats({
        totalRows: result.totalRows,
        outputRows: result.outputRows,
        duplicatesRemoved: result.duplicatesRemoved,
      });
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo Frota.';
      onError?.(msg);
    } finally {
      setFrotaLoading(false);
    }
  };

  const downloadFrotaFile = () => {
    if (!frotaResult) return;
    const url = URL.createObjectURL(frotaResult.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = frotaResult.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setFrotaResult(null);
    setFrotaStats(null);
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          disabled={isDisabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />

        {/* Card 1 - Otimizar Flex */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <Truck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Otimizar Flex
              </h3>
            </div>
          </div>

          <p className="
    mb-5
    min-h-[88px]
    text-sm
    leading-relaxed
    text-slate-500
    dark:text-slate-400
  ">
            Importe o PDF do circuit para iniciar a otimizacao das entregas.
          </p>

          <button
            onClick={() => inputRef.current?.click()}
            disabled={isDisabled}
           className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          
          >
            {validating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </>
            ) : loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : disabled ? (
              <>
                <UploadIcon className="h-4 w-4" />
                Importar PDF
              </>
            ) : (
              <>
                <UploadIcon className="h-4 w-4" />
                Importar PDF
              </>
            )}
          </button>

          {fileName && !loading && !validating && (
            <p className="mt-3 truncate text-xs text-slate-400">
              {fileName}
            </p>
          )}
        </div>

        {/* Card 2 - Otimizar Frota */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-blue-700">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Otimizar Frota
              </h3>
            </div>
          </div>

          <p className="
    mb-5
    min-h-[88px]
    text-sm
    leading-relaxed
    text-slate-500
    dark:text-slate-400
  ">
            Padronize endereços, una duplicatas e consolide sequências.
          </p>

          {frotaStats && frotaResult && !frotaLoading && (
            <div className="mb-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-100 p-2.5 text-center dark:bg-slate-700/50">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {frotaStats.totalRows}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pedidos
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-2.5 text-center dark:bg-blue-900/30">
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {frotaStats.duplicatesRemoved}
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400">
                    Unificados
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-2.5 text-center dark:bg-emerald-900/30">
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {frotaStats.outputRows}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Paradas
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => frotaResult ? downloadFrotaFile() : frotaInputRef.current?.click()}
            disabled={disabled || frotaLoading}
           className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            {frotaLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : frotaResult ? (
              <>
                <Download className="h-4 w-4" />
                Baixar Romaneio
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Importar XLSX
              </>
            )}
          </button>
          <input
            ref={frotaInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFrotaFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {/* Card 3 - Otimizar Endereços */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700">
              <MapPin className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Otimizar Endereços
              </h3>
            </div>
          </div>

          <p className="
    mb-5
    min-h-[88px]
    text-sm
    leading-relaxed
    text-slate-500
    dark:text-slate-400
  ">
            Padronize e limpe os endereços de um arquivo XLSX.
          </p>

          {addressResult && !addressLoading && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-2.5 dark:bg-emerald-900/20">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Arquivo processado com sucesso! Clique no botão abaixo para fazer o download.
              </p>
            </div>
          )}

          <button
            onClick={() => addressResult ? downloadAddressFile() : addressInputRef.current?.click()}
            disabled={disabled || addressLoading}
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
          >
            {addressLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : addressResult ? (
              <>
                <Download className="h-4 w-4" />
                Baixar Arquivo
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Importar XLSX
              </>
            )}
          </button>
          <input
            ref={addressInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAddressFile(file);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {/* Duplicate file modal */}
      {existingEntry && (
        <DuplicateFileModal
          fileName={existingEntry.fileName}
          onResume={handleResumeExisting}
          onImportAgain={handleImportAnyway}
          onClose={() => {
            setExistingEntry(null);
            setPendingFile(null);
            setFileName(null);
          }}
        />
      )}
    </>
  );
}
