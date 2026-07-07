import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Save, QrCode, Trash2, Copy, Check, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import {
  getPaymentData,
  savePaymentData,
  clearPaymentData,
  type PaymentData,
} from '../services/paymentService';
import { ConfirmModal } from './ConfirmModal';

interface PaymentPageProps {
  onBack: () => void;
}

export function PaymentPage({ onBack }: PaymentPageProps) {
  const [pixCode, setPixCode] = useState('');
  const [savedData, setSavedData] = useState<PaymentData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showSaved, setShowSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const data = getPaymentData();
    setSavedData(data);
    if (data) {
      setPixCode(data.pixCode);
      generateQr(data.pixCode);
    }
  }, []);

  const generateQr = async (code: string) => {
    if (!code.trim()) {
      setQrDataUrl('');
      return;
    }
    try {
      const url = await QRCode.toDataURL(code.trim(), {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl('');
    }
  };

  const handleSave = useCallback(async () => {
    if (!pixCode.trim()) {
      setError('Preencha o código PIX.');
      return;
    }
    setError('');
    const data = savePaymentData(pixCode.trim());
    setSavedData(data);
    await generateQr(data.pixCode);
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  }, [pixCode]);

  const handleClear = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClear = useCallback(() => {
    clearPaymentData();
    setPixCode('');
    setSavedData(null);
    setQrDataUrl('');
    setShowClearConfirm(false);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!savedData?.pixCode) return;
    try {
      await navigator.clipboard.writeText(savedData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar o código.');
    }
  }, [savedData]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <button
            onClick={onBack}
            className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600">
              <QrCode className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Pagamento PIX
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Configuração */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Configurar dados de pagamento
          </h2>

          {showSaved && (
            <div className="mb-4 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              Dados salvos com sucesso!
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Código "Copia e Cola" PIX
              </label>
              <textarea
                value={pixCode}
                onChange={(e) => setPixCode(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                placeholder="00020126580014br.gov.bcb.pix0136..."
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={handleSave}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-medium text-white transition-colors hover:bg-emerald-700"
              >
                <Save className="h-4 w-4" />
                Salvar
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <Trash2 className="h-4 w-4" />
                Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {savedData && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
              QR Code gerado
            </h3>

            {qrDataUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={qrDataUrl}
                  alt="QR Code PIX"
                  className="h-48 w-48 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                />
              </div>
            )}

            <button
              onClick={handleCopy}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Código PIX copiado com sucesso!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar código PIX
                </>
              )}
            </button>

            <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
              <p className="break-all text-xs text-slate-600 dark:text-slate-400">
                {savedData.pixCode}
              </p>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Última atualização:{' '}
              {new Date(savedData.updatedAt).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </main>

      {showClearConfirm && (
        <ConfirmModal
          title="Limpar dados de pagamento?"
          message="Tem certeza que deseja limpar os dados de pagamento?"
          confirmLabel="Confirmar"
          confirmVariant="danger"
          onConfirm={confirmClear}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
}
