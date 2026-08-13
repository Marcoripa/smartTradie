import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VoiceStep } from '../types';
import { Mic, Volume2, CheckCircle2, Save } from 'lucide-react-native';

interface AudioVisualizerProps {
  currentStep: VoiceStep;
  isSpeaking: boolean;
  isRecording: boolean;
  meterLevel: number;
  speechDetected: boolean;
  silenceMs: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  currentStep,
  isSpeaking,
  isRecording,
  meterLevel,
  speechDetected,
  silenceMs,
}) => {
  // Convert dB (-160 to 0) to scale ratio 1.0 to 1.8
  const normalizedLevel = Math.max(0, Math.min(1, (meterLevel + 60) / 60));
  const scaleSize = 1.0 + normalizedLevel * 0.6;
  const silenceProgress = Math.min(100, Math.round((silenceMs / 2200) * 100));

  const getStepTitle = () => {
    switch (currentStep) {
      case VoiceStep.STEP_1_CLIENT_PROMPT:
      case VoiceStep.STEP_1_CLIENT_RECORDING:
        return 'Step 1 of 3: Client & Project';
      case VoiceStep.STEP_2_CONTENT_PROMPT:
      case VoiceStep.STEP_2_CONTENT_RECORDING:
        return 'Step 2 of 3: Main Voice Note';
      case VoiceStep.STEP_3_ACTIONS_PROMPT:
      case VoiceStep.STEP_3_ACTIONS_RECORDING:
        return 'Step 3 of 3: Follow-Up Action Items';
      case VoiceStep.SAVING:
        return 'Saving Note to Local Database...';
      case VoiceStep.COMPLETED:
        return 'Note Saved Offline!';
      default:
        return 'Hands-Free Driver Ready';
    }
  };

  const getSubTitle = () => {
    if (isSpeaking) return 'Voice Guidance Speaking (Audio Ducked)...';
    if (isRecording) {
      if (speechDetected) return 'Listening to driver response...';
      if (silenceProgress > 0) return `Pause detected (${silenceProgress}%) - Auto advancing soon...`;
      return 'Waiting for speech...';
    }
    if (currentStep === VoiceStep.SAVING) return 'Writing to SQLite local queue...';
    if (currentStep === VoiceStep.COMPLETED) return 'Will auto-upload when 4G/5G coverage returns.';
    return 'Tap big button to begin hands-free questionnaire';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.stepBadge}>{getStepTitle()}</Text>
      
      {/* Big Visual Circle */}
      <View style={styles.visualContainer}>
        <View
          style={[
            styles.outerPulseRing,
            {
              transform: [{ scale: isRecording ? scaleSize : 1.0 }],
              borderColor: isSpeaking ? '#38BDF8' : speechDetected ? '#22C55E' : '#64748B',
              backgroundColor: isSpeaking
                ? 'rgba(56, 189, 248, 0.15)'
                : speechDetected
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(100, 116, 139, 0.1)',
            },
          ]}
        >
          <View
            style={[
              styles.innerCircle,
              {
                backgroundColor: isSpeaking
                  ? '#0284C7'
                  : isRecording
                  ? speechDetected
                    ? '#16A34A'
                    : '#475569'
                  : '#334155',
              },
            ]}
          >
            {isSpeaking ? (
              <Volume2 color="#FFFFFF" size={48} />
            ) : isRecording ? (
              <Mic color="#FFFFFF" size={48} />
            ) : currentStep === VoiceStep.SAVING ? (
              <Save color="#60A5FA" size={48} />
            ) : currentStep === VoiceStep.COMPLETED ? (
              <CheckCircle2 color="#4ADE80" size={48} />
            ) : (
              <Mic color="#94A3B8" size={48} />
            )}
          </View>
        </View>

        {/* Silence auto-advance progress bar */}
        {isRecording && silenceProgress > 0 && (
          <View style={styles.silenceBarContainer}>
            <View style={[styles.silenceBarFill, { width: `${silenceProgress}%` }]} />
          </View>
        )}
      </View>

      <Text style={styles.statusText}>{getSubTitle()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  stepBadge: {
    fontSize: 18,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.5,
    marginBottom: 20,
    textAlign: 'center',
  },
  visualContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  outerPulseRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  silenceBarContainer: {
    width: 160,
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    position: 'absolute',
    bottom: -10,
    overflow: 'hidden',
  },
  silenceBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 16,
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
    paddingHorizontal: 16,
  },
});
