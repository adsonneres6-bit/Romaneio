import { supabase } from '../lib/supabase';

export type TutorialType = 'flex' | 'interface' | 'frota';

export interface TutorialCompletion {
  id: string;
  userId: string;
  tutorialType: TutorialType;
  completedAt: string;
}

/**
 * Mark a tutorial as completed for a user
 */
export async function completeTutorial(
  userId: string,
  tutorialType: TutorialType
): Promise<boolean> {
  const { error } = await supabase
    .from('user_tutorial_completions')
    .upsert({
      user_id: userId,
      tutorial_type: tutorialType,
    });

  if (error) {
    console.error('Error completing tutorial:', error);
    return false;
  }

  return true;
}

/**
 * Check if a user has completed a specific tutorial
 */
export async function hasCompletedTutorial(
  userId: string,
  tutorialType: TutorialType
): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_tutorial_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('tutorial_type', tutorialType)
    .maybeSingle();

  if (error) {
    console.error('Error checking tutorial completion:', error);
    return false;
  }

  return !!data;
}

/**
 * Get all completed tutorials for a user
 */
export async function getCompletedTutorials(
  userId: string
): Promise<TutorialType[]> {
  const { data, error } = await supabase
    .from('user_tutorial_completions')
    .select('tutorial_type')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching completed tutorials:', error);
    return [];
  }

  return (data || []).map(d => d.tutorial_type as TutorialType);
}

/**
 * Check if the mandatory Flex tutorial has been completed
 */
export async function hasCompletedFlexTutorial(
  userId: string
): Promise<boolean> {
  return hasCompletedTutorial(userId, 'flex');
}
