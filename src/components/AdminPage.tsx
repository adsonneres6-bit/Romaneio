import { useEffect, useState, useCallback } from 'react';
import {
  Settings,
  ArrowLeft,
  Save,
  Monitor,
  RefreshCw,
  Layers,
  Gift,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Download,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Wrench,
} from 'lucide-react';
import {
  setShowLicenseToUsers,
  getTutorialInterfaceUrl,
  setTutorialInterfaceUrl,
  getTutorialFlexUrl,
  setTutorialFlexUrl,
  getTutorialFrotaUrl,
  setTutorialFrotaUrl,
  getApkCircuitUrl,
  setApkCircuitUrl,
  getMaxDevicesPerUser,
  setMaxDevicesPerUser,
  getTrialDays,
  setTrialDays,
  getReferralBonusDays,
  setReferralBonusDays,
  getReferralRequirePayment,
  setReferralRequirePayment,
  validateYouTubeUrl,
} from '../services/settingsService';
import {
  getAllAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type GlobalAnnouncement,
  type DisplayLocation,
} from '../services/announcementService';
import { getAllDevices, removeUserDevice, deactivateUserDevice, formatDateBR as formatDeviceDateBR, type DeviceRecord } from '../services/deviceService';
import { AlertModal } from './AlertModal';
import { ConfirmModal } from './ConfirmModal';
import { MaintenancePage } from './MaintenancePage';

interface AdminPageProps {
  onBack: () => void;
}

type Tab = 'settings' | 'devices' | 'announcements' | 'maintenance';

export function AdminPage({ onBack }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [showLicenseToUsers, setShowLicenseToUsersState] = useState(true);
  const [alertMessage, setAlertMessage] = useState('');


  // Tutorial URLs state
  const [tutorialsExpanded, setTutorialsExpanded] = useState(false);
  const [tutorialInterfaceUrl, setTutorialInterfaceUrlState] = useState('');
  const [tutorialInterfaceInput, setTutorialInterfaceInput] = useState('');
  const [tutorialFlexUrl, setTutorialFlexUrlState] = useState('');
  const [tutorialFlexInput, setTutorialFlexInput] = useState('');
  const [tutorialFrotaUrl, setTutorialFrotaUrlState] = useState('');
  const [tutorialFrotaInput, setTutorialFrotaInput] = useState('');
  const [tutorialsSaving, setTutorialsSaving] = useState(false);
  const [tutorialsSaved, setTutorialsSaved] = useState(false);

  // APK URL state
  const [apkCircuitUrl, setApkCircuitUrlState] = useState('');
  const [apkCircuitInput, setApkCircuitInput] = useState('');
  const [apkSaving, setApkSaving] = useState(false);
  const [apkSaved, setApkSaved] = useState(false);


  const [maxDevices, setMaxDevicesState] = useState(2);
  const [maxDevicesInput, setMaxDevicesInput] = useState('2');

  const [trialDays, setTrialDaysState] = useState(30);
  const [trialDaysInput, setTrialDaysInput] = useState('30');

  // Referral settings
  const [referralBonusDays, setReferralBonusDaysState] = useState(7);
  const [referralBonusDaysInput, setReferralBonusDaysInput] = useState('7');
  const [referralRequirePayment, setReferralRequirePaymentState] = useState(false);

  // Devices tab state
  const [allDevices, setAllDevices] = useState<DeviceRecord[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceToRemove, setDeviceToRemove] = useState<DeviceRecord | null>(null);
  const [deviceToDeactivate, setDeviceToDeactivate] = useState<DeviceRecord | null>(null);

  // Announcements tab state
  const [announcements, setAnnouncements] = useState<GlobalAnnouncement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [showAnnouncementEditor, setShowAnnouncementEditor] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<GlobalAnnouncement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<GlobalAnnouncement | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    displayLocation: 'after_login' as DisplayLocation,
    showOncePerUser: true,
    requireConfirmation: true,
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    getTutorialInterfaceUrl().then((url) => {
      setTutorialInterfaceUrlState(url);
      setTutorialInterfaceInput(url);
    });
    getTutorialFlexUrl().then((url) => {
      setTutorialFlexUrlState(url);
      setTutorialFlexInput(url);
    });
    getTutorialFrotaUrl().then((url) => {
      setTutorialFrotaUrlState(url);
      setTutorialFrotaInput(url);
    });
    getApkCircuitUrl().then((url) => {
      setApkCircuitUrlState(url);
      setApkCircuitInput(url);
    });
    getMaxDevicesPerUser().then((max) => {
      setMaxDevicesState(max);
      setMaxDevicesInput(String(max));
    });
    getTrialDays().then((days) => {
      setTrialDaysState(days);
      setTrialDaysInput(String(days));
    });
    getReferralBonusDays().then((days) => {
      setReferralBonusDaysState(days);
      setReferralBonusDaysInput(String(days));
    });
    getReferralRequirePayment().then(setReferralRequirePaymentState);
  }, []);

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    const devices = await getAllDevices();
    setAllDevices(devices);
    setLoadingDevices(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'devices') {
      loadDevices();
    }
    if (activeTab === 'announcements') {
      loadAnnouncements();
    }
  }, [activeTab, loadDevices]);

  const loadAnnouncements = useCallback(async () => {
    setLoadingAnnouncements(true);
    const data = await getAllAnnouncements();
    setAnnouncements(data);
    setLoadingAnnouncements(false);
  }, []);

  const handleDeactivateDevice = useCallback(async () => {
    if (!deviceToDeactivate) return;
    const result = await deactivateUserDevice(deviceToDeactivate.id);
    if (result.success) {
      await loadDevices();
    } else {
      setAlertMessage(result.error || 'Erro ao desativar dispositivo');
    }
    setDeviceToDeactivate(null);
  }, [deviceToDeactivate, loadDevices]);

  const handleRemoveDevice = useCallback(async () => {
    if (!deviceToRemove) return;
    const result = await removeUserDevice(deviceToRemove.id);
    if (result.success) {
      await loadDevices();
    } else {
      setAlertMessage(result.error || 'Erro ao excluir dispositivo');
    }
    setDeviceToRemove(null);
  }, [deviceToRemove, loadDevices]);

  const groupedByUser = allDevices.reduce<Record<string, DeviceRecord[]>>((acc, device) => {
    const key = device.userId || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(device);
    return acc;
  }, {});

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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Administração
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-auto max-w-4xl border-t border-slate-200 px-4 dark:border-slate-800">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <Layers className="h-4 w-4" />
              Configurações
            </button>
            <button
              onClick={() => setActiveTab('devices')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'devices'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <Monitor className="h-4 w-4" />
              Dispositivos
              {allDevices.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {allDevices.filter(d => d.isActive).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'announcements'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <Megaphone className="h-4 w-4" />
              Comunicados
              {announcements.filter(a => a.isActive).length > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  {announcements.filter(a => a.isActive).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'maintenance'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <Wrench className="h-4 w-4" />
              Manutenção
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {activeTab === 'settings' && (
          <>
            {/* Display settings */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <label className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    Exibir informações da licença para os usuários
                  </span>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Quando desativado, os usuários não verão a data de vencimento nem os dias restantes na tela de Perfil.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showLicenseToUsers}
                  onClick={async () => {
                    const next = !showLicenseToUsers;
                    await setShowLicenseToUsers(next);
                    setShowLicenseToUsersState(next);
                  }}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    showLicenseToUsers ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showLicenseToUsers ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>
            </div>

            {/* Tutoriais Section - Expandable */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => setTutorialsExpanded(!tutorialsExpanded)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    Tutoriais
                  </span>
                </div>
                {tutorialsExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </button>

              {tutorialsExpanded && (
                <div className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-700">
                  {/* Tutorial Interface */}
                  <div>
                    <div className="mb-1.5">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        Tutorial Interface
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        URL do vídeo tutorial da interface do sistema (opcional).
                      </p>
                    </div>
                    <input
                      type="url"
                      value={tutorialInterfaceInput}
                      onChange={(e) => setTutorialInterfaceInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Tutorial Flex */}
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        Tutorial Flex
                      </span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Obrigatório
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      URL do vídeo tutorial obrigatório do sistema Flex. O usuário deverá assistir até o final para desbloquear o sistema.
                    </p>
                    <input
                      type="url"
                      value={tutorialFlexInput}
                      onChange={(e) => setTutorialFlexInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Tutorial Frota */}
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                    <div className="mb-1.5">
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        Tutorial Frota
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        URL do vídeo tutorial do sistema Frota (opcional).
                      </p>
                    </div>
                    <input
                      type="url"
                      value={tutorialFrotaInput}
                      onChange={(e) => setTutorialFrotaInput(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Single Save Button */}
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                    <button
                      onClick={async () => {
                        setTutorialsSaving(true);
                        try {
                          // Validate URLs first
                          const urls = [
                            { name: 'Interface', url: tutorialInterfaceInput.trim() },
                            { name: 'Flex', url: tutorialFlexInput.trim() },
                            { name: 'Frota', url: tutorialFrotaInput.trim() },
                          ];

                          for (const item of urls) {
                            if (item.url) {
                              const validation = validateYouTubeUrl(item.url);
                              if (!validation.valid) {
                                setAlertMessage(`Tutorial ${item.name}: ${validation.error}`);
                                setTutorialsSaving(false);
                                return;
                              }
                            }
                          }

                          // Save all tutorials - now returns success/error
                          const results = await Promise.all([
                            setTutorialInterfaceUrl(tutorialInterfaceInput.trim()),
                            setTutorialFlexUrl(tutorialFlexInput.trim()),
                            setTutorialFrotaUrl(tutorialFrotaInput.trim()),
                          ]);

                          // Check for errors
                          const errors = results.filter(r => !r.success);
                          if (errors.length > 0) {
                            setAlertMessage('Erro ao salvar tutoriais: ' + errors.map(e => e.error).join(', '));
                          } else {
                            // Update local state only after successful save
                            setTutorialInterfaceUrlState(tutorialInterfaceInput.trim());
                            setTutorialFlexUrlState(tutorialFlexInput.trim());
                            setTutorialFrotaUrlState(tutorialFrotaInput.trim());
                            setTutorialsSaved(true);
                            setAlertMessage('Tutoriais salvos com sucesso!');
                            setTimeout(() => setTutorialsSaved(false), 2000);
                          }
                        } catch (err) {
                          setAlertMessage('Erro ao salvar tutoriais');
                        } finally {
                          setTutorialsSaving(false);
                        }
                      }}
                      disabled={tutorialsSaving}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                    >
                      <Save className="h-5 w-5" />
                      {tutorialsSaving ? 'Salvando...' : tutorialsSaved ? 'Salvo!' : 'Salvar'}
                    </button>
                    <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                      Salva todas as URLs configuradas acima
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* APK Circuit URL */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2 flex items-center gap-2">
                <Download className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  URL do APK Circuito
                </span>
              </div>
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                URL de download do aplicativo Circuito (APK). Esta URL será utilizada pelo botão Download Circuito na tela de Perfil dos usuários.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={apkCircuitInput}
                  onChange={(e) => setApkCircuitInput(e.target.value)}
                  placeholder="https://exemplo.com/Circuit.apk"
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  onClick={async () => {
                    setApkSaving(true);
                    await setApkCircuitUrl(apkCircuitInput.trim());
                    setApkCircuitUrlState(apkCircuitInput.trim());
                    setApkSaving(false);
                    setApkSaved(true);
                    setTimeout(() => setApkSaved(false), 2000);
                  }}
                  disabled={apkSaving}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {apkSaving ? 'Salvando...' : apkSaved ? 'Salvo!' : 'Salvar'}
                </button>
              </div>
            </div>

            {/* Max devices setting */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Máximo de dispositivos por usuário
                </span>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Limite de dispositivos que cada usuário pode utilizar para acessar a conta.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxDevicesInput}
                  onChange={(e) => setMaxDevicesInput(e.target.value)}
                  className="w-20 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  onClick={async () => {
                    const value = parseInt(maxDevicesInput, 10);
                    if (isNaN(value) || value < 1) {
                      setAlertMessage('Valor inválido');
                      return;
                    }
                    await setMaxDevicesPerUser(value);
                    setMaxDevicesState(value);
                    setAlertMessage('Configuração salva com sucesso!');
                  }}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Valor atual: {maxDevices} dispositivo(s) por usuário
              </p>
            </div>

            {/* Trial days setting */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Dias gratuitos de teste
                </span>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Quantidade de dias gratuitos para novos usuários. Esta alteração afeta apenas novos cadastros.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={trialDaysInput}
                  onChange={(e) => setTrialDaysInput(e.target.value)}
                  className="w-20 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
                <button
                  onClick={async () => {
                    const value = parseInt(trialDaysInput, 10);
                    if (isNaN(value) || value < 1) {
                      setAlertMessage('Valor inválido');
                      return;
                    }
                    await setTrialDays(value);
                    setTrialDaysState(value);
                    setAlertMessage('Configuração salva com sucesso!');
                  }}
                  className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Valor atual: {trialDays} dias de teste para novos usuários
              </p>
            </div>

            {/* Programa de Indicação */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center gap-2">
                <Gift className="h-5 w-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Programa de Indicação
                </h3>
              </div>

              {/* Bonus days */}
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-slate-900 dark:text-white">
                  Dias de bônus por indicação
                </label>
                <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                  Quantidade de dias que o indicador recebe a cada indicação bem-sucedida.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={referralBonusDaysInput}
                    onChange={(e) => setReferralBonusDaysInput(e.target.value)}
                    className="w-20 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    onClick={async () => {
                      const value = parseInt(referralBonusDaysInput, 10);
                      if (isNaN(value) || value < 1) {
                        setAlertMessage('Valor inválido');
                        return;
                      }
                      await setReferralBonusDays(value);
                      setReferralBonusDaysState(value);
                      setAlertMessage('Configuração salva com sucesso!');
                    }}
                    className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    <Save className="h-4 w-4" />
                    Salvar
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Valor atual: {referralBonusDays} dias por indicação
                </p>
              </div>

              {/* Require payment switch */}
              <div className="border-t border-slate-100 pt-4 dark:border-slate-700">
                <label className="flex items-center justify-between">
                  <div className="pr-4">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Exigir pagamento para validar indicação
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {referralRequirePayment
                        ? 'Ativado — O bônus será concedido apenas quando o usuário indicado realizar sua primeira compra.'
                        : 'Desativado — O bônus será concedido imediatamente após o cadastro.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={referralRequirePayment}
                    onClick={async () => {
                      const next = !referralRequirePayment;
                      await setReferralRequirePayment(next);
                      setReferralRequirePaymentState(next);
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                      referralRequirePayment ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        referralRequirePayment ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          </>
        )}

        {activeTab === 'devices' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Dispositivos Autorizados
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Todos os dispositivos registrados no sistema, agrupados por usuário.
                </p>
              </div>
              <button
                onClick={loadDevices}
                disabled={loadingDevices}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RefreshCw className={`h-4 w-4 ${loadingDevices ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>

            {loadingDevices ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              </div>
            ) : Object.keys(groupedByUser).length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                <Monitor className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Nenhum dispositivo registrado
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Os dispositivos serão registrados automaticamente quando os usuários fizerem login.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedByUser).map(([userId, devices]) => {
                  const firstDevice = devices[0];
                  const userName = firstDevice.userName || 'Usuário';
                  const userEmail = firstDevice.userEmail || '';
                  const activeCount = devices.filter(d => d.isActive).length;

                  return (
                    <div
                      key={userId}
                      className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                    >
                      {/* User header */}
                      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {userName}
                          </p>
                          {userEmail && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {userEmail}
                            </p>
                          )}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          activeCount > 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {activeCount} ativo{activeCount !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Device list */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-700">
                        {devices.map((device) => (
                          <div key={device.id} className="flex items-start justify-between px-4 py-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-slate-900 dark:text-white">
                                  {device.browser || 'Navegador'} {device.browserVersion}
                                </span>
                                {device.isActive ? (
                                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                                    Ativo
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                    Inativo
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {device.os} {device.osVersion}
                                {device.screenResolution && <> · {device.screenResolution}</>}
                                {device.timezone && <> · {device.timezone}</>}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-400">
                                Primeiro acesso: {formatDeviceDateBR(device.firstAccessAt)} · Último: {formatDeviceDateBR(device.lastAccessAt)}
                              </p>
                            </div>
                            <div className="ml-2 flex items-center gap-1">
                              {device.isActive && (
                                <button
                                  onClick={() => setDeviceToDeactivate(device)}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                                  title="Desativar dispositivo"
                                >
                                  Desativar
                                </button>
                              )}
                              <button
                                onClick={() => setDeviceToRemove(device)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                                title="Excluir dispositivo permanentemente"
                              >
                                Excluir
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <MaintenancePage onAlert={setAlertMessage} />
        )}

        {/* Announcements Tab */}
        {activeTab === 'announcements' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Comunicados Globais
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Crie e gerencie comunicados para todos os usuários do sistema.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadAnnouncements}
                  disabled={loadingAnnouncements}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingAnnouncements ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button
                  onClick={() => {
                    setEditingAnnouncement(null);
                    setAnnouncementForm({
                      title: '',
                      message: '',
                      displayLocation: 'after_login',
                      showOncePerUser: true,
                      requireConfirmation: true,
                      startDate: '',
                      endDate: '',
                    });
                    setShowAnnouncementEditor(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Novo Comunicado
                </button>
              </div>
            </div>

            {loadingAnnouncements ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                <Megaphone className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Nenhum comunicado criado
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Crie comunicados para enviar mensagens a todos os usuários do sistema.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className={`rounded-2xl border bg-white p-4 dark:bg-slate-800 ${
                      announcement.isActive
                        ? 'border-slate-200 dark:border-slate-700'
                        : 'border-slate-200 opacity-60 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            {announcement.title}
                          </h3>
                          {announcement.isActive ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                              Ativo
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                              Inativo
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {announcement.message}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-700">
                            {announcement.displayLocation === 'login' ? 'Tela de Login' : 'Após Login'}
                          </span>
                          {announcement.showOncePerUser && (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Uma vez por usuário
                            </span>
                          )}
                          {announcement.requireConfirmation && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Confirmação obrigatória
                            </span>
                          )}
                          {announcement.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Início: {new Date(announcement.startDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                          {announcement.endDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Fim: {new Date(announcement.endDate).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={async () => {
                            await updateAnnouncement(announcement.id, {
                              isActive: !announcement.isActive,
                            });
                            await loadAnnouncements();
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          title={announcement.isActive ? 'Desativar' : 'Ativar'}
                        >
                          {announcement.isActive ? (
                            <ToggleRight className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAnnouncement(announcement);
                            setAnnouncementForm({
                              title: announcement.title,
                              message: announcement.message,
                              displayLocation: announcement.displayLocation,
                              showOncePerUser: announcement.showOncePerUser,
                              requireConfirmation: announcement.requireConfirmation,
                              startDate: announcement.startDate
                                ? new Date(announcement.startDate).toISOString().slice(0, 16)
                                : '',
                              endDate: announcement.endDate
                                ? new Date(announcement.endDate).toISOString().slice(0, 16)
                                : '',
                            });
                            setShowAnnouncementEditor(true);
                          }}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setAnnouncementToDelete(announcement)}
                          className="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Announcement Editor Modal */}
            {showAnnouncementEditor && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                <div className="animate-slide-up w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
                    {editingAnnouncement ? 'Editar Comunicado' : 'Novo Comunicado'}
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Título
                      </label>
                      <input
                        type="text"
                        value={announcementForm.title}
                        onChange={(e) =>
                          setAnnouncementForm({ ...announcementForm, title: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="Título do comunicado"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Mensagem
                      </label>
                      <textarea
                        value={announcementForm.message}
                        onChange={(e) =>
                          setAnnouncementForm({ ...announcementForm, message: e.target.value })
                        }
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        placeholder="Conteúdo do comunicado..."
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Exibir em
                      </label>
                      <select
                        value={announcementForm.displayLocation}
                        onChange={(e) =>
                          setAnnouncementForm({
                            ...announcementForm,
                            displayLocation: e.target.value as DisplayLocation,
                          })
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      >
                        <option value="login">Tela de Login (antes de entrar)</option>
                        <option value="after_login">Após Login (dentro do sistema)</option>
                      </select>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Exibir apenas uma vez por usuário
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={announcementForm.showOncePerUser}
                          onClick={() =>
                            setAnnouncementForm({
                              ...announcementForm,
                              showOncePerUser: !announcementForm.showOncePerUser,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            announcementForm.showOncePerUser
                              ? 'bg-blue-600'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              announcementForm.showOncePerUser ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>

                      <label className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          Obrigar confirmação de leitura
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={announcementForm.requireConfirmation}
                          onClick={() =>
                            setAnnouncementForm({
                              ...announcementForm,
                              requireConfirmation: !announcementForm.requireConfirmation,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            announcementForm.requireConfirmation
                              ? 'bg-blue-600'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              announcementForm.requireConfirmation
                                ? 'translate-x-6'
                                : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Data de início (opcional)
                        </label>
                        <input
                          type="datetime-local"
                          value={announcementForm.startDate}
                          onChange={(e) =>
                            setAnnouncementForm({ ...announcementForm, startDate: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Data de término (opcional)
                        </label>
                        <input
                          type="datetime-local"
                          value={announcementForm.endDate}
                          onChange={(e) =>
                            setAnnouncementForm({ ...announcementForm, endDate: e.target.value })
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => {
                        setShowAnnouncementEditor(false);
                        setEditingAnnouncement(null);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={async () => {
                        if (!announcementForm.title.trim() || !announcementForm.message.trim()) {
                          setAlertMessage('Preencha título e mensagem');
                          return;
                        }

                        const announcementData = {
                          title: announcementForm.title.trim(),
                          message: announcementForm.message.trim(),
                          displayLocation: announcementForm.displayLocation,
                          showOncePerUser: announcementForm.showOncePerUser,
                          requireConfirmation: announcementForm.requireConfirmation,
                          isActive: editingAnnouncement?.isActive ?? true,
                          startDate: announcementForm.startDate
                            ? new Date(announcementForm.startDate).toISOString()
                            : null,
                          endDate: announcementForm.endDate
                            ? new Date(announcementForm.endDate).toISOString()
                            : null,
                        };

                        if (editingAnnouncement) {
                          await updateAnnouncement(editingAnnouncement.id, announcementData);
                        } else {
                          await createAnnouncement(announcementData);
                        }

                        setShowAnnouncementEditor(false);
                        setEditingAnnouncement(null);
                        await loadAnnouncements();
                        setAlertMessage(
                          editingAnnouncement
                            ? 'Comunicado atualizado com sucesso!'
                            : 'Comunicado criado com sucesso!'
                        );
                      }}
                      className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      {editingAnnouncement ? 'Salvar' : 'Criar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      )}

      {deviceToDeactivate && (
        <ConfirmModal
          title="Desativar dispositivo?"
          message={`Desativar o dispositivo "${deviceToDeactivate.browser || 'Navegador'}" de ${deviceToDeactivate.userName || 'este usuário'}? O acesso ficará bloqueado; a vaga pode ser reativada depois.`}
          confirmLabel="Desativar"
          confirmVariant="danger"
          onConfirm={handleDeactivateDevice}
          onCancel={() => setDeviceToDeactivate(null)}
        />
      )}

      {deviceToRemove && (
        <ConfirmModal
          title="Excluir dispositivo?"
          message={`Excluir permanentemente o dispositivo "${deviceToRemove.browser || 'Navegador'}" de ${deviceToRemove.userName || 'este usuário'}? Uma vaga será liberada para um novo dispositivo.`}
          confirmLabel="Excluir"
          confirmVariant="danger"
          onConfirm={handleRemoveDevice}
          onCancel={() => setDeviceToRemove(null)}
        />
      )}

      {announcementToDelete && (
        <ConfirmModal
          title="Excluir comunicado?"
          message={`Excluir permanentemente o comunicado "${announcementToDelete.title}"? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          confirmVariant="danger"
          onConfirm={async () => {
            await deleteAnnouncement(announcementToDelete.id);
            await loadAnnouncements();
            setAnnouncementToDelete(null);
          }}
          onCancel={() => setAnnouncementToDelete(null)}
        />
      )}
    </div>
  );
}
