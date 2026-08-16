import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DriveSessionStep, ExecutionTier } from '../services/VoiceStateMachine';
import { ProjectResolutionStatus } from '../services/SQLiteQueueService';
import { LocationData } from '../services/LocationService';
import { WorkflowTemplate, WorkflowStepDefinition } from '../types/workflow';
import {
  Mic,
  Volume2,
  CheckCircle2,
  Save,
  Cpu,
  Sparkles,
  FolderPlus,
  FolderCheck,
  FolderSync,
  Navigation,
  MapPin,
  Layers,
} from 'lucide-react-native';

interface AudioVisualizerProps {
  currentStep: DriveSessionStep;
  executionTier: ExecutionTier;
  isSpeaking: boolean;
  isRecording: boolean;
  meterLevel: number;
  speechDetected: boolean;
  silenceMs: number;
  activeWorkflow: WorkflowTemplate;
  currentStepIndex: number;
  totalSteps: number;
  currentStepDefinition?: WorkflowStepDefinition;
  statusMessage?: string;
  projectNameText?: string;
  projectStatus?: ProjectResolutionStatus;
  locationData?: LocationData;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  currentStep,
  executionTier,
  isSpeaking,
  isRecording,
  meterLevel,
  speechDetected,
  silenceMs,
  activeWorkflow,
  currentStepIndex,
  totalSteps,
  currentStepDefinition,
  statusMessage,
  projectNameText,
  projectStatus,
  locationData,
}) => {
  const normalizedLevel = Math.max(0, Math.min(1, (meterLevel + 60) / 60));
  const scaleSize = 1.0 + normalizedLevel * 0.6;
  const silenceProgress = Math.min(100, Math.round((silenceMs / 2200) * 100));

  const isReasoning =
    currentStep === DriveSessionStep.Q1_PROJECT_TYPE_REASONING ||
    currentStep === DriveSessionStep.UNIVERSAL_HELP_ROUTER_REASONING ||
    currentStep === DriveSessionStep.WORKFLOW_STEP_REASONING ||
    currentStep === DriveSessionStep.CONFIRM_CANCEL_REASONING;

  const getStepTitle = () => {
    switch (currentStep) {
      case DriveSessionStep.HARDWARE_CHECK:
        return 'Starting Hands-Free Session...';
      case DriveSessionStep.Q1_PROJECT_TYPE_PROMPT:
      case DriveSessionStep.Q1_PROJECT_TYPE_RECORDING:
        return 'Step 1: Is this for a new project?';
      case DriveSessionStep.Q1_PROJECT_TYPE_REASONING:
        return 'Llama 3.2: Evaluating Project Intent...';
      case DriveSessionStep.Q1A_NEW_NAME_RECORDING:
        return 'Step 1A: What is the new project name?';
      case DriveSessionStep.Q1B_EXISTING_NAME_RECORDING:
        return 'Step 1B: Search Existing Project Name';
      case DriveSessionStep.Q2_LOC_VERIFY_RECORDING:
        return 'Step 1C: Location Verification (GPS)';
      case DriveSessionStep.Q2A_ADDRESS_RECORDING:
        return 'Step 1D: Manual Site Address';
      case DriveSessionStep.UNIVERSAL_HELP_ROUTER_PROMPT:
      case DriveSessionStep.UNIVERSAL_HELP_ROUTER_RECORDING:
        return 'Step 2: "How can I help you today?"';
      case DriveSessionStep.UNIVERSAL_HELP_ROUTER_REASONING:
        return 'Llama 3.2: Routing Spoken Intent...';
      case DriveSessionStep.CONFIRM_CANCEL_PROMPT:
      case DriveSessionStep.CONFIRM_CANCEL_RECORDING:
        return 'Cancel Session? (Say Yes or No)';
      case DriveSessionStep.CONFIRM_CANCEL_REASONING:
        return 'Llama 3.2: Evaluating Cancel Confirmation...';
      case DriveSessionStep.WORKFLOW_STEP_PROMPT:
      case DriveSessionStep.WORKFLOW_STEP_RECORDING:
        return `${activeWorkflow.name} • Step ${currentStepIndex + 1} of ${totalSteps}: ${currentStepDefinition?.name || 'Input'}`;
      case DriveSessionStep.WORKFLOW_STEP_REASONING:
        return `Llama 3.2 Reasoning (${currentStepDefinition?.name || 'Extraction'})...`;
      case DriveSessionStep.SAVING_QUEUE:
        return `Saving to SQLite Queue (${activeWorkflow.name})...`;
      case DriveSessionStep.SESSION_COMPLETE:
        return `${activeWorkflow.name} Completed!`;
      default:
        return `Hands-Free Ready • ${activeWorkflow.name}`;
    }
  };

  const getSubTitle = () => {
    if (statusMessage) return statusMessage;
    if (isSpeaking) return 'Voice Guidance Speaking (Audio Ducked)...';
    if (isRecording) {
      if (speechDetected) return 'Listening to driver response...';
      if (silenceProgress > 0) return `Pause detected (${silenceProgress}%) - Auto advancing soon...`;
      return 'Waiting for speech...';
    }
    return `Say "Hey Mark" or tap to start ${activeWorkflow.name}`;
  };

  return (
    <View style={styles.container}>
      {/* Active Workflow Badge */}
      <View style={styles.workflowTag}>
        <Layers color="#38BDF8" size={12} />
        <Text style={styles.workflowTagText}>{activeWorkflow.name.toUpperCase()}</Text>
      </View>

      <Text style={styles.stepBadge}>{getStepTitle()}</Text>

      {/* Model indicator pill */}
      <View style={styles.tierPill}>
        <Cpu color="#38BDF8" size={11} />
        <Text style={styles.tierPillText}>
          {executionTier === 'LOCAL_AI'
            ? '100% On-Device AI (Llama 3.2 / Whisper)'
            : 'Tier 2: Scripted Fallback Engine'}
        </Text>
      </View>
      
      {/* Visualizer Circle */}
      <View style={styles.visualContainer}>
        <View
          style={[
            styles.outerPulseRing,
            {
              transform: [{ scale: isRecording ? scaleSize : 1.0 }],
              borderColor: isReasoning
                ? '#A855F7'
                : isSpeaking
                ? '#38BDF8'
                : speechDetected
                ? '#22C55E'
                : '#64748B',
              backgroundColor: isReasoning
                ? 'rgba(168, 85, 247, 0.2)'
                : isSpeaking
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
                backgroundColor: isReasoning
                  ? '#9333EA'
                  : isSpeaking
                  ? '#0284C7'
                  : isRecording
                  ? speechDetected
                    ? '#16A34A'
                    : '#475569'
                  : '#334155',
              },
            ]}
          >
            {isReasoning ? (
              <Sparkles color="#FFFFFF" size={44} />
            ) : isSpeaking ? (
              <Volume2 color="#FFFFFF" size={44} />
            ) : isRecording ? (
              <Mic color="#FFFFFF" size={44} />
            ) : currentStep === DriveSessionStep.SAVING_QUEUE ? (
              <Save color="#60A5FA" size={44} />
            ) : currentStep === DriveSessionStep.SESSION_COMPLETE ? (
              <CheckCircle2 color="#4ADE80" size={44} />
            ) : (
              <Mic color="#94A3B8" size={44} />
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

      {/* Meta tags container */}
      <View style={styles.tagsContainer}>
        {projectNameText ? (
          <View style={styles.extractedTag}>
            {projectStatus === 'NEW_PROJECT' ? (
              <FolderPlus color="#38BDF8" size={13} />
            ) : projectStatus === 'MATCHED' ? (
              <FolderCheck color="#22C55E" size={13} />
            ) : (
              <FolderSync color="#F59E0B" size={13} />
            )}
            <Text style={styles.extractedLabel}>
              {projectStatus === 'NEW_PROJECT'
                ? 'New Project:'
                : projectStatus === 'MATCHED'
                ? 'Matched:'
                : 'Draft:'}
            </Text>
            <Text style={styles.extractedValue}>{projectNameText}</Text>
          </View>
        ) : null}

        {locationData ? (
          <View style={styles.locationTag}>
            {locationData.locationType === 'GPS_CURRENT' ? (
              <Navigation color="#38BDF8" size={12} />
            ) : (
              <MapPin color="#F59E0B" size={12} />
            )}
            <Text style={styles.locationText}>
              {locationData.locationType === 'GPS_CURRENT'
                ? `GPS: ${locationData.latitude?.toFixed(4)}, ${locationData.longitude?.toFixed(4)}`
                : `Address: ${locationData.address}`}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  workflowTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  workflowTagText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stepBadge: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
    marginBottom: 3,
    textAlign: 'center',
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  tierPillText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600',
  },
  visualContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  outerPulseRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  silenceBarContainer: {
    width: 130,
    height: 5,
    backgroundColor: '#334155',
    borderRadius: 3,
    position: 'absolute',
    bottom: -8,
    overflow: 'hidden',
  },
  silenceBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  statusText: {
    fontSize: 13,
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '500',
    paddingHorizontal: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  extractedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  extractedLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  extractedValue: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  locationText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600',
  },
});
