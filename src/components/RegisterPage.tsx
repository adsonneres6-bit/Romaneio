import { useState } from 'react';
import { Truck, Lock, ArrowLeft, Eye, EyeOff, User as UserIcon, Phone, Gift } from 'lucide-react';
import { register, formatPhoneBR, type RegisterResult, type UserWithLicenseStatus } from '../services/authService';
import { validateReferralCode } from '../services/referralService';
import { EmailInput } from './EmailInput';

interface RegisterPageProps {
  onSuccess: (user?: UserWithLicenseStatus | null) => void;
  onBack: () => void;
}

export function RegisterPage({ onSuccess, onBack }: RegisterPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralValidating, setReferralValidating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const passwordTooShort = password.length > 0 && password.length < 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (password.length < 6) {
      setError('Senha muito curta (mín. 6 caracteres).');
      return;
    }
    // Validate referral code if provided
    if (referralCode.trim()) {
      setReferralValidating(true);
      try {
        const result = await validateReferralCode(referralCode.trim());
        if (!result.valid) {
          setError(result.error || 'Código de indicação não encontrado. Verifique e tente novamente.');
          setReferralValidating(false);
          return;
        }
      } catch (err) {
        console.error('Error validating referral code:', err);
        setError('Não foi possível validar o código de indicação. Tente novamente.');
        setReferralValidating(false);
        return;
      }
      setReferralValidating(false);
    }

    setLoading(true);
    try {
      const result: RegisterResult = await register(name, email, password, phone, referralCode.trim());
      if (result.ok) {
        onSuccess(result.user);
      } else {
        setError(result.error ?? 'Erro ao cadastrar.');
      }
    } catch {
      setError('Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 px-4 dark:from-slate-900 dark:to-slate-950">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg">
              <Truck className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Criar conta</h1>
            <p className="mt-2 text-base font-medium text-brand-600 dark:text-brand-400">
              Junte-se a nos!
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nome */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nome
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Telefone
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                  placeholder="(11)91234-5678"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* E-mail */}
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

            {/* Senha */}
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
                  placeholder="Mínimo 6 caracteres"
                  required
                  className={`w-full rounded-xl border py-3 pl-11 pr-11 text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 dark:text-white dark:placeholder-slate-400 ${
                    passwordTooShort
                      ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400/20 dark:border-red-600 dark:bg-red-950/30'
                      : 'border-slate-300 bg-white focus:border-brand-500 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700'
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordTooShort && (
                <p className="mt-1 text-xs text-red-500">Mínimo 6 caracteres.</p>
              )}
            </div>

            {/* Confirmar Senha */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Confirmar senha
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  required
                  className={`w-full rounded-xl border py-3 pl-11 pr-11 text-slate-900 placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 dark:text-white dark:placeholder-slate-400 ${
                    passwordMismatch
                      ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400/20 dark:border-red-600 dark:bg-red-950/30'
                      : 'border-slate-300 bg-white focus:border-brand-500 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700'
                  }`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {passwordMismatch && (
                <p className="mt-1 text-xs text-red-500">As senhas não coincidem.</p>
              )}
            </div>

            {/* Código de indicação */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Código de indicação (Opcional)
              </label>
              <div className="relative">
                <Gift className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  placeholder="Ex.: A7K9P2"
                  maxLength={6}
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  autoComplete="off"
                />
              </div>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Se alguém te indicou, digite o código aqui.
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || referralValidating || passwordMismatch || passwordTooShort}
              className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Já tem conta?{' '}
            <button
              onClick={onBack}
              className="font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
            >
              Entrar
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
