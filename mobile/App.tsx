import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { sqliteQueueService, NoteQueueRecord } from './src/services/SQLiteQueueService';
import { firebaseSyncManager } from './src/services/FirebaseSyncManager';
import { wakeWordService } from './src/services/WakeWordService';
import { voiceStateMachine } from './src/services/VoiceStateMachine';
import { useVoiceStateMachine, DriveSessionStep } from './src/hooks/useVoiceStateMachine';
import { DriveModeHeader } from './src/components/DriveModeHeader';
import { AudioVisualizer } from './src/components/AudioVisualizer';
import { QueueViewer } from './src/components/QueueViewer';
import { WorkflowPickerModal } from './src/components/WorkflowPickerModal';
import { WorkflowTemplate } from './src/types/workflow';
import { DEFAULT_WORKFLOW_TEMPLATES } from './src/services/WorkflowTemplates';
import { Mic, StopCircle, SkipForward, Radio, Layers, ChevronDown } from 'lucide-react-native';

export default function App() {
  const { state, startSession, cancelSession, manualAdvance } = useVoiceStateMachine();

  const [notes, setNotes] = useState<NoteQueueRecord[]>([]);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState<boolean>(true);
  const [isWorkflowModalVisible, setIsWorkflowModalVisible] = useState<boolean>(false);

  const refreshNotes = useCallback(async () => {
    const records = await sqliteQueueService.getAllNotes();
    setNotes(records);
  }, []);

  useEffect(() => {
    async function prepareApp() {
      await sqliteQueueService.initQueueDatabase();
      await refreshNotes();
    }
    prepareApp();

    // Register wake word listener for hands-free "Hey Mark" trigger
    wakeWordService.setOnWakeWordDetected((word) => {
      console.log(`[App] 🎯 Wake word detected: "${word}", launching active workflow hands-free!`);
      startSession();
    });

    if (isWakeWordEnabled) {
      wakeWordService.startListening();
    }

    const cleanupSyncListener = firebaseSyncManager.startNetworkListener((count) => {
      console.log(`[App] ${count} notes auto-synced to Firebase!`);
      refreshNotes();
    });

    return () => {
      cleanupSyncListener();
      wakeWordService.stopListening();
    };
  }, [refreshNotes, startSession, isWakeWordEnabled]);

  const handleToggleOffline = (val: boolean) => {
    setOfflineMode(val);
    firebaseSyncManager.setSimulatedOffline(val);
  };

  const handleToggleWakeWord = (val: boolean) => {
    setIsWakeWordEnabled(val);
    wakeWordService.setEnabled(val);
  };

  const handleSelectWorkflow = (template: WorkflowTemplate) => {
    voiceStateMachine.setActiveWorkflow(template);
  };

  const handleTriggerManualSync = async () => {
    setIsSyncing(true);
    try {
      await firebaseSyncManager.syncPendingQueue();
      await refreshNotes();
    } finally {
      setIsSyncing(false);
    }
  };

  const pendingCount = notes.filter((n) => n.sync_status === 'PENDING_SYNC').length;
  const isSessionActive = state.currentStep !== DriveSessionStep.IDLE;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Top Navigation Row with Workflow Switcher */}
      <View style={styles.topNav}>
        <View style={styles.logoGroup}>
          <Radio color="#38BDF8" size={22} />
          <Text style={styles.logoText}>SmartTradie AI</Text>
        </View>

        {/* Workflow Switcher Button */}
        <TouchableOpacity
          style={styles.workflowSelectorBtn}
          onPress={() => setIsWorkflowModalVisible(true)}
          activeOpacity={0.8}
        >
          <Layers color="#C084FC" size={14} />
          <Text style={styles.workflowSelectorText} numberOfLines={1}>
            {state.activeWorkflow?.name || 'Field Engineering Note'}
          </Text>
          <ChevronDown color="#94A3B8" size={14} />
        </TouchableOpacity>
      </View>

      {/* Drive Mode, Wake Word & Offline Status Header */}
      <DriveModeHeader
        isSimulatedOffline={offlineMode}
        onToggleOffline={handleToggleOffline}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerManualSync}
        pendingCount={pendingCount}
        isWakeWordEnabled={isWakeWordEnabled}
        onToggleWakeWord={handleToggleWakeWord}
        wakeWordText="Hey Mark"
        isSessionActive={isSessionActive}
      />

      {/* Audio Visualizer Stage & Schema-Driven Step Display */}
      <AudioVisualizer
        currentStep={state.currentStep}
        executionTier={state.executionTier}
        isSpeaking={state.isSpeaking}
        isRecording={state.isRecording}
        meterLevel={state.meterLevel}
        speechDetected={state.speechDetected}
        silenceMs={state.silenceMs}
        activeWorkflow={state.activeWorkflow || DEFAULT_WORKFLOW_TEMPLATES[0]}
        currentStepIndex={state.currentStepIndex}
        totalSteps={state.totalSteps}
        currentStepDefinition={state.currentStepDefinition}
        statusMessage={state.statusMessage}
        projectNameText={state.projectNameText}
        projectStatus={state.projectStatus}
        locationData={state.locationData}
      />

      {/* Main Hands-Free Action Controls */}
      <View style={styles.controlsContainer}>
        {!isSessionActive ? (
          <TouchableOpacity
            style={styles.bigStartButton}
            onPress={() => startSession()}
            activeOpacity={0.85}
          >
            <Mic color="#FFFFFF" size={26} />
            <Text style={styles.startBtnText}>
              {isWakeWordEnabled ? 'SAY "HEY MARK" OR TAP TO START' : 'START HANDS-FREE SESSION'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeSessionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelSession}>
              <StopCircle color="#EF4444" size={18} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {state.isRecording && (
              <TouchableOpacity style={styles.nextBtn} onPress={manualAdvance}>
                <SkipForward color="#FFFFFF" size={18} />
                <Text style={styles.nextBtnText}>Done / Next Step</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* SQLite Queue & Processed Notes */}
      <QueueViewer notes={notes} onRefresh={refreshNotes} />

      {/* Dynamic Workflow Picker Modal */}
      <WorkflowPickerModal
        visible={isWorkflowModalVisible}
        onClose={() => setIsWorkflowModalVisible(false)}
        activeWorkflowId={state.activeWorkflow?.id || 'workflow_voice_note'}
        onSelectWorkflow={handleSelectWorkflow}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  workflowSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    maxWidth: '52%',
  },
  workflowSelectorText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  controlsContainer: {
    marginVertical: 6,
    alignItems: 'center',
  },
  bigStartButton: {
    backgroundColor: '#0284C7',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeSessionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelBtnText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
  nextBtn: {
    flex: 2,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
