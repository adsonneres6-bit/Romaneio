import { useRef, useState } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, FileText, Loader2, Lock } from 'lucide-react';
import { importXlsx, importPdf } from '../services/importService';
import { validateLicenseForImport } from '../services/validateLicenseService';
import type { RawRow } from '../types';

interface UploadProps {
  onImport: (rows: RawRow[], headers: string[]) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  userId?: string;
}

export function Upload({ onImport, onError, disabled = true, userId }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<'xlsx' | 'pdf' | null>(null);

  const handleFile = async (file: File) => {
    // Always validate license on backend before processing
    if (!userId) {
      onError?.('Usuário não identificado. Faça login novamente.');
      return;
    }

    setValidating(true);
    setFileName(file.name);

    try {
      // Validate license on backend
      const validation = await validateLicenseForImport(userId);

      if (!validation.valid) {
        onError?.(validation.message || 'Sua licença está vencida. Renove para importar arquivos.');
        setValidating(false);
        setFileName(null);
        return;
      }

      // License is valid, proceed with import
      setValidating(false);
      setLoading(true);
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      setFileKind(isPdf ? 'pdf' : 'xlsx');

      const { rows, headers } = isPdf
        ? await importPdf(file)
        : await importXlsx(file);

      if (rows.length === 0) {
        onError?.('Nenhum pedido encontrado no arquivo.');
      } else {
        onImport(rows, headers);
      }
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Erro ao importar arquivo.';
      onError?.(msg);
    } finally {
      setLoading(false);
      setValidating(false);
    }
  };

  const isDisabled = disabled || loading || validating;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
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
      <button
        onClick={() => inputRef.current?.click()}
        disabled={isDisabled}
        className="flex w-full items-center justify-center gap-3 rounded-xl bg-brand-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-brand-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {validating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
          
          </>
        ) : loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Importando...
          </>
        ) : disabled ? (
          <>
            <Lock className="h-5 w-5" />
            Importar PDF
          </>
        ) : (
          <>
            <UploadIcon className="h-5 w-5" />
            Importar PDF
          </>
        )}
      </button>
      {fileName && !loading && !validating && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {fileKind === 'pdf' ? (
            <FileText className="h-4 w-4 text-red-500" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
          )}
          <span className="truncate">{fileName}</span>
        </div>
      )}
    </div>
  );
}
