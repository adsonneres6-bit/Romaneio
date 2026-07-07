import { supabase } from '../lib/supabase';

export interface ReferralCodeData {
  code: string;
  createdAt: string;
}

export interface ReferralInfo {
  referralCode: string | null;
  referredBy: string | null;
  referredByCode: string | null;
  totalReferred: number;
  totalBonusDays: number;
}

export interface ReferralBonusRecord {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  daysGranted: number;
  reason: string;
  triggerType: string;
  status: string;
  createdAt: string;
}

export async function getMyReferralCode(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return data?.code ?? null;
}

export async function validateReferralCode(code: string): Promise<{ valid: boolean; error?: string }> {
  if (!code || code.trim().length === 0) {
    return { valid: false };
  }

  try {
    const { data, error } = await supabase.rpc('validate_referral_code', {
      input_code: code.trim(),
    });

    if (error) {
      console.error('Error validating referral code:', error);
      return { valid: false, error: 'Erro ao validar código. Tente novamente.' };
    }

    if (data === true) {
      return { valid: true };
    }

    return { valid: false };
  } catch (err) {
    console.error('Exception validating referral code:', err);
    return { valid: false, error: 'Erro de conexão. Tente novamente.' };
  }
}

export async function getMyReferralInfo(): Promise<ReferralInfo> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    return { referralCode: null, referredBy: null, referredByCode: null, totalReferred: 0, totalBonusDays: 0 };
  }

  const userId = session.user.id;

  const [codeResult, referralResult, referredCountResult, bonusResult] = await Promise.all([
    supabase.from('referral_codes').select('code').eq('user_id', userId).maybeSingle(),
    supabase
      .from('referrals')
      .select('referred_by_user_id, referral_code')
      .eq('referred_user_id', userId)
      .maybeSingle(),
    supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referred_by_user_id', userId),
    supabase
      .from('referral_bonuses')
      .select('days_granted')
      .eq('referrer_user_id', userId),
  ]);

  const totalBonusDays = bonusResult.data?.reduce((sum, b) => sum + (b.days_granted || 0), 0) ?? 0;

  let referredByName: string | null = null;
  if (referralResult.data?.referred_by_user_id) {
    const { data: referrerProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', referralResult.data.referred_by_user_id)
      .maybeSingle();
    referredByName = referrerProfile?.name ?? null;
  }

  return {
    referralCode: codeResult.data?.code ?? null,
    referredBy: referredByName,
    referredByCode: referralResult.data?.referral_code ?? null,
    totalReferred: referredCountResult.count ?? 0,
    totalBonusDays,
  };
}

export async function getMyReferralBonuses(): Promise<ReferralBonusRecord[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('referral_bonuses')
    .select('*')
    .eq('referrer_user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((b) => ({
    id: b.id,
    referrerUserId: b.referrer_user_id,
    referredUserId: b.referred_user_id,
    daysGranted: b.days_granted,
    reason: b.reason,
    triggerType: b.trigger_type,
    status: b.status,
    createdAt: b.created_at,
  }));
}

export interface AdminReferralData {
  userId: string;
  userName: string;
  referralCode: string | null;
  referredByName: string | null;
  totalReferred: number;
  totalBonusDays: number;
}

export async function triggerFirstPurchaseBonus(userId: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  try {
    await fetch(`${supabaseUrl}/functions/v1/process-referral-bonus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        referredUserId: userId,
        trigger: 'first_purchase',
      }),
    });
  } catch {
    // Non-blocking — referral bonus is best-effort
  }
}

export async function getAllUsersReferralData(): Promise<AdminReferralData[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, referral_code')
    .order('created_at', { ascending: false });

  if (!profiles) return [];

  const userIds = profiles.map((p) => p.id);

  const [referralsResult, bonusesResult, codesResult] = await Promise.all([
    supabase.from('referrals').select('referred_user_id, referred_by_user_id'),
    supabase.from('referral_bonuses').select('referrer_user_id, days_granted'),
    supabase.from('referral_codes').select('user_id, code'),
  ]);

  const referralByUser = new Map<string, string>();
  for (const r of referralsResult.data ?? []) {
    referralByUser.set(r.referred_user_id, r.referred_by_user_id);
  }

  const referredCountByUser = new Map<string, number>();
  for (const r of referralsResult.data ?? []) {
    referredCountByUser.set(r.referred_by_user_id, (referredCountByUser.get(r.referred_by_user_id) ?? 0) + 1);
  }

  const bonusDaysByUser = new Map<string, number>();
  for (const b of bonusesResult.data ?? []) {
    bonusDaysByUser.set(b.referrer_user_id, (bonusDaysByUser.get(b.referrer_user_id) ?? 0) + (b.days_granted || 0));
  }

  const codeByUser = new Map<string, string>();
  for (const c of codesResult.data ?? []) {
    codeByUser.set(c.user_id, c.code);
  }

  const referrerNames = new Map<string, string>();
  const referrerIds = new Set(referralByUser.values());
  if (referrerIds.size > 0) {
    const { data: referrerProfiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', Array.from(referrerIds));
    for (const p of referrerProfiles ?? []) {
      referrerNames.set(p.id, p.name);
    }
  }

  return profiles.map((p) => ({
    userId: p.id,
    userName: p.name,
    referralCode: codeByUser.get(p.id) ?? p.referral_code ?? null,
    referredByName: referralByUser.has(p.id) ? (referrerNames.get(referralByUser.get(p.id)!) ?? null) : null,
    totalReferred: referredCountByUser.get(p.id) ?? 0,
    totalBonusDays: bonusDaysByUser.get(p.id) ?? 0,
  }));
}
