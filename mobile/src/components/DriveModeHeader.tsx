import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { ShieldCheck, Wifi, WifiOff, Volume2, RefreshCw } from 'lucide-react-native';

interface DriveModeHeaderProps {
  isSimulatedOffline: boolean;
  onToggleOffline: (val: boolean) => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  pendingCount: number;
}

export const DriveModeHeader: React.FC<DriveModeHeaderProps> = ({
  isSimulatedOffline,
  onToggleOffline,
  isSyncing,
  onTriggerSync,
  pendingCount,
}) => {
  return (
    <View style={styles.headerCard}>
      <View style={styles.topRow}>
        <View style={styles.safetyTag}>
          <ShieldCheck color="#22C55E" size={16} />
          <Text style={styles.safetyText}>AUS ROAD RULES COMPLIANT (HANDS-FREE)</Text>
        </View>

        <View style={styles.audioFocusPill}>
          <Volume2 color="#38BDF8" size={14} />
          <Text style={styles.audioFocusText}>AUDIO DUCKING READY</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.controlsRow}>
        <View style={styles.networkStatus}>
          {isSimulatedOffline ? (
            <WifiOff color="#EF4444" size={20} />
          ) : (
            <Wifi color="#22C55E" size={20} />
          )}
          <View style={styles.networkTextGroup}>
            <Text style={styles.networkTitle}>
              {isSimulatedOffline ? 'Simulated Regional Offline (No 4G/5G)' : '4G / 5G Connected'}
            </Text>
            <Text style={styles.networkSub}>
              {isSimulatedOffline
                ? `${pendingCount} note(s) queued in local SQLite`
                : 'Auto-sync active'}
            </Text>
          </View>
        </View>

        <View style={styles.toggleGroup}>
          <Text style={styles.toggleLabel}>Simulate Offline</Text>
          <Switch
            value={isSimulatedOffline}
            onValueChange={onToggleOffline}
            trackColor={{ false: '#334155', true: '#DC2626' }}
            thumbColor={isSimulatedOffline ? '#F87171' : '#94A3B8'}
          />
        </View>
      </View>

      {!isSimulatedOffline && pendingCount > 0 && (
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={onTriggerSync}
          disabled={isSyncing}
        >
          <RefreshCw color="#FFFFFF" size={16} style={isSyncing ? styles.spin : undefined} />
          <Text style={styles.syncBtnText}>
            {isSyncing ? 'Uploading Local Queue...' : `Sync ${pendingCount} Queued Notes Now`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  safetyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  safetyText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  audioFocusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  audioFocusText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  networkTextGroup: {
    flex: 1,
  },
  networkTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  networkSub: {
    color: '#94A3B8',
    fontSize: 11,
  },
  toggleGroup: {
    alignItems: 'flex-end',
  },
  toggleLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginBottom: 2,
  },
  syncBtn: {
    marginTop: 12,
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  syncBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  spin: {
    opacity: 0.8,
  },
});
