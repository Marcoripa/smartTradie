export interface VADConfig {
  silenceThresholdDb: number;
  requiredSilenceMs: number;
  minSpeechDurationMs: number;
  maxRecordingMs: number; // Safety timeout e.g. 60 seconds
}

export const DEFAULT_VAD_CONFIG: VADConfig = {
  silenceThresholdDb: -38, // dB threshold for ambient car noise vs speech
  requiredSilenceMs: 2200, // 2.2 seconds of quiet auto-advances
  minSpeechDurationMs: 600, // minimum speech required before auto-advance triggers
  maxRecordingMs: 90000, // 90 second hard limit per step
};

export class VADTracker {
  private config: VADConfig;
  private hasStartedSpeaking = false;
  private speechStartTime = 0;
  private silenceStartTime = 0;
  private recordingStartTime = 0;

  constructor(config: Partial<VADConfig> = {}) {
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
    this.reset();
  }

  public reset() {
    this.hasStartedSpeaking = false;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    this.recordingStartTime = Date.now();
  }

  public processAudioLevel(meteringDb: number | undefined): {
    speechDetected: boolean;
    hasStartedSpeaking: boolean;
    silenceMs: number;
    shouldAutoAdvance: boolean;
    isTimeout: boolean;
  } {
    const now = Date.now();
    const db = meteringDb !== undefined ? meteringDb : -160;
    
    // Normalize metering: if metering is between 0 and 1, convert to approx dB
    const effectiveDb = db >= 0 && db <= 1 ? (db > 0.01 ? 20 * Math.log10(db) : -60) : db;
    const isVoice = effectiveDb > this.config.silenceThresholdDb;

    // Timeout check
    if (now - this.recordingStartTime > this.config.maxRecordingMs) {
      return {
        speechDetected: false,
        hasStartedSpeaking: this.hasStartedSpeaking,
        silenceMs: 0,
        shouldAutoAdvance: true,
        isTimeout: true,
      };
    }

    if (isVoice) {
      if (!this.hasStartedSpeaking) {
        this.hasStartedSpeaking = true;
        this.speechStartTime = now;
      }
      this.silenceStartTime = 0; // Reset silence clock
      return {
        speechDetected: true,
        hasStartedSpeaking: true,
        silenceMs: 0,
        shouldAutoAdvance: false,
        isTimeout: false,
      };
    } else {
      // Ambient silence or quiet
      if (this.hasStartedSpeaking) {
        const speechDuration = now - this.speechStartTime;
        if (speechDuration >= this.config.minSpeechDurationMs) {
          if (this.silenceStartTime === 0) {
            this.silenceStartTime = now;
          }
          const silenceMs = now - this.silenceStartTime;
          const shouldAutoAdvance = silenceMs >= this.config.requiredSilenceMs;

          return {
            speechDetected: false,
            hasStartedSpeaking: true,
            silenceMs,
            shouldAutoAdvance,
            isTimeout: false,
          };
        }
      }

      return {
        speechDetected: false,
        hasStartedSpeaking: this.hasStartedSpeaking,
        silenceMs: 0,
        shouldAutoAdvance: false,
        isTimeout: false,
      };
    }
  }
}
