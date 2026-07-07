import { supabase } from '../lib/supabase';

export interface AppSettings {
  id?: string;
  showLicenseToUsers: boolean;
  tutorialUrl: string;
  maxDevicesPerUser: number;
  trialDays: number;
  referralBonusDays: number;
  referralRequirePayment: boolean;
}

export interface PixSettings {
  pixKey: string;
  receiverName: string;
  city: string;
  message: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  showLicenseToUsers: true,
  tutorialUrl: '',
  maxDevicesPerUser: 2,
  trialDays: 30,
  referralBonusDays: 7,
  referralRequirePayment: false,
};

const DEFAULT_PIX_SETTINGS: PixSettings = {
  pixKey: '',
  receiverName: '',
  city: '',
  message: '',
};

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;

  return {
    id: data.id,
    showLicenseToUsers: data.show_license_to_users ?? true,
    tutorialUrl: data.tutorial_url ?? '',
    maxDevicesPerUser: data.max_devices_per_user ?? 2,
    trialDays: data.trial_days ?? 30,
    referralBonusDays: data.referral_bonus_days ?? 7,
    referralRequirePayment: data.referral_require_payment ?? false,
  };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const next = { ...current, ...settings };

  const { error } = await supabase
    .from('app_settings')
    .upsert({
      id: current.id ?? undefined,
      show_license_to_users: next.showLicenseToUsers,
      tutorial_url: next.tutorialUrl,
      max_devices_per_user: next.maxDevicesPerUser,
      trial_days: next.trialDays,
      referral_bonus_days: next.referralBonusDays,
      referral_require_payment: next.referralRequirePayment,
    });

  if (error) {
    console.error('Failed to save settings:', error.message, error.details, error.hint);
  }

  window.dispatchEvent(new CustomEvent('settings-changed'));
}

export async function getShowLicenseToUsers(): Promise<boolean> {
  const settings = await getSettings();
  return settings.showLicenseToUsers;
}

export async function setShowLicenseToUsers(value: boolean): Promise<void> {
  await saveSettings({ showLicenseToUsers: value });
}

export async function getTutorialUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.tutorialUrl;
}

export async function setTutorialUrl(value: string): Promise<void> {
  await saveSettings({ tutorialUrl: value });
}

export async function getMaxDevicesPerUser(): Promise<number> {
  const settings = await getSettings();
  return settings.maxDevicesPerUser;
}

export async function setMaxDevicesPerUser(value: number): Promise<void> {
  await saveSettings({ maxDevicesPerUser: value });
}

export async function getTrialDays(): Promise<number> {
  const settings = await getSettings();
  return settings.trialDays;
}

export async function setTrialDays(value: number): Promise<void> {
  await saveSettings({ trialDays: value });
}

export async function getReferralBonusDays(): Promise<number> {
  const settings = await getSettings();
  return settings.referralBonusDays;
}

export async function setReferralBonusDays(value: number): Promise<void> {
  await saveSettings({ referralBonusDays: value });
}

export async function getReferralRequirePayment(): Promise<boolean> {
  const settings = await getSettings();
  return settings.referralRequirePayment;
}

export async function setReferralRequirePayment(value: boolean): Promise<void> {
  await saveSettings({ referralRequirePayment: value });
}

export function toEmbedUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();

  // youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (shortMatch) {
    return `https://www.youtube.com/embed/${shortMatch[1]}`;
  }

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (watchMatch) {
    return `https://www.youtube.com/embed/${watchMatch[1]}`;
  }

  // youtube.com/embed/VIDEO_ID (already embed)
  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed;
  }

  return trimmed;
}

export async function getPixSettings(): Promise<PixSettings> {
  const { data, error } = await supabase
    .from('pix_settings')
    .select('*')
    .maybeSingle();

  if (error || !data) return DEFAULT_PIX_SETTINGS;

  return {
    pixKey: data.pix_key ?? '',
    receiverName: data.receiver_name ?? '',
    city: data.city ?? '',
    message: data.message ?? '',
  };
}

export async function savePixSettings(settings: Partial<PixSettings>): Promise<void> {
  const current = await getPixSettings();
  const next = { ...current, ...settings };

  const { error } = await supabase.from('pix_settings').update({
    pix_key: next.pixKey,
    receiver_name: next.receiverName,
    city: next.city,
    message: next.message,
  }).eq('id', 1);

  if (error) {
    await supabase.from('pix_settings').insert({
      pix_key: next.pixKey,
      receiver_name: next.receiverName,
      city: next.city,
      message: next.message,
    });
  }
}

// Synchronous versions for backwards compatibility during migration
let cachedSettings: AppSettings | null = null;

export function getSettingsSync(): AppSettings {
  if (cachedSettings) return cachedSettings;
  getSettings().then((s) => {
    cachedSettings = s;
  });
  return DEFAULT_SETTINGS;
}

export function getShowLicenseToUsersSync(): boolean {
  return getSettingsSync().showLicenseToUsers;
}
