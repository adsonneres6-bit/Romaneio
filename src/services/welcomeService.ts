import { supabase } from '../lib/supabase';

/**
 * Check if user has seen the welcome modal
 */
export async function hasSeenWelcomeModal(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('welcome_modal_shown')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking welcome modal status:', error);
    return false;
  }

  return data?.welcome_modal_shown ?? false;
}

/**
 * Mark that user has seen the welcome modal
 */
export async function markWelcomeModalSeen(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ welcome_modal_shown: true })
    .eq('id', userId);

  if (error) {
    console.error('Error marking welcome modal as seen:', error);
    return false;
  }

  return true;
}

/**
 * Check if user has seen the info modal
 */
export async function hasSeenInfoModal(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('info_modal_shown')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking info modal status:', error);
    return false;
  }

  return data?.info_modal_shown ?? false;
}

/**
 * Mark that user has seen the info modal
 */
export async function markInfoModalSeen(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ info_modal_shown: true })
    .eq('id', userId);

  if (error) {
    console.error('Error marking info modal as seen:', error);
    return false;
  }

  return true;
}
