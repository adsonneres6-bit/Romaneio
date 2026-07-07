import FingerprintJS from '@fingerprintjs/fingerprintjs';

export interface DeviceInfo {
  deviceId: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
  language: string;
  screenResolution: string;
  timezone: string;
}

export interface DeviceRecord {
  id: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  deviceId: string;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  language: string | null;
  screenResolution: string | null;
  timezone: string | null;
  firstAccessAt: string;
  lastAccessAt: string;
  isActive: boolean;
}

export interface DeviceValidationResult {
  valid: boolean;
  isNewDevice: boolean;
  deviceId: string;
  device?: DeviceRecord;
  activeDevicesCount: number;
  maxDevices: number;
  error?: string;
}

let cachedFingerprint: string | null = null;
let fingerprintPromise: Promise<string> | null = null;

export function getDeviceId(): Promise<string> {
  return getFingerprint();
}

async function getFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;
  if (fingerprintPromise) return fingerprintPromise;

  fingerprintPromise = (async () => {
    const fp = await FingerprintJS.load();
    const { visitorId } = await fp.get();
    cachedFingerprint = visitorId;
    return visitorId;
  })();

  return fingerprintPromise;
}

function getBrowserInfo(): { browser: string; browserVersion: string } {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let browserVersion = '';

  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+\.?\d*)/)?.[1] || '';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg\/(\d+\.?\d*)/)?.[1] || '';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+\.?\d*)/)?.[1] || '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+\.?\d*)/)?.[1] || '';
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    browser = 'Opera';
    browserVersion = ua.match(/(?:Opera|OPR)\/(\d+\.?\d*)/)?.[1] || '';
  }

  return { browser, browserVersion };
}

function getOSInfo(): { os: string; osVersion: string } {
  const ua = navigator.userAgent;
  let os = 'Unknown';
  let osVersion = '';

  if (ua.includes('Windows NT 10.0')) {
    os = 'Windows';
    osVersion = '10/11';
  } else if (ua.includes('Windows NT 6.3')) {
    os = 'Windows';
    osVersion = '8.1';
  } else if (ua.includes('Windows NT 6.2')) {
    os = 'Windows';
    osVersion = '8';
  } else if (ua.includes('Windows NT 6.1')) {
    os = 'Windows';
    osVersion = '7';
  } else if (ua.includes('Mac OS X')) {
    os = 'macOS';
    osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('Android')) {
    os = 'Android';
    osVersion = ua.match(/Android (\d+\.?\d*)/)?.[1] || '';
  } else if (ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
    osVersion = ua.match(/OS (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  return { os, osVersion };
}

export function collectDeviceInfo(): Promise<DeviceInfo> {
  return getFingerprint().then((deviceId) => {
    const { os, osVersion } = getOSInfo();
    const { browser, browserVersion } = getBrowserInfo();

    return {
      deviceId,
      os,
      osVersion,
      browser,
      browserVersion,
      language: navigator.language || navigator.languages?.[0] || '',
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  });
}

export function clearDeviceIdCache(): void {
  cachedFingerprint = null;
  fingerprintPromise = null;
}

export async function validateDevice(userId: string): Promise<DeviceValidationResult> {
  const deviceInfo = await collectDeviceInfo();

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/validate-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ userId, deviceInfo }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        valid: false,
        isNewDevice: true,
        deviceId: deviceInfo.deviceId,
        activeDevicesCount: 0,
        maxDevices: 2,
        error: errorData.error || 'Falha ao validar dispositivo',
      };
    }

    const data = await response.json();
    return {
      valid: data.valid,
      isNewDevice: data.isNewDevice,
      deviceId: deviceInfo.deviceId,
      device: data.device,
      activeDevicesCount: data.activeDevicesCount,
      maxDevices: data.maxDevices,
    };
  } catch (error) {
    console.error('Error validating device:', error);
    return {
      valid: false,
      isNewDevice: true,
      deviceId: deviceInfo.deviceId,
      activeDevicesCount: 0,
      maxDevices: 2,
      error: 'Erro ao validar dispositivo',
    };
  }
}

export async function getUserDevices(userId: string): Promise<DeviceRecord[]> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/get-user-devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.devices || [];
  } catch (error) {
    console.error('Error getting user devices:', error);
    return [];
  }
}

export async function getAllDevices(): Promise<DeviceRecord[]> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/get-user-devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ getAllUsers: true }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.devices || [];
  } catch (error) {
    console.error('Error getting all devices:', error);
    return [];
  }
}

// Soft deactivate (marks is_active=false, keeps record, device can be reactivated)
export async function deactivateUserDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/remove-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ deviceId, hardDelete: false }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Falha ao desativar dispositivo' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao desativar dispositivo' };
  }
}

// Hard delete — permanently removes the device record
export async function removeUserDevice(deviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/remove-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ deviceId, hardDelete: true }),
    });
    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Falha ao excluir dispositivo' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error deleting device:', error);
    return { success: false, error: 'Erro ao excluir dispositivo' };
  }
}

// Checks whether this specific device is still active in the database.
// Used for periodic session validation to enforce single-device policy.
export async function checkDeviceStatus(userId: string, deviceId: string): Promise<{ isActive: boolean; deviceFound: boolean }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/functions/v1/check-device-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ userId, deviceId }),
    });
    if (!response.ok) return { isActive: true, deviceFound: true };
    const data = await response.json();
    return { isActive: data.isActive, deviceFound: data.deviceFound };
  } catch {
    return { isActive: true, deviceFound: true };
  }
}

export async function disconnectOtherDevices(userId: string, currentDeviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/disconnect-other-devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ userId, currentDeviceId }),
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, error: data.error || 'Falha ao desconectar dispositivos' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting devices:', error);
    return { success: false, error: 'Erro ao desconectar dispositivos' };
  }
}

export async function checkActiveSession(userId: string): Promise<{ hasActiveSession: boolean; deviceId?: string }> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/check-active-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      return { hasActiveSession: false };
    }

    const data = await response.json();
    return { hasActiveSession: data.hasActiveSession, deviceId: data.deviceId };
  } catch (error) {
    console.error('Error checking active session:', error);
    return { hasActiveSession: false };
  }
}

export function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
