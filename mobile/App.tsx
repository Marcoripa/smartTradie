import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  Modal,
} from 'react-native';
import { initDatabase, getAllNotesRecords } from './src/services/sqlite';
import {
  setupNetworkSyncListener,
  setSimulatedOffline,
  isSimulatedOffline,
  syncPendingQueue,
  setBackendUrl,
  getBackendUrl,
} from './src/services/sync';
import { useVoiceStateMachine } from './src/hooks/useVoiceStateMachine';
import { VoiceStep, LocalNoteRecord } from './src/types';
import { DriveModeHeader } from './src/components/DriveModeHeader';
import { AudioVisualizer } from './src/components/AudioVisualizer';
import { QueueViewer } from './src/components/QueueViewer';
import { Mic, StopCircle, SkipForward, Settings, Radio } from 'lucide-react-native';

export default function App() {
  const { state, startSession, cancelSession, manualAdvance } = useVoiceStateMachine();

  const [notes, setNotes] = useState<LocalNoteRecord[]>([]);
  const [offlineMode, setOfflineMode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [backendIp, setBackendIp] = useState<string>(getBackendUrl());

  const refreshNotes = useCallback(async () => {
    const records = await getAllNotesRecords();
    setNotes(records);
  }, []);

  useEffect(() => {
    async function prepareApp() {
      await initDatabase();
      await refreshNotes();
    }
    prepareApp();

    const cleanupSyncListener = setupNetworkSyncListener((count) => {
      console.log(`[App] ${count} notes auto-synced upon 4G/5G reconnection!`);
      refreshNotes();
    });

    return () => {
      cleanupSyncListener();
    };
  }, [refreshNotes]);

  const handleToggleOffline = (val: boolean) => {
    setOfflineMode(val);
    setSimulatedOffline(val);
  };

  const handleTriggerManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncPendingQueue();
      await refreshNotes();
    } finally {
      setIsSyncing(false);
    }
  };

  const saveSettings = () => {
    setBackendUrl(backendIp);
    setShowSettings(false);
  };

  const pendingCount = notes.filter(
    (n) => n.status === 'PENDING_UPLOAD' || n.status === 'FAILED'
  ).length;

  const isSessionActive = state.currentStep !== VoiceStep.IDLE;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Top Navigation */}
      <View style={styles.topNav}>
        <View style={styles.logoGroup}>
          <Radio color="#38BDF8" size={24} />
          <Text style={styles.logoText}>SmartTradie Voice</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => setShowSettings(true)}>
          <Settings color="#94A3B8" size={20} />
        </TouchableOpacity>
      </View>

      {/* Drive Mode & Offline Status Header */}
      <DriveModeHeader
        isSimulatedOffline={offlineMode}
        onToggleOffline={handleToggleOffline}
        isSyncing={isSyncing}
        onTriggerSync={handleTriggerManualSync}
        pendingCount={pendingCount}
      />

      {/* Audio Visualizer Stage */}
      <AudioVisualizer
        currentStep={state.currentStep}
        isSpeaking={state.isSpeaking}
        isRecording={state.isRecording}
        meterLevel={state.audioMeterLevel}
        speechDetected={state.speechDetected}
        silenceMs={state.silenceDurationMs}
      />

      {/* Main Hands-Free Action Controls */}
      <View style={styles.controlsContainer}>
        {!isSessionActive ? (
          <TouchableOpacity
            style={styles.bigStartButton}
            onPress={startSession}
            activeOpacity={0.85}
          >
            <Mic color="#FFFFFF" size={32} />
            <Text style={styles.startBtnText}>START HANDS-FREE SESSION</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeSessionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelSession}>
              <StopCircle color="#EF4444" size={20} />
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {state.isRecording && (
              <TouchableOpacity style={styles.nextBtn} onPress={manualAdvance}>
                <SkipForward color="#FFFFFF" size={20} />
                <Text style={styles.nextBtnText}>Done / Next Step</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* SQLite Queue & Processed Notes */}
      <QueueViewer notes={notes} onRefresh={refreshNotes} />

      {/* Backend Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backend Connection</Text>
            <Text style={styles.modalSub}>
              Enter FastAPI server URL (e.g., http://192.168.1.X:8000 for local network testing):
            </Text>
            <TextInput
              style={styles.ipInput}
              value={backendIp}
              onChangeText={setBackendIp}
              placeholder="http://localhost:8000"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={saveSettings}>
                <Text style={styles.modalSaveText}>Save Configuration</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsBtn: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  controlsContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  bigStartButton: {
    backgroundColor: '#0284C7',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  startBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeSessionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 14,
    borderRadius: 12,
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
    fontSize: 14,
  },
  nextBtn: {
    flex: 2,
    backgroundColor: '#16A34A',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
  },
  ipInput: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalSaveBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
});
