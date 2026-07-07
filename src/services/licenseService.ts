import { supabase } from '../lib/supabase';

export type AccessDurationPreset = '30' | '15' | '7' | 'custom';

export interface License {
  id: string;
  user_id: string;
  days: number;
  is_free_trial: boolean;
  created_at: string;
  expires_at: string;
}

const USER_WARN_KEY = 'checklist_license_warn';
const ADMIN_WARN_KEY = 'checklist_admin_expired_warn';
const EXPIRED_WARN_KEY = 'checklist_expired_warn';

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function createLicense(
  userId: string,
  days: number,
  isFreeTrial: boolean = false
): Promise<License> {
  const expiresAt = addDaysISO(days);

  // Check if license already exists
  const { data: existing } = await supabase
    .from('licenses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    // Update existing license
    const { data, error } = await supabase
      .from('licenses')
      .update({
        days,
        is_free_trial: isFreeTrial,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as License;
  }

  const { data, error } = await supabase
    .from('licenses')
    .insert({
      user_id: userId,
      days,
      is_free_trial: isFreeTrial,
      expires_at: expiresAt,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data as License;
}

export async function isFreeTrialLicense(userId: string): Promise<boolean> {
  const license = await getLicense(userId);
  return license?.is_free_trial === true;
}

export async function renewLicense(userId: string, days: number): Promise<License> {
  return createLicense(userId, days);
}

export async function getLicense(userId: string): Promise<License | null> {
  const { data } = await supabase
    .from('licenses')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data as License | null;
}

export async function deleteLicense(userId: string): Promise<void> {
  await supabase.from('licenses').delete().eq('user_id', userId);
}

export async function daysRemaining(userId: string): Promise<number> {
  const license = await getLicense(userId);
  return daysRemainingFromLicense(license);
}

export function daysRemainingFromLicense(license: License | null): number {
  if (!license) return 0;
  const today = new Date(todayISO());
  const expiry = new Date(license.expires_at);
  const diff = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  return diff;
}

export async function isExpired(userId: string): Promise<boolean> {
  const remaining = await daysRemaining(userId);
  return remaining <= 0;
}

export type LicenseStatus = 'active' | 'expired' | 'none';

export interface LicenseStatusInfo {
  status: LicenseStatus;
  remaining: number;
  expiresAtBR: string | null;
  isFreeTrial: boolean;
}

export async function getLicenseStatus(userId: string): Promise<LicenseStatusInfo> {
  const license = await getLicense(userId);
  if (!license) {
    return { status: 'none', remaining: 0, expiresAtBR: null, isFreeTrial: false };
  }
  const remaining = await daysRemaining(userId);
  return {
    status: remaining <= 0 ? 'expired' : 'active',
    remaining,
    expiresAtBR: formatDateBR(license.expires_at),
    isFreeTrial: license.is_free_trial === true,
  };
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/* ---------- User warning (once per day, <=5 days) ---------- */

function loadUserWarn(): Record<string, string> {
  try {
    const raw = localStorage.getItem(USER_WARN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveUserWarn(data: Record<string, string>): void {
  localStorage.setItem(USER_WARN_KEY, JSON.stringify(data));
}

export async function consumeUserWarning(userId: string): Promise<string | null> {
  const remaining = await daysRemaining(userId);
  if (remaining > 5 || remaining <= 0) return null;

  const data = loadUserWarn();
  const today = todayISO();
  if (data[userId] === today) return null;

  data[userId] = today;
  saveUserWarn(data);

  const dayWord = remaining === 1 ? 'dia' : 'dias';
  return `Restam ${remaining} ${dayWord} para expirar o seu plano.`;
}

/* ---------- Admin warning (once per expiry) ---------- */

function loadAdminWarn(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ADMIN_WARN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveAdminWarn(data: Record<string, string>): void {
  localStorage.setItem(ADMIN_WARN_KEY, JSON.stringify(data));
}

export async function consumeAdminExpiredWarning(
  users: Array<{ id: string; name: string; email: string }>
): Promise<string[]> {
  const data = loadAdminWarn();
  const today = todayISO();
  const expired: string[] = [];

  for (const user of users) {
    const license = await getLicense(user.id);
    if (!license) continue;
    const remaining = await daysRemaining(user.id);
    if (remaining > 0) continue;

    if (data[user.id] === license.expires_at) continue;

    expired.push(user.name);
    data[user.id] = license.expires_at;
  }

  if (expired.length > 0) {
    saveAdminWarn(data);
  }

  return expired;
}

/* ---------- Expired license warning (once per session/day) ---------- */

function loadExpiredWarn(): Record<string, string> {
  try {
    const raw = localStorage.getItem(EXPIRED_WARN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveExpiredWarn(data: Record<string, string>): void {
  localStorage.setItem(EXPIRED_WARN_KEY, JSON.stringify(data));
}

export async function shouldShowExpiredWarning(userId: string): Promise<boolean> {
  const license = await getLicense(userId);
  if (!license || (await daysRemaining(userId)) > 0) return false;

  const data = loadExpiredWarn();
  if (data[userId] === license.expires_at) return false;

  return true;
}

export async function markExpiredWarningShown(userId: string): Promise<void> {
  const license = await getLicense(userId);
  if (!license) return;

  const data = loadExpiredWarn();
  data[userId] = license.expires_at;
  saveExpiredWarn(data);
}

// Synchronous versions for backwards compatibility (will be removed)
export function daysRemainingSync(_userId: string): number {
  console.warn('daysRemainingSync is deprecated, use daysRemaining');
  return 0;
}

export function shouldShowExpiredWarningSync(_userId: string): boolean {
  console.warn('shouldShowExpiredWarningSync is deprecated, use shouldShowExpiredWarning');
  return false;
}
