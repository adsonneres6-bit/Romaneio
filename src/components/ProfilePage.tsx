import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Mail, Calendar, KeyRound, Eye, EyeOff, Check, QrCode, AlertTriangle, X, User as UserIcon, CreditCard, PlayCircle } from 'lucide-react';
import { changePassword } from '../services/authService';
import { getLicense, daysRemaining, isFreeTrialLicense, getLicenseStatus, formatDateBR } from '../services/licenseService';
import { getMyReferralInfo } from '../services/referralService';
import { getTutorialUrl, toEmbedUrl, getTrialDays } from '../services/settingsService';
import type { UserWithLicenseStatus } from '../services/authService';
import { PixPaymentPanel } from './PixPaymentPanel';

interface ProfilePageProps {
  user: UserWithLicenseStatus;
  isAdmin: boolean;
  onBack: () => void;
  defaultTab?: 'profile' | 'payment';
  isInActiveTrial?: boolean;
}

const CIRCUIT_URL =
  'https://github.com/adsonneres6-bit/adsonteste_download/releases/latest/download/Circuit.apk';

export function ProfilePage({ user, isAdmin, onBack, defaultTab = 'profile', isInActiveTrial = false }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'payment'>(defaultTab);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialUrl, setTutorialUrl] = useState('');
  const [tutorialLoaded, setTutorialLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [trialDaysConfig, setTrialDaysConfig] = useState<number>(30);

  // License state
  const [remaining, setRemaining] = useState(0);
  const [license, setLicense] = useState<{
    days: number;
    is_free_trial: boolean;
    expires_at: string;
  } | null>(null);
  const [licenseLoaded, setLicenseLoaded] = useState(false);
  const [referralBonusDays, setReferralBonusDays] = useState(0);

  useEffect(() => {
    const loadLicenseData = async () => {
      const lic = await getLicense(user.id);
      setLicense(lic);
      const days = await daysRemaining(user.id);
      setRemaining(days);
      setLicenseLoaded(true);
    };
    loadLicenseData();
    getMyReferralInfo().then((info) => setReferralBonusDays(info.totalBonusDays));
    getTrialDays().then(setTrialDaysConfig);
  }, [user.id]);

  useEffect(() => {
    getTutorialUrl().then((url) => {
      setTutorialUrl(url);
      setTutorialLoaded(true);
    });
  }, []);

  const embedUrl = tutorialUrl ? toEmbedUrl(tutorialUrl) : '';

  // Sync activeTab with defaultTab when it changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const expired = remaining <= 0;
  const near = remaining > 0 && remaining <= 5;
  const licenseActive = !expired;
  const isFreeTrial = license?.is_free_trial === true;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError('');
    if (newPwd !== confirmPwd) {
      setPwdError('As senhas não coincidem.');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('Senha muito curta (mín. 6 caracteres).');
      return;
    }
    const result = await changePassword(currentPwd, newPwd);
    if (!result.ok) {
      setPwdError(result.error ?? 'Erro ao alterar senha.');
      return;
    }
    setPwdSuccess(true);
    setCurrentPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setTimeout(() => {
      setPwdSuccess(false);
      setShowChangePwd(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <h1 className="mb-6 text-2xl font-bold text-slate-900 dark:text-white">Perfil</h1>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            <UserIcon className="h-4 w-4" />
            Perfil
          </button>
          {licenseLoaded && (!isInActiveTrial || expired) && (
            <button
              onClick={() => setActiveTab('payment')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === 'payment'
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              Pagamento
            </button>
          )}
        </div>

        {/* Expired license warning - only show if not in active trial */}
        {!isAdmin && expired && !isFreeTrial && !isInActiveTrial && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Seu período gratuito de {trialDaysConfig} dias expirou. Para continuar utilizando todas as
              funcionalidades do sistema, realize o pagamento da renovação da licença.
            </p>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {/* User info */}
          <div className="mb-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Dados do usuário
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <UserIcon className="h-4 w-4" />
                  Nome
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {user.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Mail className="h-4 w-4" />
                  E-mail
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {user.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <Calendar className="h-4 w-4" />
                  Cadastrado em
                </span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {/* License info - hidden during active free trial */}
          {!isAdmin && licenseLoaded && !(isFreeTrial && !expired) && (
            <div className="border-t border-slate-100 pt-5 dark:border-slate-700">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Licença
              </h2>
              <div className="space-y-3 text-sm">
                {!license ? (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      Sem licença ativa
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Vencimento</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {formatDateBR(license.expires_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Dias restantes</span>
                      <span
                        className={`font-bold ${
                          expired
                            ? 'text-red-600 dark:text-red-400'
                            : near
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {expired ? 'Expirada' : `${remaining} dias`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Status</span>
                      <span
                        className={`font-medium ${
                          expired
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {expired
                          ? 'Licença expirada'
                          : isFreeTrial
                            ? 'Período de teste ativo'
                            : 'Licença ativa'}
                      </span>
                    </div>
                    {referralBonusDays > 0 && (
                      <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400">Origem</span>
                        <span className="text-right text-xs text-slate-500 dark:text-slate-400">
                          {Math.max(remaining - referralBonusDays, 0)} dias da licença
                          <br />
                          {referralBonusDays} dias provenientes do programa de indicação
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-700">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Ações
            </h2>

            {!showChangePwd ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowChangePwd(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <KeyRound className="h-4 w-4" />
                  Alterar senha
                </button>
                <button
                  onClick={() => {
                    window.location.href = CIRCUIT_URL;
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <Download className="h-4 w-4" />
                  Download Circuit
                </button>
                {tutorialLoaded && tutorialUrl && (
                  <button
                    onClick={() => {
                      setIframeError(false);
                      setShowTutorial(true);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Tutorial
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                {/* Current password */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Senha atual
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPwd}
                      onChange={(e) => setCurrentPwd(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-3 pr-10 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-3 pr-10 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      placeholder="Mín. 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPwd}
                      onChange={(e) => setConfirmPwd(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-3 pr-10 text-sm text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {pwdError && <p className="text-xs text-red-500">{pwdError}</p>}
                {pwdSuccess && (
                  <p className="flex items-center gap-1 text-xs text-emerald-600">
                    <Check className="h-4 w-4" />
                    Senha alterada com sucesso!
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePwd(false);
                      setPwdError('');
                      setCurrentPwd('');
                      setNewPwd('');
                      setConfirmPwd('');
                    }}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                  >
                    Confirmar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
        )}

        {/* Payment Tab - only show if not in active trial */}
        {activeTab === 'payment' && !isInActiveTrial && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-5 text-lg font-bold text-slate-900 dark:text-white">
              Pagamento
            </h2>

            {!isAdmin && licenseLoaded && (
              <div className="space-y-4">
                {/* Payment status info */}
                {expired && !isFreeTrial && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Sua licença está expirada. Gere o pagamento PIX para renovar.
                    </p>
                  </div>
                )}

                {expired && isFreeTrial && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Seu período gratuito de teste expirou. Gere o pagamento PIX para continuar utilizando o sistema.
                    </p>
                  </div>
                )}

                {licenseActive && !isFreeTrial && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-700 dark:bg-emerald-900/20">
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                      Sua licença está ativa. Você pode gerar um pagamento para renovar antecipadamente.
                    </p>
                  </div>
                )}

                {/* PIX button */}
                <button
                  onClick={() => setShowPix(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                >
                  <QrCode className="h-5 w-5" />
                  Gerar Pagamento PIX
                </button>
              </div>
            )}

            {isAdmin && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Como administrador, você não precisa de licença.
              </p>
            )}
          </div>
        )}

        {/* Show message if trying to access payment tab during active trial */}
        {activeTab === 'payment' && isInActiveTrial && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-700 dark:bg-blue-900/20">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Você está no período de teste gratuito de 30 dias. A opção de pagamento estará disponível após a expiração do período de teste.
            </p>
            <button
              onClick={() => setActiveTab('profile')}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Voltar ao perfil
            </button>
          </div>
        )}
      </div>

      {/* PIX payment modal */}
      {showPix && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="animate-slide-up w-full max-w-md rounded-t-3xl bg-white p-5 dark:bg-slate-800 sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Pagamento PIX
              </h2>
              <button
                onClick={() => setShowPix(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <PixPaymentPanel />
          </div>
        </div>
      )}

      {/* Tutorial modal */}
      {showTutorial && tutorialUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="animate-slide-up w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
                  <PlayCircle className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Tutorial
                </h2>
              </div>
              <button
                onClick={() => setShowTutorial(false)}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              {iframeError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center dark:bg-slate-900">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Este conteúdo não pode ser exibido diretamente aqui.
                  </p>
                  <a
                    href={tutorialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-700"
                  >
                    Abrir no navegador
                  </a>
                </div>
              ) : (
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={embedUrl}
                  title="Tutorial"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={() => setIframeError(true)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
