import { useState, useEffect, useCallback } from 'react';
import { voiceStateMachine, SessionState, DriveSessionStep } from '../services/VoiceStateMachine';

export { DriveSessionStep, SessionState };

export function useVoiceStateMachine() {
  const [state, setState] = useState<SessionState>(voiceStateMachine.getState());

  useEffect(() => {
    const unsubscribe = voiceStateMachine.subscribe((newState) => {
      setState({ ...newState });
    });
    return unsubscribe;
  }, []);

  const startSession = useCallback(async () => {
    await voiceStateMachine.startSession();
  }, []);

  const cancelSession = useCallback(async () => {
    await voiceStateMachine.cancelSession();
  }, []);

  const manualAdvance = useCallback(async () => {
    if (state.isRecording) {
      await voiceStateMachine.advanceNextStep();
    }
  }, [state.isRecording]);

  return {
    state,
    startSession,
    cancelSession,
    manualAdvance,
  };
}
