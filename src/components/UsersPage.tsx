import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  ArrowLeft,
  Save,
  Trash2,
  Edit3,
  X,
  CreditCard,
  Mail,
  Phone,
  User as UserIcon,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Monitor,
  Gift,
  Award,
} from 'lucide-react';
import {
  createUserWithLicense,
  updateUser,
  deleteUser,
  getUserStats,
  formatPhoneBR,
} from '../services/authService';
import { supabase } from '../lib/supabase';
import { renewLicense, formatDateBR, type AccessDurationPreset } from '../services/licenseService';
import { getMaxDevicesPerUser } from '../services/settingsService';
import { getAllUsersReferralData, triggerFirstPurchaseBonus, type AdminReferralData } from '../services/referralService';
import { getUserDevices, removeUserDevice, deactivateUserDevice, formatDateBR as formatDeviceDateBR, type DeviceRecord } from '../services/deviceService';
import { ConfirmModal } from './ConfirmModal';
import { AlertModal } from './AlertModal';

interface UserStatus {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  license: {
    days: number;
    is_free_trial: boolean;
    expires_at: string;
  } | null;
  fingerprint_trial_used: boolean;
  fingerprint_trial_expired: boolean;
  status: "active" | "trial" | "expired" | "no_license";
  days_remaining: number;
}

interface UsersPageProps {
  onBack: () => void;
  onPayment: () => void;
}

export function UsersPage({ onBack, onPayment }: UsersPageProps) {
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, trial: 0, expired: 0 });
  const [editingUser, setEditingUser] = useState<UserStatus | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [showNewUser, setShowNewUser] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // New user fields
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [accessPreset, setAccessPreset] = useState<AccessDurationPreset>('30');
  const [customDays, setCustomDays] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [editRenewDays, setEditRenewDays] = useState('');
  const [maxDevices, setMaxDevicesState] = useState(2);
  const [editingDevices, setEditingDevices] = useState<DeviceRecord[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceRecord | null>(null);
  const [deviceToDeactivate, setDeviceToDeactivate] = useState<DeviceRecord | null>(null);
  const [referralData, setReferralData] = useState<Map<string, AdminReferralData>>(new Map());

  const refreshUsers = useCallback(async () => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Call the edge function for comprehensive user status
      const response = await fetch(`${supabaseUrl}/functions/v1/get-user-fingerprint-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);

        // Calculate stats
        const total = data.users?.length || 0;
        const active = data.users?.filter((u: UserStatus) => u.status === 'active').length || 0;
        const trial = data.users?.filter((u: UserStatus) => u.status === 'trial').length || 0;
        const expired = data.users?.filter((u: UserStatus) => u.status === 'expired' || u.status === 'no_license').length || 0;
        const inactive = data.users?.filter((u: UserStatus) => !u.active).length || 0;

        setStats({ total, active, inactive, trial, expired });
      } else {
        // Fallback to old method
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        const { data: licenses } = await supabase.from('licenses').select('*');
        const licenseMap = new Map(licenses?.map((l) => [l.user_id, l]));

        if (profiles) {
          const fallbackUsers: UserStatus[] = profiles
            .filter((p) => !p.is_admin)
            .map((p) => {
              const license = licenseMap.get(p.id);
              const daysRemaining = license
                ? Math.ceil((new Date(license.expires_at).getTime() - Date.now()) / 86400000)
                : 0;

              let status: "active" | "trial" | "expired" | "no_license" = "no_license";
              if (license && daysRemaining > 0) {
                status = license.is_free_trial ? "trial" : "active";
              } else if (license) {
                status = "expired";
              }

              return {
                id: p.id,
                name: p.name,
                active: p.active,
                created_at: p.created_at,
                license: license
                  ? {
                      days: license.days,
                      is_free_trial: license.is_free_trial,
                      expires_at: license.expires_at,
                    }
                  : null,
                fingerprint_trial_used: false,
                fingerprint_trial_expired: false,
                status,
                days_remaining: daysRemaining,
              };
            });
          setUsers(fallbackUsers);
        }
      }
    } catch (error) {
      console.error('Error refreshing users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUsers();
    getMaxDevicesPerUser().then(setMaxDevicesState);
    getAllUsersReferralData().then((data) => {
      const map = new Map<string, AdminReferralData>();
      for (const item of data) {
        map.set(item.userId, item);
      }
      setReferralData(map);
    });
  }, [refreshUsers]);

  const handleToggleActive = useCallback(
    async (user: UserStatus) => {
      await updateUser(user.id, { active: !user.active });
      await refreshUsers();
    },
    [refreshUsers]
  );

  const handleDelete = useCallback((user: UserStatus) => {
    setUserToDelete(user);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!userToDelete) return;
    await deleteUser(userToDelete.id);
    await refreshUsers();
    setUserToDelete(null);
  }, [userToDelete, refreshUsers]);

  const handleEdit = useCallback(async (user: UserStatus) => {
    setEditingUser(user);
    setEditPassword('');
    setLoadingDevices(true);
    const devices = await getUserDevices(user.id);
    setEditingDevices(devices);
    setLoadingDevices(false);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingUser) return;

    if (editPassword) {
      await updateUser(editingUser.id, { password: editPassword });
    }
    if (editRenewDays) {
      const days = parseInt(editRenewDays, 10);
      if (!isNaN(days) && days >= 1) {
        await renewLicense(editingUser.id, days);
        // Trigger referral bonus check (first purchase mode)
        await triggerFirstPurchaseBonus(editingUser.id);
      }
    }
    await refreshUsers();
    setEditingUser(null);
    setEditRenewDays('');
    setEditingDevices([]);
  }, [editingUser, editPassword, editRenewDays, refreshUsers]);

  const handleDeactivateDevice = useCallback((device: DeviceRecord) => {
    setDeviceToDeactivate(device);
  }, []);

  const confirmDeactivateDevice = useCallback(async () => {
    if (!deviceToDeactivate || !editingUser) return;
    const result = await deactivateUserDevice(deviceToDeactivate.id);
    if (result.success) {
      const devices = await getUserDevices(editingUser.id);
      setEditingDevices(devices);
    } else {
      setAlertMessage(result.error || 'Erro ao desativar dispositivo');
    }
    setDeviceToDeactivate(null);
  }, [deviceToDeactivate, editingUser]);

  const handleRemoveDevice = useCallback((device: DeviceRecord) => {
    setDeviceToDelete(device);
  }, []);

  const confirmRemoveDevice = useCallback(async () => {
    if (!deviceToDelete || !editingUser) return;
    const result = await removeUserDevice(deviceToDelete.id);
    if (result.success) {
      const devices = await getUserDevices(editingUser.id);
      setEditingDevices(devices);
    } else {
      setAlertMessage(result.error || 'Erro ao excluir dispositivo');
    }
    setDeviceToDelete(null);
  }, [deviceToDelete, editingUser]);

  const handleCreateUser = useCallback(async () => {
    if (!newName || newName.trim().length < 2) {
      setAlertMessage('Nome inválido');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setAlertMessage('E-mail inválido');
      return;
    }
    if (newPassword.length < 6) {
      setAlertMessage('Senha muito curta (mín. 6 caracteres)');
      return;
    }

    const days =
      accessPreset === 'custom' ? parseInt(customDays, 10) : parseInt(accessPreset, 10);
    if (isNaN(days) || days < 0) {
      setAlertMessage('Quantidade de dias inválida');
      return;
    }

    const result = await createUserWithLicense(
      newName.trim(),
      newEmail.trim().toLowerCase(),
      newPassword,
      days,
      newIsAdmin,
      newPhone
    );
    if (!result.ok) {
      setAlertMessage(result.error ?? 'Erro ao cadastrar');
      return;
    }

    await refreshUsers();
    setShowNewUser(false);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setAccessPreset('30');
    setCustomDays('');
    setNewIsAdmin(false);
  }, [newName, newEmail, newPassword, newPhone, accessPreset, customDays, newIsAdmin, refreshUsers]);

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
              <Users className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Usuários
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Statistics */}
        <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.total}
            </div>
            <div className="text-sm text-slate-500">Total</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/30">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {stats.active}
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-500">Ativos</div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {stats.inactive}
            </div>
            <div className="text-sm text-red-600 dark:text-red-500">Inativos</div>
          </div>
          <div className="hidden rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30 sm:block">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {stats.trial}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-500">Teste</div>
          </div>
          <div className="hidden rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/30 sm:block">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              {stats.expired}
            </div>
            <div className="text-sm text-amber-600 dark:text-amber-500">Expirados</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setShowNewUser(true)}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </button>
          <button
            onClick={onPayment}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <CreditCard className="h-4 w-4" />
            Pagamento
          </button>
        </div>

        {/* User list */}
        <div className="space-y-3">
          {users.map((user) => {
            // Determine status label and color
            const getStatusInfo = () => {
              switch (user.status) {
                case 'active':
                  return {
                    label: 'Assinatura',
                    color: 'text-emerald-600 dark:text-emerald-400',
                    bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
                    icon: CheckCircle,
                  };
                case 'trial':
                  return {
                    label: 'Teste',
                    color: 'text-blue-600 dark:text-blue-400',
                    bgColor: 'bg-blue-100 dark:bg-blue-900/50',
                    icon: Clock,
                  };
                case 'expired':
                  return {
                    label: 'Expirada',
                    color: 'text-amber-600 dark:text-amber-400',
                    bgColor: 'bg-amber-100 dark:bg-amber-900/50',
                    icon: AlertTriangle,
                  };
                case 'no_license':
                default:
                  return {
                    label: 'Sem licença',
                    color: 'text-red-600 dark:text-red-400',
                    bgColor: 'bg-red-100 dark:bg-red-900/50',
                    icon: AlertTriangle,
                  };
              }
            };

            const statusInfo = getStatusInfo();
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={user.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-white">
                        {user.name}
                      </span>
                      {!user.active && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                          Inativo
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Cadastrado: {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="mt-1.5 text-xs">
                      <span className="text-slate-400">Status: </span>
                      <span className={`font-medium ${statusInfo.color}`}>
                        {user.status === 'expired' || user.status === 'no_license'
                          ? 'Licença expirada'
                          : user.days_remaining > 0
                            ? `${user.days_remaining} dias restantes`
                            : 'Expirado'}
                      </span>
                      {user.license && (
                        <span className="ml-2 text-slate-400">
                          (vence em {formatDateBR(user.license.expires_at)})
                        </span>
                      )}
                    </div>
                    {user.fingerprint_trial_used && user.fingerprint_trial_expired && (
                      <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Fingerprint: Trial já utilizado (expirado)
                      </div>
                    )}

                    {/* Referral info */}
                    {referralData.get(user.id) && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {referralData.get(user.id)!.referralCode && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                            <Gift className="h-3 w-3" />
                            Código: {referralData.get(user.id)!.referralCode}
                          </span>
                        )}
                        {referralData.get(user.id)!.referredByName && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            <UserIcon className="h-3 w-3" />
                            Indicado por: {referralData.get(user.id)!.referredByName}
                          </span>
                        )}
                        {referralData.get(user.id)!.totalReferred > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                            <Users className="h-3 w-3" />
                            Indicações: {referralData.get(user.id)!.totalReferred}
                          </span>
                        )}
                        {referralData.get(user.id)!.totalBonusDays > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                            <Award className="h-3 w-3" />
                            Dias ganhos: {referralData.get(user.id)!.totalBonusDays}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                      title="Editar"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`rounded-lg p-2 transition-colors ${
                        user.active
                          ? 'text-emerald-500 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30'
                          : 'text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30'
                      }`}
                      title={user.active ? 'Desativar' : 'Ativar'}
                    >
                      {user.active ? (
                        <UserCheck className="h-4 w-4" />
                      ) : (
                        <UserX className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* New User Modal */}
      {showNewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Novo Usuário
              </h2>
              <button
                onClick={() => setShowNewUser(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nome
                </label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    placeholder="Nome do usuário"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Senha (mín. 6 caracteres)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="••••••"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Telefone
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(formatPhoneBR(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    placeholder="(11)91234-5678"
                  />
                </div>
              </div>

              {/* Access duration */}
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Tempo de acesso
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: '30', label: '30 dias' },
                    { value: '15', label: '15 dias' },
                    { value: '7', label: '7 dias — Teste' },
                    { value: 'custom', label: 'Personalizado' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAccessPreset(opt.value)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        accessPreset === opt.value
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {accessPreset === 'custom' && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Quantidade de dias
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      placeholder="Ex.: 0, 1, 5, 20, 45, 90"
                    />
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Perfil
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setNewIsAdmin(false)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      !newIsAdmin
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <UserIcon className="h-4 w-4" />
                    Usuário
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewIsAdmin(true)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      newIsAdmin
                        ? 'border-purple-600 bg-purple-600 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Shield className="h-4 w-4" />
                    Administrador
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreateUser}
                className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Save className="mr-2 inline h-4 w-4" />
                Criar Usuário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Editar Usuário
              </h2>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* User info */}
              <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {editingUser.name}
                  </span>
                  {editingUser.is_admin && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      Admin
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nova Senha (deixe vazio para manter)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="••••••"
                />
              </div>

              {/* Current license */}
              {editingUser.license && (
                <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Vencimento</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {formatDateBR(editingUser.license.expires_at)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Dias restantes</span>
                    <span
                      className={`font-medium ${
                        editingUser.license.expires_at < new Date().toISOString().split('T')[0]
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {editingUser.license.expires_at < new Date().toISOString().split('T')[0]
                        ? 'Expirada'
                        : `${Math.ceil(
                            (new Date(editingUser.license.expires_at).getTime() - Date.now()) / 86400000
                          )} dias`}
                    </span>
                  </div>
                </div>
              )}

              {/* Renewal */}
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Renovar licença (dias)
                </label>
                <input
                  type="number"
                  min={1}
                  value={editRenewDays}
                  onChange={(e) => setEditRenewDays(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-900 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="Ex.: 30 — reinicia a contagem a partir de hoje"
                />
              </div>

              <button
                onClick={handleSaveEdit}
                className="w-full rounded-xl bg-brand-600 py-3 font-medium text-white transition-colors hover:bg-brand-700"
              >
                <Save className="mr-2 inline h-4 w-4" />
                Salvar
              </button>

              {/* Devices section */}
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div className="mb-3 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Dispositivos autorizados
                  </h3>
                </div>

                {loadingDevices ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                  </div>
                ) : editingDevices.length === 0 ? (
                  <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
                    Nenhum dispositivo registrado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editingDevices.map((device) => (
                      <div
                        key={device.id}
                        className={`rounded-lg border p-3 ${
                          device.isActive
                            ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50'
                            : 'border-slate-200 bg-slate-100 opacity-60 dark:border-slate-700 dark:bg-slate-900/30'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-900 dark:text-white">
                                {device.browser || 'Navegador desconhecido'} {device.browserVersion}
                              </span>
                              {!device.isActive && (
                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                                  Inativo
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              {device.os} {device.osVersion}
                              {device.screenResolution && <> • {device.screenResolution}</>}
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                              {device.timezone && <>Timezone: {device.timezone} • </>}
                              Idioma: {device.language || 'N/A'}
                            </div>
                            <div className="mt-1.5 text-[10px] text-slate-400">
                              Primeiro acesso: {formatDeviceDateBR(device.firstAccessAt)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Último acesso: {formatDeviceDateBR(device.lastAccessAt)}
                            </div>
                          </div>
                          <div className="ml-2 flex items-center gap-1">
                            {device.isActive && (
                              <button
                                onClick={() => handleDeactivateDevice(device)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                                title="Desativar dispositivo"
                              >
                                Desativar
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveDevice(device)}
                              className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                              title="Excluir dispositivo permanentemente"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-2 text-[10px] text-slate-400">
                  {editingDevices.filter(d => d.isActive).length} de {maxDevices} dispositivo(s) ativo(s)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage('')} />
      )}

      {userToDelete && (
        <ConfirmModal
          title="Excluir usuário?"
          message={`Tem certeza que deseja excluir ${userToDelete.name}? Esta ação não poderá ser desfeita.`}
          confirmLabel="Excluir"
          confirmVariant="danger"
          onConfirm={confirmDelete}
          onCancel={() => setUserToDelete(null)}
        />
      )}

      {deviceToDeactivate && (
        <ConfirmModal
          title="Desativar dispositivo?"
          message="O usuário ficará impedido de acessar a conta a partir deste aparelho. A vaga permanece reservada e pode ser reativada."
          confirmLabel="Desativar"
          confirmVariant="danger"
          onConfirm={confirmDeactivateDevice}
          onCancel={() => setDeviceToDeactivate(null)}
        />
      )}

      {deviceToDelete && (
        <ConfirmModal
          title="Excluir dispositivo?"
          message="O dispositivo será removido permanentemente. O usuário perderá o acesso a partir deste aparelho e uma vaga será liberada para um novo dispositivo."
          confirmLabel="Excluir"
          confirmVariant="danger"
          onConfirm={confirmRemoveDevice}
          onCancel={() => setDeviceToDelete(null)}
        />
      )}
    </div>
  );
}
