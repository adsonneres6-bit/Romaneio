let voicesLoaded = false;
let cachedVoice: SpeechSynthesisVoice | null = null;

function loadVoices(): void {
  if (voicesLoaded) return;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  if (voices.length === 0) return;
  voicesLoaded = true;

  const ptVoices = voices.filter((v) => v.lang.startsWith('pt'));
  if (ptVoices.length === 0) {
    cachedVoice = voices[0] ?? null;
    return;
  }

  const femaleNames = ['Luciana', 'Maria', 'Vitória', 'Vitoria', 'Helena', 'Felipe', 'pt-BR'];
  cachedVoice = ptVoices.find((v) => femaleNames.some((n) => v.name.includes(n))) ?? ptVoices[0];
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speakSequence(sequence: string, isMultiOrder: boolean): void {
  if (!window.speechSynthesis) return;
  loadVoices();

  let text = sequence;
  if (isMultiOrder) {
    text = `${sequence}+`;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  if (cachedVoice) utterance.voice = cachedVoice;
  utterance.rate = 0.85;
  utterance.pitch = 1.15;
  utterance.volume = 0.7;

  window.speechSynthesis.speak(utterance);
}
