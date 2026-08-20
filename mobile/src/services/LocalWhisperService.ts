import { Platform } from 'react-native';

export class LocalWhisperService {
  private static instance: LocalWhisperService;
  private isLoaded = false;
  private whisperContext: any = null;
  private modelPath = 'assets/models/whisper-tiny.en.bin';
  
  // Isolated per-step speech recognition buffer
  private latestWebTranscript: string | null = null;
  private webRecognitionInstance: any = null;
  private isListening = false;
  private onInterimCallback: ((transcript: string) => void) | null = null;

  private constructor() {
    this.initCleanWebRecognition();
  }

  public setOnInterimTranscript(callback: ((transcript: string) => void) | null): void {
    this.onInterimCallback = callback;
  }

  public static getInstance(): LocalWhisperService {
    if (!LocalWhisperService.instance) {
      LocalWhisperService.instance = new LocalWhisperService();
    }
    return LocalWhisperService.instance;
  }

  private initCleanWebRecognition(): void {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          if (this.webRecognitionInstance) {
            try {
              this.webRecognitionInstance.abort();
            } catch {}
          }

          this.webRecognitionInstance = new SpeechRecognition();
          this.webRecognitionInstance.continuous = true;
          this.webRecognitionInstance.interimResults = true;
          this.webRecognitionInstance.lang = 'en-AU';

          this.webRecognitionInstance.onresult = (event: any) => {
            let currentStepText = '';
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i][0]?.transcript) {
                currentStepText += event.results[i][0].transcript + ' ';
              }
            }
            const cleaned = currentStepText.trim();
            if (cleaned) {
              this.latestWebTranscript = cleaned;
              console.log('[Web Speech Isolated Step]:', this.latestWebTranscript);
              if (this.onInterimCallback) {
                this.onInterimCallback(cleaned);
              }
            }
          };

          this.webRecognitionInstance.onerror = (event: any) => {
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
              console.warn('[Web Speech Notice]:', event.error);
            }
          };
        } catch (e) {
          console.warn('[Web Speech] Init notice:', e);
        }
      }
    }
  }

  /**
   * Start a brand new, clean speech recognition session for the current question step
   */
  public startWebLiveTranscription(): void {
    if (Platform.OS === 'web') {
      this.latestWebTranscript = null;
      this.initCleanWebRecognition();
      if (this.webRecognitionInstance) {
        try {
          this.isListening = true;
          this.webRecognitionInstance.start();
        } catch (e) {
          // Already active
        }
      }
    }
  }

  /**
   * Stop speech recognition and extract only the audio spoken for this question
   */
  public stopWebLiveTranscription(): string | null {
    if (Platform.OS === 'web' && this.webRecognitionInstance) {
      try {
        this.isListening = false;
        this.webRecognitionInstance.stop();
      } catch (e) {}
    }
    const captured = this.latestWebTranscript;
    this.latestWebTranscript = null;
    return captured;
  }

  /**
   * Initializes the on-device Whisper model from local assets/models directory
   */
  public async initializeWhisper(customModelPath?: string): Promise<boolean> {
    if (customModelPath) this.modelPath = customModelPath;
    console.log(`[LocalWhisper] Initializing on-device Whisper STT model: ${this.modelPath}`);

    if (Platform.OS === 'web') {
      console.log('[LocalWhisper] Web preview mode active; using isolated Web Speech Recognition engine.');
      return true;
    }

    try {
      let initWhisperFn: any = null;
      try {
        const whisperModule = require('whisper.rn');
        initWhisperFn = whisperModule?.initWhisper;
      } catch {}

      if (initWhisperFn) {
        this.whisperContext = await initWhisperFn({
          filePath: this.modelPath,
        });
        this.isLoaded = true;
        console.log('[LocalWhisper] On-device Whisper context initialized successfully!');
        return true;
      }
    } catch (error) {
      console.warn('[LocalWhisper] Native Whisper init notice:', error);
    }

    this.isLoaded = false;
    return false;
  }

  public getIsLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Transcribes audio 100% on-device / in-browser with per-step buffer isolation
   */
  public async transcribeAudioFile(audioUri: string, contextPrompt?: string): Promise<string> {
    console.log(`[LocalWhisper] Transcribing step audio: ${audioUri} (Context: ${contextPrompt || 'General'})`);

    // 1. Web Speech live transcribed text for this isolated step
    if (Platform.OS === 'web') {
      const stepTranscript = this.stopWebLiveTranscription();
      if (stepTranscript && stepTranscript.trim().length > 0) {
        const cleaned = stepTranscript.trim();
        console.log('[LocalWhisper Web] Captured isolated step speech:', cleaned);
        return cleaned;
      }
    }

    // 2. Native On-Device Whisper C++ inference
    if (this.isLoaded && this.whisperContext) {
      try {
        const { promise } = this.whisperContext.transcribe(audioUri, {
          language: 'en',
          maxThreads: 4,
          prompt: contextPrompt,
        });
        const result = await promise;
        if (result && result.result) {
          const text = result.result.trim();
          console.log('[LocalWhisper] On-device transcription result:', text);
          return text;
        }
      } catch (err) {
        console.warn('[LocalWhisper] On-device transcription error, using smart fallback:', err);
      }
    }

    // 3. No speech detected or unable to transcribe
    console.log('[LocalWhisper] No speech detected in audio file.');
    return '';
  }
}

export const localWhisperService = LocalWhisperService.getInstance();
