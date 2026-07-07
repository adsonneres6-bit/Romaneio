import { supabase } from '../lib/supabase';
import { getLicenseStatus, daysRemainingFromLicense, getLicense } from './licenseService';
import { checkTrialEligibility } from './trialControlService';
import { validateDevice, checkActiveSession, disconnectOtherDevices, getDeviceId } from './deviceService';
import { getTrialDays } from './settingsService';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  active: boolean;
  isAdmin: boolean;
}

export interface UserWithLicenseStatus extends User {
  licenseStatus: {
    isValid: boolean;
    isExpired: boolean;
    isInActiveTrial: boolean;
    licenseExpired: boolean;
    fingerprintExpired: boolean;
    daysRemaining: number;
    isFreeTrial: boolean;
  };
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_admin: boolean;
  active: boolean;
  created_at: string;
  last_login: string | null;
}

export function formatPhoneBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  let out = '(' + digits.slice(0, 2);
  if (digits.length >= 2) out += ')';
  if (digits.length > 2) out += ' ' + digits.slice(2, 7);
  if (digits.length > 7) out += '-' + digits.slice(7);
  return out;
}

const ADMIN_EMAIL = 'admin0610@gmail.com';

export function isAdminUser(user: User | Profile | null): boolean {
  if (!user) return false;
  return 'is_admin' in user ? user.is_admin : user.isAdmin;
}

export interface Session {
  userId: string;
  persist: boolean;
}

function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Polls until the profile row created by handle_new_user trigger exists.
// The trigger is synchronous in Postgres but may not be visible immediately
// after signUp returns on the client side.
async function waitForProfile(userId: string, maxWaitMs = 5000): Promise<void> {
  const interval = 200;
  let elapsed = 0;
  while (elapsed < maxWaitMs) {
    const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (data) return;
    await new Promise((r) => setTimeout(r, interval));
    elapsed += interval;
  }
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
  user?: UserWithLicenseStatus;
}

export async function register(
  name: string,
  email: string,
  password: string,
  phone: string = '',
  referralCode: string = ''
): Promise<RegisterResult> {
  const normalizedEmail = normalizeEmail(email);

  if (!name || name.trim().length < 2) {
    return { ok: false, error: 'Nome inválido.' };
  }
  if (!validateEmail(normalizedEmail)) {
    return { ok: false, error: 'E-mail inválido.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Senha muito curta (mín. 6 caracteres).' };
  }

  // Create user in Auth
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        name: name.trim(),
        phone: phone.trim(),
      },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { ok: false, error: 'E-mail já cadastrado.' };
    }
    return { ok: false, error: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'Erro ao criar usuário.' };
  }

  const userId = data.user.id;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Execute all secondary operations in parallel to speed up registration
  // These are non-blocking - failures should not prevent user creation
  const [trialDays] = await Promise.all([
    getTrialDays(),
    // Wait for profile creation (trigger is async)
    waitForProfile(userId),
  ]);

  // Now execute parallel operations that depend on profile being ready
  await Promise.all([
    // Create trial license for ALL new users (independent of fingerprint)
    // This ensures every new user gets their free trial days
    (async () => {
      try {
        await fetch(`${supabaseUrl}/functions/v1/create-trial-license`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ userId, days: trialDays, isFreeTrial: true }),
        });
      } catch {
        // License creation failure should not block registration
      }
    })(),

    // Register device for this user
    (async () => {
      try {
        await validateDevice(userId);
      } catch {
        // Device registration failure should not block registration
      }
    })(),

    // Process referral if a code was provided (completely independent)
    (async () => {
      if (!referralCode.trim()) return;
      try {
        // First register the referral (must complete before bonus can be processed)
        await fetch(`${supabaseUrl}/functions/v1/register-referral`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            referredUserId: userId,
            referralCode: referralCode.trim(),
          }),
        });

        // Then process the bonus (needs the referral record to exist)
        await fetch(`${supabaseUrl}/functions/v1/process-referral-bonus`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            referredUserId: userId,
            trigger: 'immediate',
          }),
        });
      } catch {
        // Referral processing failure should not block registration
      }
    })(),
  ]);

  // Get license status for newly registered user
  const licenseStatus = await getUserLicenseStatus(userId, false);

  const user: UserWithLicenseStatus = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    createdAt: new Date().toISOString(),
    active: true,
    isAdmin: false,
    licenseStatus,
  };

  return { ok: true, user };
}

export interface CreateUserResult {
  ok: boolean;
  error?: string;
}

export async function createUserWithLicense(
  name: string,
  email: string,
  password: string,
  days: number,
  isAdmin: boolean = false,
  phone: string = ''
): Promise<CreateUserResult> {
  const normalizedEmail = normalizeEmail(email);

  if (!name || name.trim().length < 2) {
    return { ok: false, error: 'Nome inválido.' };
  }
  if (!validateEmail(normalizedEmail)) {
    return { ok: false, error: 'E-mail inválido.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Senha muito curta (mín. 6 caracteres).' };
  }
  if (days < 0) {
    return { ok: false, error: 'Quantidade de dias inválida.' };
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        name: name.trim(),
        phone: phone.trim(),
        is_admin: isAdmin,
      },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      return { ok: false, error: 'E-mail já cadastrado.' };
    }
    return { ok: false, error: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'Erro ao criar usuário.' };
  }

  // Update profile to set admin status
  if (isAdmin) {
    await supabase
      .from('profiles')
      .update({ is_admin: true })
      .eq('id', data.user.id);
  }

  // Create license
  await createLicense(data.user.id, days);

  return { ok: true };
}

export interface LoginResult {
  ok: boolean;
  error?: string;
  user?: UserWithLicenseStatus;
  needsDeviceConfirmation?: boolean;
  deviceValidation?: {
    hasActiveSession: boolean;
    otherDeviceId?: string;
  };
}

/**
 * Get complete license status for a user (to be called during login)
 */
export async function getUserLicenseStatus(userId: string, isAdmin: boolean): Promise<UserWithLicenseStatus['licenseStatus']> {
  // Admin always has valid access
  if (isAdmin) {
    return {
      isValid: true,
      isExpired: false,
      isInActiveTrial: false,
      licenseExpired: false,
      fingerprintExpired: false,
      daysRemaining: 999,
      isFreeTrial: false,
    };
  }

  // Fetch license and fingerprint trial status in parallel (independent operations)
  const [license, trialEligibility] = await Promise.all([
    getLicense(userId),
    checkTrialEligibility(userId).catch(() => null),
  ]);

  const remaining = daysRemainingFromLicense(license);
  const licenseExpired = remaining <= 0;
  const isFreeTrial = license?.is_free_trial === true;

  let fingerprintExpired = false;
  let fingerprintTrialUsed = false;

  if (trialEligibility) {
    fingerprintTrialUsed = trialEligibility.trialUsed;
    fingerprintExpired = trialEligibility.trialUsed && trialEligibility.isExpired === true;
  } else {
    // If fingerprint check fails, assume expired for safety
    fingerprintExpired = true;
  }

  // Determine if user is in an active trial
  const isInActiveTrial = isFreeTrial && !licenseExpired && !fingerprintExpired;

  // Determine overall validity
  const isValid = isInActiveTrial || (!licenseExpired && !isFreeTrial);

  return {
    isValid,
    isExpired: !isValid,
    isInActiveTrial,
    licenseExpired,
    fingerprintExpired,
    daysRemaining: remaining,
    isFreeTrial,
  };
}

export async function login(
  email: string,
  password: string,
  persist: boolean
): Promise<LoginResult> {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return { ok: false, error: 'Preencha todos os campos.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { ok: false, error: 'E-mail ou senha incorretos.' };
    }
    return { ok: false, error: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'Erro ao fazer login.' };
  }

  // Get profile to check active status (with timeout guard)
  const profilePromise = supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();
  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  const { data: profile } = await Promise.race([profilePromise, timeoutPromise]);

  const isAdmin = profile?.is_admin === true;

  // Check if user is active (admin is always active)
  if (!isAdmin && profile && !profile.active) {
    await supabase.auth.signOut();
    return { ok: false, error: 'Usuário desativado. Contate o administrador.' };
  }

  // Fire-and-forget: update last login (non-critical, should not block login)
  supabase
    .from('profiles')
    .update({ last_login: new Date().toISOString() })
    .eq('id', data.user.id)
    .then(() => {}, () => {});

  // Device validation and license status are independent — run in parallel
  if (!isAdmin) {
    const [deviceResult, sessionCheck, currentDeviceId, licenseStatus] = await Promise.all([
      validateDevice(data.user.id),
      checkActiveSession(data.user.id),
      getDeviceId(),
      getUserLicenseStatus(data.user.id, false),
    ]);

    if (!deviceResult.valid) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: deviceResult.error || 'Limite de dispositivos atingido. Entre em contato com o administrador para liberar um novo aparelho.'
      };
    }

    if (sessionCheck.hasActiveSession && sessionCheck.deviceId !== currentDeviceId) {
      return {
        ok: true,
        needsDeviceConfirmation: true,
        deviceValidation: {
          hasActiveSession: true,
          otherDeviceId: sessionCheck.deviceId
        },
        user: {
          id: data.user.id,
          name: profile?.name || data.user.user_metadata?.name || 'Usuário',
          email: data.user.email || normalizedEmail,
          phone: profile?.phone || data.user.user_metadata?.phone,
          createdAt: profile?.created_at || new Date().toISOString(),
          active: profile?.active ?? true,
          isAdmin,
          licenseStatus
        }
      };
    }

    // No conflict — activate current device and deactivate any lingering others
    // This is non-blocking: the user object is already built with licenseStatus
    disconnectOtherDevices(data.user.id, currentDeviceId).catch(() => {});

    const user: UserWithLicenseStatus = {
      id: data.user.id,
      name: profile?.name || data.user.user_metadata?.name || 'Usuário',
      email: data.user.email || normalizedEmail,
      phone: profile?.phone || data.user.user_metadata?.phone,
      createdAt: profile?.created_at || new Date().toISOString(),
      active: profile?.active ?? true,
      isAdmin,
      licenseStatus,
    };

    return { ok: true, user };
  }

  // Admin path: license status is instant (hardcoded), no device validation needed
  const licenseStatus = await getUserLicenseStatus(data.user.id, isAdmin);

  const user: UserWithLicenseStatus = {
    id: data.user.id,
    name: profile?.name || data.user.user_metadata?.name || 'Usuário',
    email: data.user.email || normalizedEmail,
    phone: profile?.phone || data.user.user_metadata?.phone,
    createdAt: profile?.created_at || new Date().toISOString(),
    active: profile?.active ?? true,
    isAdmin,
    licenseStatus,
  };

  return { ok: true, user };
}

export async function confirmDeviceLogin(userId: string): Promise<LoginResult> {
  const currentDeviceId = await getDeviceId();

  // Ensure current device is registered before disconnecting others
  await validateDevice(userId).catch(() => {});

  const result = await disconnectOtherDevices(userId, currentDeviceId);

  if (!result.success) {
    return { ok: false, error: result.error || 'Erro ao desconectar outro dispositivo.' };
  }

  // Get profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  const isAdmin = profile?.is_admin === true;

  // Update last login
  await supabase
    .from('profiles')
    .update({ last_login: new Date().toISOString() })
    .eq('id', userId);

  const licenseStatus = await getUserLicenseStatus(userId, isAdmin);

  const user: UserWithLicenseStatus = {
    id: userId,
    name: profile?.name || 'Usuário',
    email: '',
    phone: profile?.phone,
    createdAt: profile?.created_at || new Date().toISOString(),
    active: profile?.active ?? true,
    isAdmin,
    licenseStatus,
  };

  return { ok: true, user };
}

export async function logout(): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
  } catch {
    // Even if signOut times out, clear the local session
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  }
}

export async function getSessionUser(): Promise<UserWithLicenseStatus | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) return null;

  // Fetch profile with a timeout guard to prevent infinite loading
  const profilePromise = supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  const { data: profile } = await Promise.race([profilePromise, timeoutPromise]);

  const isAdmin = profile?.is_admin === true;

  // Register device and get license status in parallel (independent operations)
  let licenseStatus;
  if (!isAdmin) {
    const [, ls] = await Promise.all([
      Promise.race([
        validateDevice(session.user.id).catch(() => {}),
        new Promise<void>((r) => setTimeout(r, 4000)),
      ]),
      getUserLicenseStatus(session.user.id, false),
    ]);
    licenseStatus = ls;
  } else {
    licenseStatus = await getUserLicenseStatus(session.user.id, true);
  }

  return {
    id: session.user.id,
    name: profile?.name || session.user.user_metadata?.name || 'Usuário',
    email: session.user.email || '',
    phone: profile?.phone || session.user.user_metadata?.phone,
    createdAt: profile?.created_at || session.user.created_at,
    active: profile?.active ?? true,
    isAdmin,
    licenseStatus,
  };
}

export function getCurrentUser(): User | null {
  // This is now a synchronous helper that should be replaced by getSessionUser
  // Kept for backwards compatibility during migration
  return null;
}

export async function getAllUsers(): Promise<User[]> {
  const currentUser = await getSessionUser();
  if (!currentUser || !currentUser.isAdmin) {
    return [];
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (!profiles) return [];

  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: '', // Email is not stored in profiles, need to handle separately
    phone: p.phone || undefined,
    createdAt: p.created_at,
    active: p.active,
    isAdmin: p.is_admin,
  }));
}

export interface UserProfileWithLicense {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  is_admin: boolean;
  active: boolean;
  created_at: string;
  last_login: string | null;
  license: {
    days: number;
    is_free_trial: boolean;
    expires_at: string;
  } | null;
}

export async function getAllUsersWithLicenses(): Promise<UserProfileWithLicense[]> {
  const currentUser = await getSessionUser();
  if (!currentUser || !currentUser.isAdmin) {
    return [];
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (!profiles) return [];

  const { data: licenses } = await supabase.from('licenses').select('*');

  const licenseMap = new Map(licenses?.map((l) => [l.user_id, l]));

  // We need to get emails from auth.users, but we can't access them directly
  // Instead, we'll use the profile data
  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    email: '', // Will need to be handled differently
    phone: p.phone,
    is_admin: p.is_admin,
    active: p.active,
    created_at: p.created_at,
    last_login: p.last_login,
    license: licenseMap.has(p.id)
      ? {
          days: licenseMap.get(p.id)!.days,
          is_free_trial: licenseMap.get(p.id)!.is_free_trial,
          expires_at: licenseMap.get(p.id)!.expires_at,
        }
      : null,
  }));
}

export async function updateUser(
  userId: string,
  updates: {
    name?: string;
    phone?: string;
    password?: string;
    active?: boolean;
    is_admin?: boolean;
  }
): Promise<{ ok: boolean; error?: string }> {
  const currentUser = await getSessionUser();
  if (!currentUser) {
    return { ok: false, error: 'Não autenticado.' };
  }

  // Only admin can update is_admin or active for other users
  if ((updates.is_admin !== undefined || updates.active !== undefined) && userId !== currentUser.id && !currentUser.isAdmin) {
    return { ok: false, error: 'Sem permissão.' };
  }

  // Update profile
  const profileUpdates: { name?: string; phone?: string; active?: boolean; is_admin?: boolean } = {};
  if (updates.name !== undefined) profileUpdates.name = updates.name;
  if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
  if (updates.active !== undefined) profileUpdates.active = updates.active;
  if (updates.is_admin !== undefined) profileUpdates.is_admin = updates.is_admin;

  if (Object.keys(profileUpdates).length > 0) {
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  // Update password if provided
  if (updates.password) {
    const { error } = await supabase.auth.updateUser({ password: updates.password });
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  return { ok: true };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < 6) {
    return { ok: false, error: 'Nova senha muito curta (mín. 6 caracteres).' };
  }

  const currentUser = await getSessionUser();
  if (!currentUser) {
    return { ok: false, error: 'Usuário não encontrado.' };
  }

  // Verify current password by attempting to re-authenticate
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: currentUser.email,
    password: currentPassword,
  });

  if (signInError) {
    return { ok: false, error: 'Senha atual incorreta.' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function deleteUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  const currentUser = await getSessionUser();
  if (!currentUser || !currentUser.isAdmin) {
    return { ok: false, error: 'Sem permissão.' };
  }

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        targetUserId: userId,
        requestingUserId: currentUser.id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ok: false, error: data.error || 'Erro ao excluir usuário.' };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: 'Erro de conexão ao excluir usuário.' };
  }
}

export async function getUserStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  trial: number;
  expired: number;
}> {
  const currentUser = await getSessionUser();
  if (!currentUser || !currentUser.isAdmin) {
    return { total: 0, active: 0, inactive: 0, trial: 0, expired: 0 };
  }

  const { data: profiles } = await supabase.from('profiles').select('id, active');
  const { data: licenses } = await supabase.from('licenses').select('user_id, is_free_trial, expires_at');

  if (!profiles) {
    return { total: 0, active: 0, inactive: 0, trial: 0, expired: 0 };
  }

  const total = profiles.length;
  const active = profiles.filter((p) => p.active).length;
  const inactive = total - active;

  const licenseMap = new Map(licenses?.map((l) => [l.user_id, l]));
  const today = new Date().toISOString().split('T')[0];

  let trial = 0;
  let expired = 0;

  for (const p of profiles) {
    const license = licenseMap.get(p.id);
    if (license) {
      if (license.is_free_trial) trial++;
      if (license.expires_at < today) expired++;
    }
  }

  return { total, active, inactive, trial, expired };
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!domain) return email;

  const visibleStart = localPart.slice(0, 2);
  const maskedMiddle = '*'.repeat(Math.max(1, localPart.length - 2));
  return `${visibleStart}${maskedMiddle}@${domain}`;
}

export function maskPhone(value: string): string {
  return value;
}
