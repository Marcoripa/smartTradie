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
    
    // Stop any ongoing speech
    await Speech.stop();

    Speech.speak(text, {
      language: 'en-AU',
      pitch: 1.0,
      rate: 0.95, // Slightly lower rate for clear driving comprehension
      onStart: () => {
        console.log('[TTS] Started speaking:', text);
        if (onStart) onStart();
      },
      onDone: () => {
        console.log('[TTS] Finished speaking:', text);
        if (onDone) onDone();
      },
      onError: (error) => {
        console.error('[TTS] Error during speech:', error);
        if (onDone) onDone(); // Proceed even if TTS fails
      },
    });
  } catch (error) {
    console.error('[TTS] Failed to execute speakPrompt:', error);
    if (onDone) onDone();
  }
}

export async function stopSpeech(): Promise<void> {
  try {
    await Speech.stop();
  } catch (error) {
    console.error('[TTS] Error stopping speech:', error);
  }
}

export async function isSpeakingAsync(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch {
    return false;
  }
}
