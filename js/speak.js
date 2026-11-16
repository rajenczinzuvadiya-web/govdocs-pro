// ફોનના મફત Text-to-Speech થી ગુજરાતીમાં વાંચીને સંભળાવવું.

let speaking = false;
let onEnd = null;

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function gujaratiVoice() {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('gu')) || null;
}

export function hasGujaratiVoice() {
  return canSpeak() && !!gujaratiVoice();
}

// લાંબું લખાણ Chrome માં વચ્ચે અટકી જાય છે, એટલે વાક્યોમાં તોડીને વાંચવું
function chunks(text) {
  return text
    .split(/(?<=[.!?।\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stop() {
  if (!canSpeak()) return;
  speaking = false;
  window.speechSynthesis.cancel();
  if (onEnd) onEnd();
  onEnd = null;
}

export function isSpeaking() {
  return speaking;
}

/** text વાંચે; done() પૂરું થાય કે બંધ કરાય ત્યારે બોલાવાય */
export function speak(text, done) {
  if (!canSpeak()) return false;
  stop();
  const parts = chunks(text);
  const voice = gujaratiVoice();
  speaking = true;
  onEnd = done || null;
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = 'gu-IN';
    if (voice) u.voice = voice;
    u.rate = 0.9;
    if (i === parts.length - 1) {
      u.onend = () => {
        speaking = false;
        if (onEnd) onEnd();
        onEnd = null;
      };
    }
    window.speechSynthesis.speak(u);
  });
  return true;
}

// કેટલાક ફોનમાં voices મોડા લોડ થાય છે
if (canSpeak()) window.speechSynthesis.getVoices();
