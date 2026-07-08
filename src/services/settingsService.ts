import { supabase } from '../lib/supabase';

export interface AppSettings {
  id?: string;
  showLicenseToUsers: boolean;
  tutorialUrl: string;
  tutorialInterfaceUrl: string;
  tutorialFlexUrl: string;
  tutorialFrotaUrl: string;
  apkCircuitUrl: string;
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

const DEFAULT_APK_URL = 'https://github.com/adsonneres6-bit/adsonteste_download/releases/latest/download/Circuit.apk';

const DEFAULT_SETTINGS: AppSettings = {
  showLicenseToUsers: true,
  tutorialUrl: '',
  tutorialInterfaceUrl: '',
  tutorialFlexUrl: '',
  tutorialFrotaUrl: '',
  apkCircuitUrl: DEFAULT_APK_URL,
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
    tutorialInterfaceUrl: data.tutorial_interface_url ?? '',
    tutorialFlexUrl: data.tutorial_flex_url ?? '',
    tutorialFrotaUrl: data.tutorial_frota_url ?? '',
    apkCircuitUrl: data.apk_circuit_url ?? DEFAULT_APK_URL,
    maxDevicesPerUser: data.max_devices_per_user ?? 2,
    trialDays: data.trial_days ?? 30,
    referralBonusDays: data.referral_bonus_days ?? 7,
    referralRequirePayment: data.referral_require_payment ?? false,
  };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<{ success: boolean; error?: string }> {
  const current = await getSettings();
  const next = { ...current, ...settings };

  const upsertData: Record<string, unknown> = {
    show_license_to_users: next.showLicenseToUsers,
    tutorial_url: next.tutorialUrl,
    tutorial_interface_url: next.tutorialInterfaceUrl,
    tutorial_flex_url: next.tutorialFlexUrl,
    tutorial_frota_url: next.tutorialFrotaUrl,
    apk_circuit_url: next.apkCircuitUrl,
    max_devices_per_user: next.maxDevicesPerUser,
    trial_days: next.trialDays,
    referral_bonus_days: next.referralBonusDays,
    referral_require_payment: next.referralRequirePayment,
  };

  // Only include id if we have one
  if (current.id) {
    upsertData.id = current.id;
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert(upsertData, { onConflict: 'id' });

  if (error) {
    console.error('Failed to save settings:', error);
    return { success: false, error: error.message };
  }

  window.dispatchEvent(new CustomEvent('settings-changed'));
  return { success: true };
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

// Tutorial Interface URL
export async function getTutorialInterfaceUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.tutorialInterfaceUrl;
}

export async function setTutorialInterfaceUrl(value: string): Promise<{ success: boolean; error?: string }> {
  const result = await saveSettings({ tutorialInterfaceUrl: value });
  return result;
}

// Tutorial Flex URL
export async function getTutorialFlexUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.tutorialFlexUrl;
}

export async function setTutorialFlexUrl(value: string): Promise<{ success: boolean; error?: string }> {
  const result = await saveSettings({ tutorialFlexUrl: value });
  return result;
}

// Tutorial Frota URL
export async function getTutorialFrotaUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.tutorialFrotaUrl;
}

export async function setTutorialFrotaUrl(value: string): Promise<{ success: boolean; error?: string }> {
  const result = await saveSettings({ tutorialFrotaUrl: value });
  return result;
}

// APK Circuit URL
export async function getApkCircuitUrl(): Promise<string> {
  const settings = await getSettings();
  return settings.apkCircuitUrl;
}

export async function setApkCircuitUrl(value: string): Promise<void> {
  await saveSettings({ apkCircuitUrl: value });
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

/**
 * Extract YouTube video ID from various URL formats
 * Supports: watch, shorts, youtu.be, embed, live URLs
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const trimmed = url.trim();

  // youtube.com/shorts/VIDEO_ID
  const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/);
  if (shortsMatch) return shortsMatch[1];

  // youtu.be/VIDEO_ID
  const shortMatch = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (shortMatch) return shortMatch[1];

  // youtube.com/watch?v=VIDEO_ID
  const watchMatch = trimmed.match(/youtube\.com\/watch\?[^\s]*[&?]v=([A-Za-z0-9_-]{6,})/);
  if (watchMatch) return watchMatch[1];

  // youtube.com/embed/VIDEO_ID
  const embedMatch = trimmed.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  if (embedMatch) return embedMatch[1];

  // youtube.com/live/VIDEO_ID
  const liveMatch = trimmed.match(/youtube\.com\/live\/([A-Za-z0-9_-]{6,})/);
  if (liveMatch) return liveMatch[1];

  return null;
}

/**
 * Check if a URL is a valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (!url) return false;

  const videoId = extractYouTubeVideoId(url);
  if (videoId) return true;

  // Check if it's a YouTube domain at all
  const trimmed = url.trim();
  return /youtube\.com|youtu\.be/.test(trimmed);
}

/**
 * Convert any YouTube URL to embed URL format
 */
export function toEmbedUrl(url: string): string {
  if (!url) return '';

  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  // Return original URL if we couldn't extract video ID
  return url.trim();
}

/**
 * Validate a YouTube URL and return video ID or error message
 */
export function validateYouTubeUrl(url: string): { valid: boolean; videoId?: string; error?: string } {
  if (!url || !url.trim()) {
    return { valid: false, error: 'URL não informada.' };
  }

  const videoId = extractYouTubeVideoId(url);

  if (videoId) {
    return { valid: true, videoId };
  }

  // Check if it looks like a YouTube URL but we couldn't parse it
  if (/youtube\.com|youtu\.be/.test(url)) {
    return { valid: false, error: 'Formato de URL do YouTube não reconhecido. Use o link completo do vídeo.' };
  }

  return { valid: false, error: 'A URL informada não corresponde a um vídeo válido do YouTube.' };
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
