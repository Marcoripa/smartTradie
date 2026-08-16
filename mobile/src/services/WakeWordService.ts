import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type WakeWordCallback = (detectedWord: string) => void;

export class WakeWordService {
  private static instance: WakeWordService;
  private isListening = false;
  private isEnabled = true; // Enabled by default for hands-free driving
  private activeWakeWord = 'Hey Mark';
  private aliases: string[] = ['hey mark', 'hi mark', 'ok mark', 'hey tradie'];
  private callback: WakeWordCallback | null = null;

  // Web Speech Recognition stream for Wake Word detection in browser
  private webRecognition: any = null;
  private isRestarting = false;

  private constructor() {
    this.initWebWakeWordEngine();
  }

  public static getInstance(): WakeWordService {
    if (!WakeWordService.instance) {
      WakeWordService.instance = new WakeWordService();
    }
    return WakeWordService.instance;
  }

  private initWebWakeWordEngine(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.webRecognition = new SpeechRecognition();
          this.webRecognition.continuous = true;
          this.webRecognition.interimResults = true;
          this.webRecognition.lang = 'en-AU';

          this.webRecognition.onresult = (event: any) => {
            if (!this.isListening) return;

            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript.toLowerCase().trim();
              console.log('[openWakeWord] Audio stream listening:', transcript);

              const matched = this.aliases.some((alias) => transcript.includes(alias));
              if (matched) {
                console.log(`[openWakeWord] 🎯 WAKE WORD DETECTED: "${this.activeWakeWord}"`);
                this.triggerWakeWord(this.activeWakeWord);
                break;
              }
            }
          };

          this.webRecognition.onerror = (event: any) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
              console.warn('[openWakeWord Web] Recognition notice:', event.error);
            }
          };

          this.webRecognition.onend = () => {
            // Auto-restart continuous keyword spotting if still enabled and in idle
            if (this.isListening && !this.isRestarting) {
              this.isRestarting = true;
              setTimeout(() => {
                try {
                  if (this.isListening) this.webRecognition.start();
                } catch {}
                this.isRestarting = false;
              }, 300);
            }
          };
        } catch (e) {
          console.warn('[openWakeWord Web] Engine init exception:', e);
        }
      }
    }
  }

  /**
   * Set wake word detection callback
   */
  public setOnWakeWordDetected(cb: WakeWordCallback): void {
    this.callback = cb;
  }

  /**
   * Toggle hands-free wake word detection on/off
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`[openWakeWord] Wake word detection ${enabled ? 'ENABLED' : 'DISABLED'}`);
    if (!enabled) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public getActiveWakeWord(): string {
    return this.activeWakeWord;
  }

  /**
   * Start low-power keyword spotting when app is in IDLE state
   */
  public startListening(): void {
    if (!this.isEnabled || this.isListening) return;
    this.isListening = true;
    console.log(`[openWakeWord] 👂 Started listening for wake word: "${this.activeWakeWord}"`);

    if (Platform.OS === 'web' && this.webRecognition) {
      try {
        this.webRecognition.start();
      } catch (e) {
        // Already active
      }
    }
  }

  /**
   * Pause keyword spotting while a recording session or TTS is active
   */
  public stopListening(): void {
    if (!this.isListening) return;
    this.isListening = false;
    console.log('[openWakeWord] Paused wake word listening.');

    if (Platform.OS === 'web' && this.webRecognition) {
      try {
        this.webRecognition.stop();
      } catch (e) {}
    }
  }

  /**
   * Action when wake word is detected
   */
  private async triggerWakeWord(detectedWord: string): Promise<void> {
    this.stopListening();

    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {}

    if (this.callback) {
      this.callback(detectedWord);
    }
  }
}

export const wakeWordService = WakeWordService.getInstance();
