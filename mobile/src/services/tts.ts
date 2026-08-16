import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { enableAudioDuckFocus } from './audio';

export async function speakPrompt(
  text: string,
  onDone?: () => void,
  onStart?: () => void
): Promise<void> {
  try {
    await enableAudioDuckFocus();
    console.log('[TTS] Speaking prompt:', text);

    // --- WEB BROWSER IMPLEMENTATION ---
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-AU';
      utterance.pitch = 1.0;
      utterance.rate = 0.95;

      let hasFinished = false;
      const finish = () => {
        if (!hasFinished) {
          hasFinished = true;
          console.log('[TTS Web] Finished speaking:', text);
          if (onDone) onDone();
        }
      };

      utterance.onstart = () => {
        console.log('[TTS Web] Started speaking:', text);
        if (onStart) onStart();
      };

      utterance.onend = finish;
      utterance.onerror = (e) => {
        console.warn('[TTS Web] Speech error or canceled, continuing:', e);
        finish();
      };

      // Watchdog timer in case the browser cancels/drops the onend callback
      const estimatedMs = Math.max(1800, (text.split(' ').length / 2.2) * 1000 + 1000);
      setTimeout(finish, estimatedMs);

      window.speechSynthesis.speak(utterance);
      return;
    }

    // --- NATIVE EXPO IMPLEMENTATION ---
    await Speech.stop();

    Speech.speak(text, {
      language: 'en-AU',
      pitch: 1.0,
      rate: 0.95,
      onStart: () => {
        console.log('[TTS Native] Started speaking:', text);
        if (onStart) onStart();
      },
      onDone: () => {
        console.log('[TTS Native] Finished speaking:', text);
        if (onDone) onDone();
      },
      onError: (error) => {
        console.error('[TTS Native] Speech error:', error);
        if (onDone) onDone();
      },
    });
  } catch (error) {
    console.error('[TTS] Failed to speak:', error);
    if (onDone) onDone();
  }
}

export async function stopSpeech(): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      return;
    }
    await Speech.stop();
  } catch (error) {
    console.error('[TTS] Error stopping speech:', error);
  }
}

export async function isSpeakingAsync(): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      return window.speechSynthesis.speaking;
    }
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
