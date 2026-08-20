import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Wifi, WifiOff, RefreshCw, User } from 'lucide-react-native';
import { appConfigService } from '../config/appConfig';

interface DriveModeHeaderProps {
  isSimulatedOffline: boolean;
  onToggleOffline: (val: boolean) => void;
  isSyncing: boolean;
  onTriggerSync: () => void;
  pendingCount: number;
  wakeWordText?: string;
  isSessionActive?: boolean;
}

export const DriveModeHeader: React.FC<DriveModeHeaderProps> = ({
  isSimulatedOffline,
  onToggleOffline,
  isSyncing,
  onTriggerSync,
  pendingCount,
  wakeWordText = 'Hey Mark',
  isSessionActive = false,
}) => {
  const userName = appConfigService.getUserName();
  const businessName = appConfigService.getBusinessName();

  return (
    <View style={styles.headerCard}>
      {/* Top Road Safety & User Profile Status */}
      <View style={styles.topRow}>
        <View style={styles.userProfilePill}>
          <User color="#38BDF8" size={13} />
          <Text style={styles.userProfileText}>{userName}</Text>
          <Text style={styles.userProfileSub}>• {businessName}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Network Connectivity & Offline Simulation */}
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
                : `Synced with Cloud`}
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
    padding: 14,
    marginBottom: 12,
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
  userProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  userProfileText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
  },
  userProfileSub: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wakeWordStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activeEarPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  activeIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDotListening: {
    backgroundColor: '#22C55E',
  },
  activeDotBusy: {
    backgroundColor: '#38BDF8',
  },
  activeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
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
    marginTop: 10,
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
