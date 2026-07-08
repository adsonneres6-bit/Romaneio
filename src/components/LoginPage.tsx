import { useState, useEffect, useRef } from 'react';
import { Truck, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { login, confirmDeviceLogin, type LoginResult, type UserWithLicenseStatus } from '../services/authService';
import { supabase } from '../lib/supabase';
import { EmailInput } from './EmailInput';
import { GlobalAnnouncementModal } from './GlobalAnnouncementModal';
import {
  getActiveAnnouncements,
  confirmAnnouncement,
  dismissAnnouncementLocally,
  type GlobalAnnouncement,
} from '../services/announcementService';

const REMEMBERED_EMAIL_KEY = 'romaneio_remembered_email';
const REMEMBERED_PASSWORD_KEY = 'romaneio_remembered_password';

interface LoginPageProps {
  onSuccess: (user?: UserWithLicenseStatus | null) => void;
  onRegister: () => void;
}

export function LoginPage({ onSuccess, onRegister }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [persist, setPersist] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingDeviceLogin, setPendingDeviceLogin] = useState<{
    userId: string;
  } | null>(null);

  // Login announcement state
  const [loginAnnouncement, setLoginAnnouncement] = useState<GlobalAnnouncement | null>(null);
  const [checkingAnnouncements, setCheckingAnnouncements] = useState(true);

  // Pending announcement confirmation after login
  const pendingAnnouncementRef = useRef<string | null>(null);

  // Carrega e-mail e senha salvos quando "Permanecer conectado" estava marcado
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      const savedPassword = localStorage.getItem(REMEMBERED_PASSWORD_KEY);

      if (savedEmail) {
        setEmail(savedEmail);
        setPersist(true);
      }

      if (savedPassword) {
        setPassword(savedPassword);
      }
    } catch {
      // Ignora erros do localStorage
    }
  }, []);

  // Check for login announcements
  useEffect(() => {
    const checkLoginAnnouncements = async () => {
      setCheckingAnnouncements(true);
      const announcements = await getActiveAnnouncements('login');
      if (announcements.length > 0) {
        setLoginAnnouncement(announcements[0]);
      }
      setCheckingAnnouncements(false);
    };
    checkLoginAnnouncements();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    // Salva ou remove as credenciais conforme a opção "Permanecer conectado"
    try {
      if (persist) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
        localStorage.setItem(REMEMBERED_PASSWORD_KEY, password);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
      }
    } catch {
      // Ignora erros do localStorage
    }

    try {
      const result: LoginResult = await login(email, password, persist);

      if (result.ok && result.user) {
        // Confirm any pending announcement after successful login
        if (pendingAnnouncementRef.current) {
          await confirmAnnouncement(result.user.id, pendingAnnouncementRef.current);
          pendingAnnouncementRef.current = null;
        }
        if (result.needsDeviceConfirmation) {
          setPendingDeviceLogin({ userId: result.user.id });
        } else {
          onSuccess(result.user);
        }
      } else {
        setError(result.error ?? 'Erro ao entrar.');
      }
    } catch {
      setError('Erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDevice = async () => {
    if (!pendingDeviceLogin) return;

    setLoading(true);
    setError('');

    try {
      const result = await confirmDeviceLogin(pendingDeviceLogin.userId);

      if (result.ok && result.user) {
        onSuccess(result.user);
      } else {
        setError(result.error ?? 'Erro ao confirmar login.');
      }
    } catch {
      setError('Erro ao confirmar login. Tente novamente.');
    } finally {
      setLoading(false);
      setPendingDeviceLogin(null);
    }
  };

  const handleCancelDeviceLogin = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore errors
    }
    setPendingDeviceLogin(null);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 px-4 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-8 text-center">
            <img
              src="/icons/icon-192x192.png"
              alt="Otimizador De Rota"
              className="mx-auto h-24 w-24 rounded-2xl object-contain"
            />

            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              Bem-vindo!
            </h1>

            <p className="mt-2 text-base font-medium text-brand-600 dark:text-brand-400">
              Feito para quem vive de entregas.
            </p>

            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Organize seus pedidos, otimize suas rotas e faça mais entregas em menos tempo.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                E-mail
              </label>

              <EmailInput
                value={email}
                onChange={setEmail}
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Senha
              </label>

              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-11 text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex cursor-pointer select-none items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={persist}
                onClick={() => setPersist((p) => !p)}
                className={`relative h-6 w-11 overflow-hidden rounded-full transition-colors ${
                  persist
                    ? 'bg-brand-600'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    persist ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>

              <span
                className="text-sm font-medium text-slate-700 dark:text-slate-300"
                onClick={() => setPersist((p) => !p)}
              >
                Permanecer conectado
              </span>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Não tem conta?{' '}
            <button
              onClick={onRegister}
              className="font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
            >
              Cadastre-se
            </button>
          </p>
        </div>
      </div>

      {/* Device confirmation modal */}
      {pendingDeviceLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 dark:bg-slate-800">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Sessão Ativa Detectada
              </h2>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Sua conta já está em uso em outro dispositivo. Deseja desconectar o outro aparelho para continuar neste dispositivo?
              </p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCancelDeviceLogin}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDevice}
                disabled={loading}
                className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {loading ? 'Conectando...' : 'Desconectar outro aparelho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Announcement Modal */}
      {loginAnnouncement && (
        <GlobalAnnouncementModal
          announcement={loginAnnouncement}
          onConfirm={async () => {
            // Store the announcement ID to confirm after login
            pendingAnnouncementRef.current = loginAnnouncement.id;
            // Also dismiss locally so it doesn't show again before login
            dismissAnnouncementLocally(loginAnnouncement.id);
            setLoginAnnouncement(null);
          }}
        />
      )}
    </div>
  );
}