import { useEffect, useState } from 'react';
import { X, Copy, Check, Share2, Gift, Users, Award, TrendingUp } from 'lucide-react';
import { getMyReferralInfo, type ReferralInfo } from '../services/referralService';

interface ReferralModalProps {
  onClose: () => void;
}

export function ReferralModal({ onClose }: ReferralModalProps) {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    getMyReferralInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = async () => {
    if (!info?.referralCode) return;
    try {
      await navigator.clipboard.writeText(info.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = info.referralCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!info?.referralCode) return;

    const shareUrl = window.location.origin;
    const message = `Venha conhecer o melhor otimizador de rotas!\n\nCadastre-se utilizando meu código de indicação:\n${info.referralCode}\n\nAcesse:\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Indicação',
          text: message,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // User cancelled — do nothing
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(message);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch {
        // Ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="animate-slide-up w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Indicação
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
            </div>
          ) : info ? (
            <>
              {/* Code display */}
              <div className="mb-6 text-center">
                <p className="mb-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Seu código
                </p>
                <div className="inline-block rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50 px-8 py-4 dark:border-brand-700 dark:bg-brand-900/20">
                  <span className="text-3xl font-bold tracking-widest text-brand-600 dark:text-brand-400">
                    {info.referralCode ?? '—'}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="mb-6 space-y-3">
                <button
                  onClick={handleCopy}
                  disabled={!info.referralCode}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-700 disabled:opacity-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Código copiado com sucesso!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar código
                    </>
                  )}
                </button>
                <button
                  onClick={handleShare}
                  disabled={!info.referralCode}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  {shared ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-500" />
                      Compartilhado!
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      Compartilhar convite
                    </>
                  )}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Users className="h-4 w-4" />
                    <span className="text-xs font-medium">Indicações</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {info.totalReferred}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Award className="h-4 w-4" />
                    <span className="text-xs font-medium">Dias ganhos</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {info.totalBonusDays}
                  </p>
                </div>
              </div>

              {/* Referred by */}
              {info.referredBy && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Indicado por <span className="font-semibold text-slate-700 dark:text-slate-200">{info.referredBy}</span>
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Não foi possível carregar as informações de indicação.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
