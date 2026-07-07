import { useEffect, useState } from 'react';
import { Copy, Check, QrCode, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import { getPaymentData } from '../services/paymentService';

export function PixPaymentPanel() {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const paymentData = getPaymentData();

  useEffect(() => {
    if (!paymentData?.pixCode) return;
    QRCode.toDataURL(paymentData.pixCode, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setError('Não foi possível gerar o QR Code.'));
  }, [paymentData?.pixCode]);

  const handleCopy = async () => {
    if (!paymentData?.pixCode) return;
    try {
      await navigator.clipboard.writeText(paymentData.pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar o código.');
    }
  };

  if (!paymentData?.pixCode) {
    return (
      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
        Nenhum dado de pagamento PIX cadastrado. Entre em contato com o administrador.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </div>
      )}

      {/* QR Code */}
      <div className="flex justify-center">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code PIX"
            className="h-48 w-48 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700">
            <QrCode className="h-12 w-12 text-slate-300" />
          </div>
        )}
      </div>

      {/* Copiar */}
      <button
        onClick={handleCopy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
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

      {/* Código PIX */}
      <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-900">
        <p className="break-all text-xs text-slate-600 dark:text-slate-400">
          {paymentData.pixCode}
        </p>
      </div>

      {/* Aviso amarelo */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-100 px-4 py-3 dark:bg-amber-900/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Aguardando confirmação do pagamento. Assim que o pagamento for confirmado pelo
          administrador, sua licença será renovada automaticamente.
        </p>
      </div>
    </div>
  );
}
