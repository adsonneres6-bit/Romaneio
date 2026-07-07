import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { supabase } from '../lib/supabase';

/**
 * Controle de período de teste por fingerprint do dispositivo.
 *
 * A validação é feita no backend através de Edge Functions para garantir
 * que um dispositivo não possa utilizar múltiplos períodos de teste.
 */

let cachedFingerprint: string | null = null;
let fingerprintPromise: Promise<string> | null = null;

/** Gera (e cacheia) o visitorId do navegador via FingerprintJS. */
export async function getFingerprint(): Promise<string> {
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

export interface TrialEligibility {
  /** true se este dispositivo ainda não usou o período de teste */
  eligible: boolean;
  fingerprint: string;
  /** true se o trial já foi usado neste dispositivo */
  trialUsed: boolean;
  /** Data de expiração do trial (se foi usado) */
  trialExpiresAt: string | null;
  /** true se o trial está expirado */
  isExpired?: boolean;
  /** true se é um dispositivo novo (sem registro) */
  isNewDevice?: boolean;
}

/**
 * Verifica no backend se o dispositivo atual ainda tem direito ao período de teste gratuito.
 */
export async function checkTrialEligibility(userId?: string): Promise<TrialEligibility> {
  const fingerprint = await getFingerprint();

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/check-fingerprint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ fingerprint, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to check fingerprint');
    }

    const data = await response.json();
    return {
      eligible: data.eligible,
      fingerprint,
      trialUsed: data.trialUsed,
      trialExpiresAt: data.trialExpiresAt,
      isExpired: data.isExpired,
      isNewDevice: data.isNewDevice,
    };
  } catch (error) {
    console.error('Error checking trial eligibility:', error);
    // Em caso de erro, assume que não é elegível por segurança
    return {
      eligible: false,
      fingerprint,
      trialUsed: true,
      trialExpiresAt: null,
      isExpired: true,
    };
  }
}

/**
 * Marca o período de teste como utilizado no backend.
 */
export async function markTrialUsedBackend(userId: string): Promise<{ success: boolean; trialExpiresAt?: string }> {
  const fingerprint = await getFingerprint();

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/mark-trial-used-fp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ fingerprint, userId }),
    });

    if (!response.ok) {
      throw new Error('Failed to mark trial as used');
    }

    const data = await response.json();
    return { success: true, trialExpiresAt: data.trialExpiresAt };
  } catch (error) {
    console.error('Error marking trial as used:', error);
    return { success: false };
  }
}

/**
 * Limpa o cache do fingerprint (usado principalmente para testes).
 */
export function clearFingerprintCache(): void {
  cachedFingerprint = null;
  fingerprintPromise = null;
}
