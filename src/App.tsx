import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun, ArrowUp, Menu, X, History, Users, PlayCircle, Home, Download } from 'lucide-react';
import type { RawRow, DeliveryGroup, CheckState } from './types';
import {
  groupDeliveriesWithOptions,
  detectPotentialGroups,
  type PotentialGroup,
} from './services/groupingService';
import { assignSequences } from './services/sequencingService';
import { getApkCircuitUrl } from './services/settingsService';
import { GroupingConfirmModal } from './components/GroupingConfirmModal';
import {
  createCheckState,
  checkSpxTn,
  getCheckedCount,
  getTotalCount,
} from './services/checkService';
import { playSuccess, playError, playWarning } from './services/soundService';
import { ImportCards } from './components/ImportCards';
import { Dashboard } from './components/Dashboard';
import { Scanner } from './components/Scanner';
import { SearchComponent } from './components/Search';
import { DeliveryList } from './components/DeliveryList';
import { ExportModal } from './components/Export';
import { ToastContainer, type ToastData, type ToastType } from './components/Toast';
import { HistoryModal } from './components/HistoryModal';
import { ScanPopup } from './components/ScanPopup';
import { AdminPage } from './components/AdminPage';
import { AdminPasswordGate } from './components/AdminPasswordGate';
import { UpdateModal } from './components/UpdateModal';
import { GlobalAnnouncementModal } from './components/GlobalAnnouncementModal';
import { TutorialsPage } from './components/TutorialsPage';
import { WelcomeModal } from './components/WelcomeModal';
import { InfoModal } from './components/InfoModal';
import {
  getActiveAnnouncements,
  confirmAnnouncement,
  type GlobalAnnouncement,
} from './services/announcementService';
import { getTutorialInterfaceUrl, getTutorialFrotaUrl } from './services/settingsService';
import {
  hasSeenWelcomeModal,
  markWelcomeModalSeen,
  hasSeenInfoModal,
  markInfoModalSeen,
} from './services/welcomeService';
import { usePWAUpdate } from './hooks/usePWAUpdate';
import {
  getHistory,
  addImportEntry,
  updateExportEntry,
  updateHistoryProgress,
  type HistoryEntry,
} from './services/historyService';
import {
  getActiveSession,
  saveActiveSession,
  clearActiveSession,
} from './services/sessionService';
import { getInstallationId } from './services/installationService';
import { CheckCircle } from 'lucide-react';

function App() {
  const { needRefresh, updateSW } = usePWAUpdate();
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [rows, setRows] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [groups, setGroups] = useState<DeliveryGroup[]>([]);
  const [checkState, setCheckState] = useState<CheckState>({
    checked: {},
    spxToGroup: {},
  });
  const [lastSequence, setLastSequence] = useState<string | null>(null);
  const [alreadyRead, setAlreadyRead] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [popupData, setPopupData] = useState<{
    group: DeliveryGroup;
    checkedSpxTns: Record<string, boolean>;
    alreadyRead: boolean;
    lastReadSequence: string;
  } | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    rows: RawRow[];
    headers: string[];
    potentialGroups: PotentialGroup[];
    fileName: string;
  } | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [apkCircuitUrl, setApkCircuitUrlState] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string>('');

  const [activeAnnouncement, setActiveAnnouncement] = useState<GlobalAnnouncement | null>(null);

  const [showTutorialsPage, setShowTutorialsPage] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const installationId = useMemo(() => getInstallationId(), []);

  useEffect(() => {
    getApkCircuitUrl().then(setApkCircuitUrlState);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const active = await getActiveSession();
        if (mounted && active && !active.completed) {
          setRows(active.rows);
          setHeaders(active.headers);
          setGroups(active.groups);
          setCheckState(active.checkState);
          setCurrentHistoryId(active.id);
          setActiveFileName(active.fileName);
        }
      } catch {
        // No active session is fine
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    init();

    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const checkAnnouncements = async () => {
      const announcements = await getActiveAnnouncements('after_login', installationId);
      if (announcements.length > 0) {
        setActiveAnnouncement(announcements[0]);
      }
    };
    checkAnnouncements();
  }, [installationId]);

  useEffect(() => {
    const checkTutorialsAndWelcome = async () => {
      const [interfaceUrl, flexUrl, frotaUrl] = await Promise.all([
        getTutorialInterfaceUrl(),
        getTutorialFlexUrl(),
        getTutorialFrotaUrl(),
      ]);

      const hasTutorials = !!(interfaceUrl.trim() || flexUrl.trim() || frotaUrl.trim());
      if (!hasTutorials) return;

      const seenWelcome = await hasSeenWelcomeModal();
      if (!seenWelcome) {
        setShowWelcomeModal(true);
      }
    };
    checkTutorialsAndWelcome();
  }, []);

  const groupsRef = useRef<DeliveryGroup[]>(groups);
  const checkStateRef = useRef<CheckState>(checkState);
  const rowsRef = useRef<RawRow[]>(rows);
  const headersRef = useRef<string[]>(headers);
  const currentHistoryIdRef = useRef<string | null>(currentHistoryId);
  const activeFileNameRef = useRef<string>(activeFileName);
  groupsRef.current = groups;
  checkStateRef.current = checkState;
  rowsRef.current = rows;
  headersRef.current = headers;
  currentHistoryIdRef.current = currentHistoryId;
  activeFileNameRef.current = activeFileName;

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshHistory = useCallback(async () => {
    const entries = await getHistory();
    setHistoryEntries(entries);
  }, []);

  const handleGoHome = useCallback(() => {
    setRows([]);
    setHeaders([]);
    setGroups([]);
    setCheckState({ checked: {}, spxToGroup: {} });
    setCurrentHistoryId(null);
    setActiveFileName('');
    setPopupData(null);
    setLastSequence(null);
    setAlreadyRead(false);
    setMenuOpen(false);
    clearActiveSession();
  }, []);

  const handleResumeFromHistory = useCallback(
    (entry: HistoryEntry) => {
      setRows(entry.rows);
      setHeaders(entry.headers);
      setGroups(entry.groups);
      let stateToUse = entry.checkState;
      if (Object.keys(entry.checkState.spxToGroup).length === 0 && entry.groups.length > 0) {
        stateToUse = createCheckState(entry.groups);
        if (entry.checkState.checked && Object.keys(entry.checkState.checked).length > 0) {
          stateToUse.checked = { ...entry.checkState.checked };
        }
      }
      setCheckState(stateToUse);
      setCurrentHistoryId(entry.id);
      setActiveFileName(entry.fileName);
      setPopupData(null);
      setLastSequence(null);
      setAlreadyRead(false);
      setMenuOpen(false);
      saveActiveSession(entry.id, entry.fileName, entry.rows, entry.groups, entry.headers, stateToUse);
      addToast('success', 'Importacao retomada com sucesso.');
    },
    [addToast]
  );

  const finalizeImport = useCallback(
    async (importedRows: RawRow[], hdrs: string[], groupingEnabled: boolean, fileName: string) => {
      setRows(importedRows);
      setHeaders(hdrs);
      const grouped = groupDeliveriesWithOptions(importedRows, groupingEnabled);
      const sequenced = assignSequences(grouped, importedRows, true);
      setGroups(sequenced);
      const state = createCheckState(sequenced);
      setCheckState(state);
      setPopupData(null);
      setLastSequence(null);
      setAlreadyRead(false);
      setShowUpload(false);
      setMenuOpen(false);
      setPendingImport(null);

      try {
        const entry = await addImportEntry(importedRows, sequenced, hdrs, fileName, state);
        if (entry) {
          setCurrentHistoryId(entry.id);
          setActiveFileName(fileName);
          await saveActiveSession(entry.id, fileName, importedRows, sequenced, hdrs, state);
        }
        await refreshHistory();
        const msg = groupingEnabled
          ? `${importedRows.length} pedidos importados e agrupados.`
          : `${importedRows.length} pedidos importados.`;
        addToast('success', msg);
      } catch {
        addToast('error', 'Erro ao salvar historico.');
      }
    },
    [addToast, refreshHistory]
  );

  const handleImport = useCallback(
    (importedRows: RawRow[], hdrs: string[], fileName: string) => {
      const potential = detectPotentialGroups(importedRows);
      if (potential.length > 0) {
        setPendingImport({
          rows: importedRows,
          headers: hdrs,
          potentialGroups: potential,
          fileName,
        });
      } else {
        finalizeImport(importedRows, hdrs, false, fileName);
      }
    },
    [finalizeImport]
  );

  const handleGroupingConfirm = useCallback(() => {
    if (!pendingImport) return;
    finalizeImport(pendingImport.rows, pendingImport.headers, true, pendingImport.fileName);
  }, [pendingImport, finalizeImport]);

  const handleGroupingCancel = useCallback(() => {
    if (!pendingImport) return;
    finalizeImport(pendingImport.rows, pendingImport.headers, false, pendingImport.fileName);
  }, [pendingImport, finalizeImport]);

  const handleScan = useCallback(
    (decoded: string) => {
      const currentGroups = groupsRef.current;
      const currentState = checkStateRef.current;
      const currentRows = rowsRef.current;
      const currentHeaders = headersRef.current;
      const currentHistoryId = currentHistoryIdRef.current;
      const currentFileName = activeFileNameRef.current;

      const result = checkSpxTn(decoded, currentState, currentGroups, currentRows);

      if (result.status === 'not_found') {
        playError();
        addToast('error', 'Pedido não encontrado.');
        return;
      }

      if (result.status === 'already_checked') {
        playWarning();
        setLastSequence(result.individualSequence);
        setAlreadyRead(true);
        setPopupData({
          group: result.group,
          checkedSpxTns: { ...currentState.checked },
          alreadyRead: true,
          lastReadSequence: result.individualSequence,
        });
        return;
      }

      playSuccess();
      setLastSequence(result.individualSequence);
      setAlreadyRead(false);
      setPopupData({
        group: result.group,
        checkedSpxTns: { ...currentState.checked },
        alreadyRead: false,
        lastReadSequence: result.individualSequence,
      });

      const newGroups = [...currentGroups];
      const newState = { ...currentState };
      setGroups(newGroups);
      setCheckState(newState);

      if (currentHistoryId) {
        saveActiveSession(
          currentHistoryId,
          currentFileName,
          currentRows,
          newGroups,
          currentHeaders,
          newState
        );
        updateHistoryProgress(currentHistoryId, newGroups, newState);
      }

      const checkedCount = Object.values(newState.checked).filter(Boolean).length;
      const totalCount = Object.keys(newState.checked).length;
      if (totalCount > 0 && checkedCount >= totalCount) {
        setTimeout(() => {
          clearActiveSession();
          setShowCompletionModal(true);
        }, 4000);
      }
    },
    [addToast]
  );

  const handleScannerError = useCallback(
    (msg: string) => {
      addToast('error', `Erro na câmera: ${msg}`);
    },
    [addToast]
  );

  const handleExportClose = useCallback(async () => {
    if (currentHistoryId) {
      try {
        await updateExportEntry(currentHistoryId, groups, checkState);
        await refreshHistory();
      } catch {
        addToast('error', 'Erro ao atualizar histórico.');
      }
    }
    setShowExport(false);
    setMenuOpen(false);
  }, [currentHistoryId, groups, checkState, refreshHistory, addToast]);

  const total = useMemo(() => getTotalCount(checkState), [checkState]);
  const checked = useMemo(() => getCheckedCount(checkState), [checkState]);

  const hasData = rows.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
          <p className="text-sm text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (showAdminGate && !showAdmin) {
    return (
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen bg-slate-100 dark:bg-slate-900" />
        <AdminPasswordGate
          onSuccess={() => {
            setShowAdminGate(false);
            setShowAdmin(true);
          }}
          onCancel={() => setShowAdminGate(false)}
        />
      </div>
    );
  }

  if (showAdmin) {
    return (
      <div className={dark ? 'dark' : ''}>
        <AdminPage onBack={() => setShowAdmin(false)} />
      </div>
    );
  }

  if (showTutorialsPage) {
    return (
      <div className={dark ? 'dark' : ''}>
        <TutorialsPage
          userId={installationId}
          onBack={() => setShowTutorialsPage(false)}
        />
      </div>
    );
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <ToastContainer toasts={toasts} onClose={removeToast} />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <img
                src="/icons/icon-192x192.png"
                alt="Otimizador De Rota"
                className="h-9 w-9 rounded-xl object-contain"
              />
              <div>
                <h1 className="text-base font-bold leading-tight">Otimizador De Rota</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasData && (
                <button
                  onClick={handleGoHome}
                  className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Voltar para inicio"
                >
                  <Home className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setDark((d) => !d)}
                className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((m) => !m)}
                  className="cursor-pointer rounded-xl border border-slate-200 p-2.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="animate-fade-in absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800">
                      <button
                        onClick={async () => {
                          await refreshHistory();
                          setShowHistory(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <History className="h-5 w-5 text-amber-500" />
                        Histórico
                      </button>
                      <button
                        onClick={() => {
                          setShowTutorialsPage(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <PlayCircle className="h-5 w-5 text-blue-500" />
                        Tutoriais
                      </button>
                      <button
                        onClick={() => {
                          setShowAdminGate(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Users className="h-5 w-5 text-purple-500" />
                        Administração
                      </button>
                      <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                      <button
                        onClick={() => {
                          if (apkCircuitUrl) {
                            window.location.href = apkCircuitUrl;
                          }
                          setMenuOpen(false);
                        }}
                        disabled={!apkCircuitUrl}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Download className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                        Download Circuit
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-4 pb-28">
          {!hasData ? (
            <div className="space-y-6">
              <ImportCards onImport={handleImport} onError={(m) => addToast('error', m)} onResumeEntry={handleResumeFromHistory} />
            </div>
          ) : (
            <div className="space-y-4">
              <Scanner
                onScan={handleScan}
                onError={handleScannerError}
                lastSequence={lastSequence}
                alreadyRead={alreadyRead}
              />

              <Dashboard total={total} stops={groups.length} checked={checked} />

              <SearchComponent
                rows={rows}
                groups={groups}
                checkState={checkState.checked}
                onScan={handleScan}
              />

              <DeliveryList groups={groups} checkState={checkState} />

              {showUpload && (
                <div className="animate-fade-in">
                  <ImportCards onImport={handleImport} onError={(m) => addToast('error', m)} onResumeEntry={handleResumeFromHistory} />
                </div>
              )}
            </div>
          )}
        </main>

        {/* Upload modal */}
        {showUpload && !hasData && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
            <div className="animate-slide-up w-full max-w-lg rounded-t-3xl bg-white p-5 dark:bg-slate-800 sm:rounded-3xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Importar
                </h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ImportCards onImport={handleImport} onError={(m) => addToast('error', m)} onResumeEntry={handleResumeFromHistory} />
            </div>
          </div>
        )}

        {/* Export modal */}
        {showExport && hasData && (
          <ExportModal
            rows={rows}
            groups={groups}
            headers={headers}
            checkState={checkState}
            onClose={handleExportClose}
          />
        )}

        {/* History modal */}
        {showHistory && (
          <HistoryModal
            entries={historyEntries}
            onClose={() => setShowHistory(false)}
            onRefresh={refreshHistory}
            onResume={handleResumeFromHistory}
          />
        )}

        {/* Grouping confirm modal */}
        {pendingImport && (
          <GroupingConfirmModal
            potentialGroups={pendingImport.potentialGroups}
            onConfirm={handleGroupingConfirm}
            onCancel={handleGroupingCancel}
          />
        )}

        {/* Scan popup */}
        {popupData && (
          <ScanPopup
            group={popupData.group}
            checkedSpxTns={popupData.checkedSpxTns}
            alreadyRead={popupData.alreadyRead}
            lastReadSequence={popupData.lastReadSequence}
            onDismiss={() => setPopupData(null)}
          />
        )}

        {/* Back to top button */}
        {hasData && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-lg transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            title="Voltar ao topo"
          >
            <ArrowUp className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </button>
        )}

        {/* Completion Modal */}
        {showCompletionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-800">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                Todos os pedidos foram conferidos com sucesso.
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Deseja voltar para a tela inicial?
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setShowCompletionModal(false);
                    handleGoHome();
                  }}
                  className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
                >
                  Sim
                </button>
                <button
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                >
                  Não
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Global Announcement Modal */}
      {activeAnnouncement && (
        <GlobalAnnouncementModal
          announcement={activeAnnouncement}
          userId={installationId}
          onConfirm={async () => {
            await confirmAnnouncement(installationId, activeAnnouncement.id);
            setActiveAnnouncement(null);
          }}
        />
      )}

      {/* Welcome Modal for first-time users */}
      {showWelcomeModal && (
        <WelcomeModal
          onGoToTutorials={async () => {
            await markWelcomeModalSeen();
            setShowWelcomeModal(false);
            setShowTutorialsPage(true);
          }}
          onAlreadyKnow={async () => {
            await markWelcomeModalSeen();
            setShowWelcomeModal(false);
            const seenInfo = await hasSeenInfoModal();
            if (!seenInfo) {
              setShowInfoModal(true);
            }
          }}
        />
      )}

      {/* Info Modal shown after "Já sei usar" */}
      {showInfoModal && (
        <InfoModal
          onConfirm={async () => {
            await markInfoModalSeen();
            setShowInfoModal(false);
          }}
        />
      )}

      {needRefresh && <UpdateModal onConfirm={() => updateSW(true)} />}
    </div>
  );
}

export default App;
