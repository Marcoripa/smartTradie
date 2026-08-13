import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceStep, VoiceState, LocalNoteRecord } from '../types';
import { startAudioRecording, stopAudioRecording, cancelAudioRecording, releaseAudioFocus } from '../services/audio';
import { speakPrompt, stopSpeech } from '../services/tts';
import { VADTracker } from '../services/vad';
import { insertNoteRecord } from '../services/sqlite';
import { syncPendingQueue } from '../services/sync';

export function useVoiceStateMachine() {
  const [state, setState] = useState<VoiceState>({
    currentStep: VoiceStep.IDLE,
    isRecording: false,
    isSpeaking: false,
    audioMeterLevel: -160,
    speechDetected: false,
    silenceDurationMs: 0,
  });

  const vadTrackerRef = useRef(new VADTracker());
  const clientAudioRef = useRef<string | null>(null);
  const contentAudioRef = useRef<string | null>(null);
  const actionsAudioRef = useRef<string | null>(null);

  // Helper to transition state safely
  const updateState = (partial: Partial<VoiceState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  // Stop recording and save audio path for step
  const handleStepRecordingFinish = async (step: VoiceStep): Promise<string | null> => {
    const uri = await stopAudioRecording();
    updateState({ isRecording: false, audioMeterLevel: -160, silenceDurationMs: 0 });

    // Fallback URI for Web or simulator testing if recording is null
    const finalUri = uri || `mock://${step.toLowerCase()}_${Date.now()}.m4a`;

    if (step === VoiceStep.STEP_1_CLIENT_RECORDING) {
      clientAudioRef.current = finalUri;
      updateState({ clientAudioUri: finalUri });
    } else if (step === VoiceStep.STEP_2_CONTENT_RECORDING) {
      contentAudioRef.current = finalUri;
      updateState({ contentAudioUri: finalUri });
    } else if (step === VoiceStep.STEP_3_ACTIONS_RECORDING) {
      actionsAudioRef.current = finalUri;
      updateState({ actionsAudioUri: finalUri });
    }

    return finalUri;
  };

  // Start recording for a step
  const beginRecordingStep = useCallback(async (step: VoiceStep) => {
    vadTrackerRef.current.reset();
    updateState({
      currentStep: step,
      isRecording: true,
      isSpeaking: false,
      audioMeterLevel: -60,
      speechDetected: false,
      silenceDurationMs: 0,
    });

    await startAudioRecording((status) => {
      if (status.isRecording && status.metering !== undefined) {
        const vadResult = vadTrackerRef.current.processAudioLevel(status.metering);
        
        updateState({
          audioMeterLevel: status.metering,
          speechDetected: vadResult.speechDetected,
          silenceDurationMs: vadResult.silenceMs,
        });

        if (vadResult.shouldAutoAdvance) {
          console.log(`[State Machine] VAD triggered auto-advance for ${step}`);
          advanceNextStep();
        }
      }
    });
  }, []);

  // Save full note to SQLite queue
  const saveCompletedSession = async () => {
    updateState({ currentStep: VoiceStep.SAVING });

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const noteRecord: LocalNoteRecord = {
      id: noteId,
      created_at: Date.now(),
      client_audio_uri: clientAudioRef.current || `mock://client_${noteId}.m4a`,
      content_audio_uri: contentAudioRef.current || `mock://content_${noteId}.m4a`,
      actions_audio_uri: actionsAudioRef.current || `mock://actions_${noteId}.m4a`,
      status: 'PENDING_UPLOAD',
      retry_count: 0,
    };

    await insertNoteRecord(noteRecord);
    await releaseAudioFocus();

    updateState({ currentStep: VoiceStep.COMPLETED, isSpeaking: true });

    // Announce completion
    await speakPrompt(
      "Note saved offline. I'll process this when connection returns.",
      () => {
        updateState({ currentStep: VoiceStep.IDLE, isSpeaking: false });
        // Attempt background sync if online
        syncPendingQueue();
      }
    );
  };

  // Main advancement logic between steps
  const advanceNextStep = useCallback(async () => {
    const current = state.currentStep;

    if (current === VoiceStep.STEP_1_CLIENT_RECORDING) {
      await handleStepRecordingFinish(current);
      // Transition to Step 2 Prompt
      updateState({ currentStep: VoiceStep.STEP_2_CONTENT_PROMPT, isSpeaking: true });
      speakPrompt("Go ahead with your main note.", () => {
        beginRecordingStep(VoiceStep.STEP_2_CONTENT_RECORDING);
      });
    } else if (current === VoiceStep.STEP_2_CONTENT_RECORDING) {
      await handleStepRecordingFinish(current);
      // Transition to Step 3 Prompt
      updateState({ currentStep: VoiceStep.STEP_3_ACTIONS_PROMPT, isSpeaking: true });
      speakPrompt("Any follow-up action items?", () => {
        beginRecordingStep(VoiceStep.STEP_3_ACTIONS_RECORDING);
      });
    } else if (current === VoiceStep.STEP_3_ACTIONS_RECORDING) {
      await handleStepRecordingFinish(current);
      // Transition to Saving & Completion
      saveCompletedSession();
    }
  }, [state.currentStep, beginRecordingStep]);

  // Start hands-free session
  const startSession = useCallback(async () => {
    clientAudioRef.current = null;
    contentAudioRef.current = null;
    actionsAudioRef.current = null;

    updateState({
      currentStep: VoiceStep.STEP_1_CLIENT_PROMPT,
      isSpeaking: true,
      isRecording: false,
      clientAudioUri: undefined,
      contentAudioUri: undefined,
      actionsAudioUri: undefined,
      error: undefined,
    });

    speakPrompt(
      "What project or client is this note for?",
      () => {
        beginRecordingStep(VoiceStep.STEP_1_CLIENT_RECORDING);
      }
    );
  }, [beginRecordingStep]);

  // Cancel session
  const cancelSession = useCallback(async () => {
    await stopSpeech();
    await cancelAudioRecording();
    await releaseAudioFocus();

    updateState({
      currentStep: VoiceStep.IDLE,
      isRecording: false,
      isSpeaking: false,
      audioMeterLevel: -160,
      speechDetected: false,
      silenceDurationMs: 0,
    });
  }, []);

  // Force advance manually (e.g. driver hits screen button)
  const manualAdvance = useCallback(async () => {
    if (state.isRecording) {
      await advanceNextStep();
    }
  }, [state.isRecording, advanceNextStep]);

  return {
    state,
    startSession,
    cancelSession,
    manualAdvance,
  };
}
