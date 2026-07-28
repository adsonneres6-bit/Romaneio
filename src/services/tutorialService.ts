const COMPLETED_KEY = 'circuit_completed_tutorials';

export type TutorialType = 'flex' | 'interface' | 'frota';

function getCompletedSet(): Set<string> {
  try {
    const stored = localStorage.getItem(COMPLETED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {
    // Ignore
  }
  return new Set();
}

function saveCompletedSet(set: Set<string>): void {
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify([...set]));
  } catch {
    // Ignore
  }
}

export async function completeTutorial(
  _userId: string,
  tutorialType: TutorialType
): Promise<boolean> {
  const set = getCompletedSet();
  set.add(tutorialType);
  saveCompletedSet(set);
  return true;
}

export async function hasCompletedTutorial(
  _userId: string,
  tutorialType: TutorialType
): Promise<boolean> {
  return getCompletedSet().has(tutorialType);
}

export async function getCompletedTutorials(_userId: string): Promise<TutorialType[]> {
  return [...getCompletedSet()] as TutorialType[];
}

export async function hasCompletedFlexTutorial(userId: string): Promise<boolean> {
  return hasCompletedTutorial(userId, 'flex');
}
