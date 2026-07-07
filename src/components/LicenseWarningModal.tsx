import { AlertTriangle, X } from 'lucide-react';

interface LicenseWarningModalProps {
  /** User-facing message (single line) or null */
  userMessage: string | null;
  /** Admin-facing list of expired user names or null */
  expiredUsers: string[] | null;
  onClose: () => void;
}

export function LicenseWarningModal({
  userMessage,
  expiredUsers,
  onClose,
}: LicenseWarningModalProps) {
  if (!userMessage && (!expiredUsers || expiredUsers.length === 0)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="animate-slide-up w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userMessage && (
          <p className="text-base font-medium text-slate-900 dark:text-white">
            {userMessage}
          </p>
        )}

        {expiredUsers && expiredUsers.length > 0 && (
          <div>
            <p className="text-base font-medium text-slate-900 dark:text-white">
              {expiredUsers.length === 1
                ? 'O seguinte usuário está com a licença vencida:'
                : 'Os seguintes usuários estão com a licença vencida:'}
            </p>
            <ul className="mt-3 space-y-1.5">
              {expiredUsers.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
