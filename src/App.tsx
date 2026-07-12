import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Sun, PackageOpen, ArrowUp, Menu, X, History, Users, CreditCard, LogOut, UserCircle, AlertTriangle, PlayCircle, Home, Gift, Download } from 'lucide-react';
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
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { AdminPage } from './components/AdminPage';
import { UsersPage } from './components/UsersPage';
import { PaymentPage } from './components/PaymentPage';
import { LicenseWarningModal } from './components/LicenseWarningModal';
import { SessionKickedModal } from './components/SessionKickedModal';
import { ProfilePage } from './components/ProfilePage';
import { getShowLicenseToUsers, getTrialDays } from './services/settingsService';
import {
  getSessionUser,
  logout,
  type User,
  type UserWithLicenseStatus,
  isAdminUser,
} from './services/authService';
import {
  consumeUserWarning,
  consumeAdminExpiredWarning,
  daysRemaining,
  shouldShowExpiredWarning,
  markExpiredWarningShown,
  getLicense,
} from './services/licenseService';
import { TutorialModal, shouldShowTutorial } from './components/TutorialModal';
import { ReferralModal } from './components/ReferralModal';
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
import { getTutorialFlexUrl, getTutorialInterfaceUrl, getTutorialFrotaUrl } from './services/settingsService';
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
  type ActiveSession,
} from './services/sessionService';
import { supabase } from './lib/supabase';
import { checkDeviceStatus, getDeviceId } from './services/deviceService';
import { CheckCircle } from 'lucide-react';

function App() {
  const { needRefresh, updateSW } = usePWAUpdate();
  const [user, setUser] = useState<UserWithLicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
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
  const [showUsers, setShowUsers] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [apkCircuitUrl, setApkCircuitUrlState] = useState('');
  const [profileDefaultTab, setProfileDefaultTab] = useState<'profile' | 'payment'>('profile');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [activeFileName, setActiveFileName] = useState<string>('');
  const [trialDaysConfig, setTrialDaysConfig] = useState<number>(30);

  const sessionIsAdmin = isAdminUser(user);

  // Skip all user flows for admins (announcements, welcome modals, tutorials, etc.)
  const shouldShowUserFlows = !sessionIsAdmin;

  // Derive license state from user object (already validated during login)
  const userLicenseExpired = user ? !user.licenseStatus.isValid : true;
  const fingerprintTrialExpired = user?.licenseStatus.fingerprintExpired ?? false;
  const isInActiveTrial = user?.licenseStatus.isInActiveTrial ?? false;

  const [licenseWarning, setLicenseWarning] = useState<string | null>(null);
  const [sessionKicked, setSessionKicked] = useState(false);
  const [adminExpired, setAdminExpired] = useState<string[] | null>(null);

  // Announcements state
  const [activeAnnouncement, setActiveAnnouncement] = useState<GlobalAnnouncement | null>(null);

  // Tutorial/welcome state
  const [showTutorialsPage, setShowTutorialsPage] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [hasTutorialsConfigured, setHasTutorialsConfigured] = useState<boolean | null>(null);

  // Flag to prevent device verification during logout process
  const isLoggingOutRef = useRef(false);
  const deviceCheckDestroyedRef = useRef(false);

  // Load trial days config for dynamic messages
  useEffect(() => {
    getTrialDays().then(setTrialDaysConfig);
    getApkCircuitUrl().then(setApkCircuitUrlState);
  }, []);

  // Initialize session on mount
  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        const currentUser = await getSessionUser();
        if (mounted) setUser(currentUser);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Safety timeout: never stay in loading state forever
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 5000);

    const initActiveSession = async () => {
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
      }
    };

    initSession().then(() => {
      if (mounted) initActiveSession();
    });

    // Listen for auth state changes - only handle SIGNED_OUT
    // SIGNED_IN is handled by the login success callback
    // TOKEN_REFRESHED should not trigger re-fetching to avoid loops
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, _session) => {
        if (event === 'SIGNED_OUT') {
          // Clear all user state immediately
          setUser(null);
          setShowAdmin(false);
          setShowUsers(false);
          setShowPayment(false);
          setShowProfile(false);
          setLicenseWarning(null);
          setRows([]);
          setHeaders([]);
          setGroups([]);
          setCheckState({ checked: {}, spxToGroup: {} });
          setHistoryEntries([]);
          setCurrentHistoryId(null);
          setPendingImport(null);
          setMenuOpen(false);
        }
        // Do NOT handle SIGNED_IN here - it causes loops
        // The login success callback handles setting the user
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Periodic session guard: verifies the current device is still authorized.
  // When another device takes over the session, this forces sign-out here.
  useEffect(() => {
    if (!user || user.isAdmin) return;

    // Reset flags when user logs in
    isLoggingOutRef.current = false;
    deviceCheckDestroyedRef.current = false;

    let intervalId: ReturnType<typeof setInterval>;
    let initialCheckDone = false;

    const verify = async () => {
      // Skip verification if logging out or destroyed
      if (isLoggingOutRef.current || deviceCheckDestroyedRef.current) {
        return;
      }

      try {
        const deviceId = await getDeviceId();

        // Double-check after async operation
        if (isLoggingOutRef.current || deviceCheckDestroyedRef.current) {
          return;
        }

        const { isActive, deviceFound } = await checkDeviceStatus(user.id, deviceId);

        // Final check before updating state
        if (isLoggingOutRef.current || deviceCheckDestroyedRef.current) {
          return;
        }

        // Mark that the initial check completed successfully
        if (!initialCheckDone && deviceFound && isActive) {
          initialCheckDone = true;
          return; // Don't check further on first successful verification
        }

        // If the device was found but is no longer active, show kicked modal
        // Only trigger this AFTER the initial check succeeded (avoid false positives)
        if (initialCheckDone && deviceFound && !isActive) {
          setSessionKicked(true);
        }
      } catch {
        // Ignore transient network errors
      }
    };

    // Also verify on tab focus (catches the case where the user switches back)
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !isLoggingOutRef.current && !deviceCheckDestroyedRef.current) {
        verify();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Delay initial check to allow device registration to complete
    // This prevents false positives where the device isn't found yet
    const initialDelay = setTimeout(() => {
      verify();
    }, 3000); // 3 second delay for device to be registered

    // Poll every 30 seconds (reduced frequency to minimize false positives)
    intervalId = setInterval(verify, 30_000);

    return () => {
      deviceCheckDestroyedRef.current = true;
      clearTimeout(initialDelay);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  // Defensive guard: if admin views are active but user is not admin, reset them
  useEffect(() => {
    if (!sessionIsAdmin) {
      setShowAdmin(false);
      setShowUsers(false);
      setShowPayment(false);
    }
  }, [sessionIsAdmin]);

  // Check for active announcements after user logs in
  useEffect(() => {
    if (!user || !shouldShowUserFlows) {
      setActiveAnnouncement(null);
      return;
    }

    const checkAnnouncements = async () => {
      const announcements = await getActiveAnnouncements('after_login', user.id);
      if (announcements.length > 0) {
        setActiveAnnouncement(announcements[0]);
      }
    };

    checkAnnouncements();
  }, [user, shouldShowUserFlows]);

  // Check if any tutorial is configured and show welcome modal for first-time users
  useEffect(() => {
    if (!user || !shouldShowUserFlows) {
      return;
    }

    const checkTutorialsAndWelcome = async () => {
      // Check if any tutorial URLs are configured
      const [interfaceUrl, flexUrl, frotaUrl] = await Promise.all([
        getTutorialInterfaceUrl(),
        getTutorialFlexUrl(),
        getTutorialFrotaUrl(),
      ]);

      const hasTutorials = !!(interfaceUrl.trim() || flexUrl.trim() || frotaUrl.trim());
      setHasTutorialsConfigured(hasTutorials);

      if (!hasTutorials) {
        // No tutorials configured, skip welcome modal
        return;
      }

      // Check if user has already seen the welcome modal
      const seenWelcome = await hasSeenWelcomeModal(user.id);
      if (!seenWelcome) {
        setShowWelcomeModal(true);
      }
    };

    checkTutorialsAndWelcome();
  }, [user, shouldShowUserFlows]);

  // License warnings - based on already-computed license state from login
  useEffect(() => {
    if (!user) return;

    const checkWarnings = async () => {
      if (sessionIsAdmin) {
        // Admin warning for expired users
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('is_admin', false);

        if (profiles) {
          const users = profiles.map(p => ({
            id: p.id,
            name: p.name,
            email: '',
          }));
          const expired = await consumeAdminExpiredWarning(users);
          if (expired.length > 0) setAdminExpired(expired);
        }
      } else {
        // Don't show payment/expired warnings during active trial
        if (isInActiveTrial) {
          setLicenseWarning(null);
          return;
        }

        // If fingerprint trial is expired, show warning
        if (fingerprintTrialExpired || userLicenseExpired) {
          setLicenseWarning(`Seu período gratuito de ${trialDaysConfig} dias expirou. Para continuar utilizando todas as funcionalidades do sistema, realize o pagamento da renovação da licença.`);
        } else if (await shouldShowExpiredWarning(user.id)) {
          setLicenseWarning('Sua licença está vencida. Para voltar a utilizar todas as funcionalidades do sistema, gere o pagamento da renovação da licença.');
        } else {
          const remaining = user.licenseStatus?.daysRemaining ?? 0;
          if (remaining > 0) {
            const msg = await consumeUserWarning(user.id);
            if (msg) setLicenseWarning(msg);
          }
        }
      }
    };

    checkWarnings();
  }, [user, sessionIsAdmin, fingerprintTrialExpired, userLicenseExpired, isInActiveTrial, trialDaysConfig]);

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
      // Reconstruct checkState if it was saved empty (legacy entries)
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
        setCurrentHistoryId(entry.id);
        setActiveFileName(fileName);
        await saveActiveSession(entry.id, fileName, importedRows, sequenced, hdrs, state);
        await refreshHistory();
        const msg = groupingEnabled
          ? `${importedRows.length} pedidos importados e agrupados.`
          : `${importedRows.length} pedidos importados.`;
        addToast('success', msg);
      } catch (error) {
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

  const lastDeviceCheckRef = useRef<number>(0);

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

      // Periodically check device status on scans (throttled to every 30s)
      // Skip if logging out
      const now = Date.now();
      if (user && !user.isAdmin && !isLoggingOutRef.current && !deviceCheckDestroyedRef.current && now - lastDeviceCheckRef.current > 30_000) {
        lastDeviceCheckRef.current = now;
        getDeviceId().then((deviceId) => {
          // Check again after async
          if (isLoggingOutRef.current || deviceCheckDestroyedRef.current) return;
          checkDeviceStatus(user.id, deviceId).then(({ isActive, deviceFound }) => {
            if (isLoggingOutRef.current || deviceCheckDestroyedRef.current) return;
            if (deviceFound && !isActive) {
              setSessionKicked(true);
            }
          }).catch(() => {});
        }).catch(() => {});
      }

      // Auto-save to database (active session + history progress)
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

      // Check if all orders are now checked
      const checkedCount = Object.values(newState.checked).filter(Boolean).length;
      const totalCount = Object.keys(newState.checked).length;
      if (totalCount > 0 && checkedCount >= totalCount) {
        setTimeout(() => {
          clearActiveSession();
          setShowCompletionModal(true);
        }, 4000);
      }
    },
    [addToast, user]
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
      } catch (error) {
        addToast('error', 'Erro ao atualizar histórico.');
      }
    }
    setShowExport(false);
    setMenuOpen(false);
  }, [currentHistoryId, groups, checkState, refreshHistory, addToast]);

  const total = useMemo(() => getTotalCount(checkState), [checkState]);
  const checked = useMemo(() => getCheckedCount(checkState), [checkState]);

  const hasData = rows.length > 0;

  const handleLogout = useCallback(async () => {
    // Clear all state immediately for responsive UI
    setUser(null);
    setShowAdmin(false);
    setShowUsers(false);
    setShowPayment(false);
    setShowProfile(false);
    setMenuOpen(false);
    setLoading(true);
    setAuthView('login');

    // Clear data
    setRows([]);
    setHeaders([]);
    setGroups([]);
    setCheckState({ checked: {}, spxToGroup: {} });
    setHistoryEntries([]);
    setCurrentHistoryId(null);
    setPendingImport(null);

    try {
      await logout();
    } catch {
      // Even if logout fails on backend, local state is cleared
    }

    // Stop loading after logout attempt
    setLoading(false);
  }, []);

  // Loading screen
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

  // Auth screens
  if (!user) {
    if (authView === 'register') {
      return (
        <div className={dark ? 'dark' : ''}>
          <RegisterPage
            onSuccess={(registeredUser) => {
              if (registeredUser) {
                setUser(registeredUser);
              } else {
                setAuthView('login');
              }
            }}
            onBack={() => setAuthView('login')}
          />
        </div>
      );
    }
    return (
      <div className={dark ? 'dark' : ''}>
        <LoginPage
          onSuccess={async (loggedInUser) => {
            if (loggedInUser) {
              setUser(loggedInUser);
            } else {
              const currentUser = await getSessionUser();
              setUser(currentUser);
            }
          }}
          onRegister={() => setAuthView('register')}
        />
      </div>
    );
  }

  // Admin panel
  if (showAdmin && sessionIsAdmin) {
    return (
      <div className={dark ? 'dark' : ''}>
        <AdminPage
          onBack={() => setShowAdmin(false)}
        />
      </div>
    );
  }

  // Tutorials page
  if (showTutorialsPage && user) {
    return (
      <div className={dark ? 'dark' : ''}>
        <TutorialsPage
          userId={user.id}
          onBack={() => {
            setShowTutorialsPage(false);
          }}
        />
      </div>
    );
  }

  // Users panel
  if (showUsers && sessionIsAdmin) {
    return (
      <div className={dark ? 'dark' : ''}>
        <UsersPage
          onBack={() => setShowUsers(false)}
          onPayment={() => {
            setShowUsers(false);
            setShowPayment(true);
          }}
        />
      </div>
    );
  }

  // Payment page (admin only)
  if (showPayment && sessionIsAdmin) {
    return (
      <div className={dark ? 'dark' : ''}>
        <PaymentPage onBack={() => setShowPayment(false)} />
      </div>
    );
  }

  // Profile page
  if (showProfile && user) {
    return (
      <div className={dark ? 'dark' : ''}>
        <ProfilePage
          user={user}
          isAdmin={sessionIsAdmin}
          onBack={() => setShowProfile(false)}
          defaultTab={profileDefaultTab}
          isInActiveTrial={isInActiveTrial}
        />
      </div>
    );
  }

  // Main app
  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
        <ToastContainer toasts={toasts} onClose={removeToast} />

        <LicenseWarningModal
          userMessage={licenseWarning}
          expiredUsers={adminExpired}
          onClose={async () => {
            if (licenseWarning && !sessionIsAdmin && user && (await daysRemaining(user.id)) <= 0) {
              await markExpiredWarningShown(user.id);
            }
            setLicenseWarning(null);
            setAdminExpired(null);
          }}
        />

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
                <p className="text-xs text-slate-400">Olá, {user?.name ?? 'Usuário'}</p>
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
                        onClick={() => {
                          setShowProfile(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <UserCircle className="h-5 w-5 text-blue-500" />
                        Perfil
                      </button>
                      {!sessionIsAdmin && userLicenseExpired && !isInActiveTrial && (
                        <button
                          onClick={() => {
                            setProfileDefaultTab('payment');
                            setShowProfile(true);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                        >
                          <CreditCard className="h-5 w-5 text-amber-500" />
                          Ir para pagamento
                        </button>
                      )}
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
                          setShowReferral(true);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <Gift className="h-5 w-5 text-emerald-500" />
                        Indicação
                      </button>
                      {sessionIsAdmin && (
                        <>
                          <div className="my-2 border-t border-slate-200 dark:border-slate-700" />
                          <button
                            onClick={() => {
                              setShowAdmin(true);
                              setMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Users className="h-5 w-5 text-purple-500" />
                            Administração
                          </button>
                          <button
                            onClick={() => {
                              setShowUsers(true);
                              setMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Users className="h-5 w-5 text-blue-500" />
                            Usuários
                          </button>
                          <button
                            onClick={() => {
                              setShowPayment(true);
                              setMenuOpen(false);
                            }}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <CreditCard className="h-5 w-5 text-emerald-500" />
                            Pagamento
                          </button>
                        </>
                      )}
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
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <LogOut className="h-5 w-5" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-4 pb-28">
          {userLicenseExpired && !isInActiveTrial && !sessionIsAdmin && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Seu período gratuito de {trialDaysConfig} dias expirou. Para continuar utilizando todas as
                  funcionalidades do sistema, realize o pagamento da renovação da licença.
                </p>
                <button
                  onClick={() => {
                    setProfileDefaultTab('payment');
                    setShowProfile(true);
                  }}
                  className="mt-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700"
                >
                  Ir para pagamento
                </button>
              </div>
            </div>
          )}
          {!hasData ? (
            <div className="space-y-6">
              <ImportCards onImport={handleImport} onError={(m) => addToast('error', m)} disabled={userLicenseExpired} userId={user?.id} onResumeEntry={handleResumeFromHistory} />
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
                  <ImportCards onImport={handleImport} onError={(m) => addToast('error', m)} disabled={userLicenseExpired} userId={user?.id} onResumeEntry={handleResumeFromHistory} />
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
              <ImportCards onImport={handleImport} onError={(m) => addToast('error', m)} disabled={userLicenseExpired} userId={user?.id} onResumeEntry={handleResumeFromHistory} />
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

        {/* Tutorial */}
        {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

        {/* Referral */}
        {showReferral && <ReferralModal onClose={() => setShowReferral(false)} />}

        {sessionKicked && (
          <SessionKickedModal
            onConfirm={async () => {
              // Immediately stop all device monitoring
              isLoggingOutRef.current = true;
              deviceCheckDestroyedRef.current = true;
              setSessionKicked(false);

              // Clear user state immediately to prevent re-renders triggering more checks
              setUser(null);
              setLoading(true);

              // Clear all data
              setRows([]);
              setHeaders([]);
              setGroups([]);
              setCheckState({ checked: {}, spxToGroup: {} });
              setHistoryEntries([]);
              setCurrentHistoryId(null);
              setPendingImport(null);

              // Perform full logout (not just local) to ensure server is notified
              try {
                await supabase.auth.signOut();
              } catch {
                // Fallback to local signOut if full signOut fails
                await supabase.auth.signOut({ scope: 'local' });
              }

              setLoading(false);
            }}
          />
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

      {/* Global Announcement Modal - admins skip */}
      {activeAnnouncement && user && shouldShowUserFlows && (
        <GlobalAnnouncementModal
          announcement={activeAnnouncement}
          userId={user.id}
          onConfirm={async () => {
            await confirmAnnouncement(user.id, activeAnnouncement.id);
            setActiveAnnouncement(null);
          }}
        />
      )}

      {/* Welcome Modal for first-time users - admins skip */}
      {showWelcomeModal && user && shouldShowUserFlows && (
        <WelcomeModal
          onGoToTutorials={async () => {
            await markWelcomeModalSeen(user.id);
            setShowWelcomeModal(false);
            setShowTutorialsPage(true);
          }}
          onAlreadyKnow={async () => {
            await markWelcomeModalSeen(user.id);
            setShowWelcomeModal(false);
            // Check if user has seen the info modal
            const seenInfo = await hasSeenInfoModal(user.id);
            if (!seenInfo) {
              setShowInfoModal(true);
            }
          }}
        />
      )}

      {/* Info Modal shown after "Já sei usar" - admins skip */}
      {showInfoModal && user && shouldShowUserFlows && (
        <InfoModal
          onConfirm={async () => {
            await markInfoModalSeen(user.id);
            setShowInfoModal(false);
          }}
        />
      )}

      {needRefresh && <UpdateModal onConfirm={() => updateSW(true)} />}
    </div>
  );
}

export default App;
