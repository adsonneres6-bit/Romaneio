import { supabase } from '../lib/supabase';

export interface Payment {
  id: string;
  user_id: string;
  amount: number | null;
  status: string;
  transaction_id: string | null;
  payment_method: string | null;
  created_at: string;
}

export interface PaymentData {
  pixCode: string;
  updatedAt: number;
}

export async function getPayments(): Promise<Payment[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    amount: p.amount,
    status: p.status,
    transaction_id: p.transaction_id,
    payment_method: p.payment_method,
    created_at: p.created_at,
  }));
}

export async function createPayment(
  amount: number,
  paymentMethod: string = 'pix'
): Promise<Payment | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: session.user.id,
      amount,
      status: 'pending',
      payment_method: paymentMethod,
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    user_id: data.user_id,
    amount: data.amount,
    status: data.status,
    transaction_id: data.transaction_id,
    payment_method: data.payment_method,
    created_at: data.created_at,
  };
}

export async function updatePaymentStatus(
  paymentId: string,
  status: string,
  transactionId?: string
): Promise<void> {
  const update: { status: string; transaction_id?: string } = { status };
  if (transactionId) update.transaction_id = transactionId;

  const { error } = await supabase
    .from('payments')
    .update(update)
    .eq('id', paymentId);

  if (error) throw error;
}

export async function getAllPaymentsAdmin(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    user_id: p.user_id,
    amount: p.amount,
    status: p.status,
    transaction_id: p.transaction_id,
    payment_method: p.payment_method,
    created_at: p.created_at,
  }));
}

// Local storage payment data (for Pix code caching)
const PAYMENT_KEY = 'checklist_payment';

export function getPaymentData(): PaymentData | null {
  try {
    const raw = localStorage.getItem(PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      pixCode: parsed.pixCode ?? '',
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function savePaymentData(pixCode: string): PaymentData {
  const data: PaymentData = {
    pixCode,
    updatedAt: Date.now(),
  };
  localStorage.setItem(PAYMENT_KEY, JSON.stringify(data));
  return data;
}

export function clearPaymentData(): void {
  localStorage.removeItem(PAYMENT_KEY);
}
