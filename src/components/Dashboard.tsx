import { Package, CheckCircle2, XCircle, MapPin } from 'lucide-react';

interface DashboardProps {
  total: number;
  stops: number;
  checked: number;
}

export function Dashboard({ total, stops, checked }: DashboardProps) {
  const missing = Math.max(0, total - checked);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="grid grid-cols-2 gap-4">
        {/* Total pedidos */}
        <div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">Total pedidos</span>
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {total}
          </p>
        </div>

        {/* Paradas */}
        <div>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <MapPin className="h-4 w-4" />
            <span className="text-xs font-medium">Paradas</span>
          </div>
          <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            {stops}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Lidos
            </span>
            <span className="text-lg font-bold text-emerald-500">{checked}</span>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Faltantes
            </span>
            <span className="text-lg font-bold text-red-500">{missing}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
