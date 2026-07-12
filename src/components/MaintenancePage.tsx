import { useState } from 'react';
import { Trash2, CalendarPlus, AlertTriangle, Loader2 } from 'lucide-react';
import { getSessionUser } from '../services/authService';
import { ConfirmModal } from './ConfirmModal';

interface MaintenancePageProps {
  onAlert: (message: string) => void;
}

export function MaintenancePage({ onAlert }: MaintenancePageProps) {
  const [daysInput, setDaysInput] = useState('');
  const [clearingHistory, setClearingHistory] = useState(false);
  const [addingDays, setAddingDays] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showAddDaysConfirm, setShowAddDaysConfirm] = useState(false);

  const showAlert = (msg: string) => {
    onAlert(msg);
  };

  const handleClearHistory = async () => {
    setShowClearConfirm(false);
    setClearingHistory(true);
    try {
      const currentUser = await getSessionUser();
      if (!currentUser || !currentUser.isAdmin) {
        showAlert('Sem permissão. Apenas administradores.');
        return;
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clear-import-history`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({ requestingUserId: currentUser.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showAlert(err.error || `Erro ${response.status} ao limpar histórico.`);
        return;
      }

      const result = await response.json();
      if (result.error) {
        showAlert(result.error);
        return;
      }

      const parts = [`Histórico de importações removido: ${result.deletedHistory} registro(s).`];
      if (result.deletedSessions > 0) {
        parts.push(`${result.deletedSessions} sessão(ões) ativa(s) removida(s).`);
      }
      if (result.storageDeleted > 0) {
        parts.push(`${result.storageDeleted} arquivo(s) do Storage removido(s).`);
      }
      showAlert(parts.join(' '));
    } catch {
      showAlert('Erro de conexão ao limpar histórico.');
    } finally {
      setClearingHistory(false);
    }
  };

  const handleAddDaysClick = () => {
    const days = parseInt(daysInput, 10);
    if (isNaN(days) || days <= 0) {
      showAlert('Informe um número inteiro positivo maior que zero.');
      return;
    }
    setShowAddDaysConfirm(true);
  };

  const handleAddDays = async () => {
    setShowAddDaysConfirm(false);
    setAddingDays(true);
    try {
      const currentUser = await getSessionUser();
      if (!currentUser || !currentUser.isAdmin) {
        showAlert('Sem permissão. Apenas administradores.');
        return;
      }

      const days = parseInt(daysInput, 10);
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/add-days-to-all-users`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({ requestingUserId: currentUser.id, days }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showAlert(err.error || `Erro ${response.status} ao adicionar dias.`);
        return;
      }

      const result = await response.json();
      if (result.error) {
        showAlert(result.error);
        return;
      }

      showAlert(`Operação concluída com sucesso. Foram adicionados ${result.daysAdded} dias para ${result.updatedUsers} usuário(s).`);
      setDaysInput('');
    } catch {
      showAlert('Erro de conexão ao adicionar dias.');
    } finally {
      setAddingDays(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Manutenção
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Operações administrativas de limpeza e ações globais no sistema.
        </p>
      </div>

      {/* Apagar Histórico Card */}
      <div className="mb-6 rounded-2xl border border-red-200 bg-white p-5 dark:border-red-900/40 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Apagar Histórico de Importações
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Remove permanentemente todo o histórico de importações (XLSX e PDF), logs e dados temporários.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
            <p className="text-xs text-red-700 dark:text-red-300">
              Esta ação não poderá ser desfeita. Todos os registros de importação, arquivos e sessões ativas serão removidos. Usuários, administradores e configurações do sistema não serão afetados.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={clearingHistory}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
        >
          {clearingHistory ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="h-5 w-5" />
              Apagar Histórico
            </>
          )}
        </button>
      </div>

      {/* Adicionar Dias Card */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <CalendarPlus className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Adicionar dias para todos os usuários
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Adiciona dias ao período de acesso de todos os usuários comuns ativos. Os dias são somados ao prazo atual.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-900 dark:text-white">
            Número de dias
          </label>
          <input
            type="number"
            min={1}
            value={daysInput}
            onChange={(e) => setDaysInput(e.target.value)}
            placeholder="Ex: 30"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Apenas números inteiros positivos. Zero e valores negativos não são permitidos.
          </p>
        </div>

        <button
          onClick={handleAddDaysClick}
          disabled={addingDays || !daysInput}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
        >
          {addingDays ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Aplicando...
            </>
          ) : (
            <>
              <CalendarPlus className="h-5 w-5" />
              Aplicar
            </>
          )}
        </button>
      </div>

      {/* Clear History Confirmation Modal */}
      {showClearConfirm && (
        <ConfirmModal
          title="Apagar Histórico de Importações?"
          message="Esta ação removerá permanentemente todo o histórico de importações (XLSX e PDF), incluindo arquivos, logs e dados temporários relacionados às importações. Esta operação não poderá ser desfeita. Deseja continuar?"
          confirmLabel="Apagar Histórico"
          cancelLabel="Cancelar"
          confirmVariant="danger"
          onConfirm={handleClearHistory}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {/* Add Days Confirmation Modal */}
      {showAddDaysConfirm && (
        <ConfirmModal
          title="Confirmar adição de dias"
          message={`Deseja realmente adicionar ${daysInput} dias para todos os usuários do sistema?`}
          confirmLabel="Confirmar"
          cancelLabel="Cancelar"
          confirmVariant="primary"
          onConfirm={handleAddDays}
          onCancel={() => setShowAddDaysConfirm(false)}
        />
      )}
    </div>
  );
}
