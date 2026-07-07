import { ShieldOff } from 'lucide-react';

interface SessionKickedModalProps {
  onConfirm: () => void;
}

export function SessionKickedModal({ onConfirm }: SessionKickedModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col items-center p-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ShieldOff className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
            Sessão encerrada
          </h2>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Sua sessão foi encerrada porque esta conta foi acessada em outro dispositivo.
          </p>
        </div>
        <div className="border-t border-slate-200 p-4 dark:border-slate-700">
          <button
            onClick={onConfirm}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
