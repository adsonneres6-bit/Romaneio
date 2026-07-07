import { getFingerprint } from './trialControlService';

export interface LicenseValidationResult {
  valid: boolean;
  reason?: string;
  message?: string;
}

/**
 * Valida se o usuário pode realizar importação de arquivos.
 * Esta validação é feita no backend para garantir segurança.
 */
export async function validateLicenseForImport(userId: string): Promise<LicenseValidationResult> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Get fingerprint if available
    let fingerprint: string | undefined;
    try {
      fingerprint = await getFingerprint();
    } catch {
      // Fingerprint not available, continue without it
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/validate-license-for-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ userId, fingerprint }),
    });

    if (!response.ok) {
      return { valid: false, reason: 'validation_failed', message: 'Erro ao validar licença.' };
    }

    const data = await response.json();
    return {
      valid: data.valid,
      reason: data.reason,
      message: data.message,
    };
  } catch (error) {
    console.error('Error validating license for import:', error);
    return { valid: false, reason: 'validation_error', message: 'Erro ao validar licença.' };
  }
}
