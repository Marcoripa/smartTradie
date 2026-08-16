import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { NoteQueueRecord, sqliteQueueService } from '../services/SQLiteQueueService';
import { firebaseSyncManager } from '../services/FirebaseSyncManager';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  UploadCloud,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  HardDrive,
  Cloud,
  FolderPlus,
  FolderCheck,
  FolderSync,
  Layers,
} from 'lucide-react-native';

interface QueueViewerProps {
  notes: NoteQueueRecord[];
  onRefresh: () => void;
}

export const QueueViewer: React.FC<QueueViewerProps> = ({ notes, onRefresh }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDelete = async (id: string) => {
    await sqliteQueueService.deleteNote(id);
    onRefresh();
  };

  const handleRetryUpload = async (note: NoteQueueRecord) => {
    try {
      await firebaseSyncManager.syncSingleNote(note);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Firebase Sync Error', e?.message || 'Failed to sync note');
    }
  };

  const renderNoteItem = ({ item }: { item: NoteQueueRecord }) => {
    const isExpanded = expandedId === item.id;
    let actionItemsArray: string[] = [];
    try {
      actionItemsArray = JSON.parse(item.action_items);
    } catch {
      actionItemsArray = item.action_items ? [item.action_items] : [];
    }

    let structuredMap: Record<string, any> = {};
    if (item.structured_data) {
      try {
        structuredMap = JSON.parse(item.structured_data);
      } catch {}
    }

    const renderSyncBadge = () => {
      switch (item.sync_status) {
        case 'PENDING_SYNC':
          return (
            <View style={[styles.badge, styles.badgePending]}>
              <Clock color="#F59E0B" size={11} />
              <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Queued</Text>
            </View>
          );
        case 'SYNCING':
          return (
            <View style={[styles.badge, styles.badgeUploading]}>
              <UploadCloud color="#38BDF8" size={11} />
              <Text style={[styles.badgeText, { color: '#38BDF8' }]}>Syncing...</Text>
            </View>
          );
        case 'SYNCED':
          return (
            <View style={[styles.badge, styles.badgeUploaded]}>
              <CheckCircle color="#22C55E" size={11} />
              <Text style={[styles.badgeText, { color: '#22C55E' }]}>Synced</Text>
            </View>
          );
        default:
          return null;
      }
    };

    const renderProjectBadge = () => {
      switch (item.project_status) {
        case 'NEW_PROJECT':
          return (
            <View style={[styles.projectBadge, styles.projectBadgeNew]}>
              <FolderPlus color="#38BDF8" size={11} />
              <Text style={[styles.projectBadgeText, { color: '#38BDF8' }]}>New</Text>
            </View>
          );
        case 'MATCHED':
          return (
            <View style={[styles.projectBadge, styles.projectBadgeMatched]}>
              <FolderCheck color="#22C55E" size={11} />
              <Text style={[styles.projectBadgeText, { color: '#22C55E' }]}>Matched</Text>
            </View>
          );
        case 'EXISTING_PENDING_MATCH':
          return (
            <View style={[styles.projectBadge, styles.projectBadgeDraft]}>
              <FolderSync color="#F59E0B" size={11} />
              <Text style={[styles.projectBadgeText, { color: '#F59E0B' }]}>Draft</Text>
            </View>
          );
        default:
          return null;
      }
    };

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={styles.headerLeft}>
            {/* Workflow Name Pill */}
            <View style={styles.workflowRow}>
              <View style={styles.wfBadge}>
                <Layers color="#C084FC" size={10} />
                <Text style={styles.wfBadgeText}>{item.workflow_title || 'Field Engineering Note'}</Text>
              </View>
              {renderProjectBadge()}
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.noteTitle}>{item.project_name || `Log #${item.id.slice(-6)}`}</Text>
            </View>
            <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleString()}</Text>
          </View>
          
          <View style={styles.headerRight}>
            {renderSyncBadge()}
            {isExpanded ? <ChevronUp color="#94A3B8" size={18} /> : <ChevronDown color="#94A3B8" size={18} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            {/* Llama Reasoned Content */}
            <View style={styles.structuredSection}>
              <View style={styles.aiHeader}>
                <FileText color="#A855F7" size={15} />
                <Text style={styles.aiHeaderTitle}>On-Device Llama 3.2 Reasoning</Text>
              </View>

              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Workflow Summary:</Text>
                <Text style={styles.summaryText}>{item.raw_transcript}</Text>
              </View>

              {/* Action items or structured checklist */}
              {actionItemsArray.length > 0 && (
                <View style={styles.actionBox}>
                  <View style={styles.actionHeader}>
                    <ListChecks color="#4ADE80" size={13} />
                    <Text style={styles.actionHeading}>Extracted Fields & Actions:</Text>
                  </View>
                  {actionItemsArray.map((act, idx) => (
                    <Text key={idx} style={styles.actionItemText}>
                      • {act}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            {/* Audio storage & Firebase details */}
            <View style={styles.audioSummary}>
              {item.latitude && item.longitude ? (
                <View style={styles.pathRow}>
                  <HardDrive color="#38BDF8" size={12} />
                  <Text style={styles.audioFileText}>
                    GPS: {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)} ({item.location_type || 'GPS_CURRENT'})
                  </Text>
                </View>
              ) : item.location_address ? (
                <View style={styles.pathRow}>
                  <HardDrive color="#F59E0B" size={12} />
                  <Text style={styles.audioFileText}>Address: {item.location_address}</Text>
                </View>
              ) : null}

              <View style={styles.pathRow}>
                <HardDrive color="#94A3B8" size={12} />
                <Text style={styles.audioFileText}>Audio: {item.audio_file_path.split('/').pop()}</Text>
              </View>
              {item.firestore_doc_id && (
                <View style={styles.pathRow}>
                  <Cloud color="#38BDF8" size={12} />
                  <Text style={styles.audioFileText}>Firestore Doc: {item.firestore_doc_id}</Text>
                </View>
              )}
            </View>

            {item.error_message && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Error: {item.error_message}</Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              {item.sync_status !== 'SYNCED' && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetryUpload(item)}>
                  <UploadCloud color="#FFFFFF" size={13} />
                  <Text style={styles.retryBtnText}>Sync to Firebase</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Trash2 color="#EF4444" size={13} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Offline Workflow Queue ({notes.length})</Text>
      {notes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No offline workflow logs recorded yet.</Text>
          <Text style={styles.emptySubtext}>
            Say "Hey Mark" or tap start. Voice workflows (Notes, Materials, Timesheets, Safety) run on-device and sync when connected.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          renderItem={renderNoteItem}
          contentContainerStyle={{ gap: 10, paddingBottom: 30 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 8,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyContainer: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  workflowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  wfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  wfBadgeText: {
    color: '#C084FC',
    fontSize: 10,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  noteTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  badgeUploading: { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
  badgeUploaded: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  badgeFailed: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  badgeText: { fontSize: 10, fontWeight: '600' },
  projectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  projectBadgeNew: { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
  projectBadgeMatched: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  projectBadgeDraft: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  projectBadgeText: { fontSize: 9, fontWeight: '700' },
  cardBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 8,
  },
  structuredSection: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  aiHeaderTitle: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
  },
  summaryBox: {
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  summaryText: {
    color: '#E2E8F0',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  actionBox: {
    marginTop: 4,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  actionHeading: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  actionItemText: {
    color: '#4ADE80',
    fontSize: 11,
    marginTop: 2,
  },
  audioSummary: {
    marginVertical: 4,
    gap: 3,
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  audioFileText: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 6,
    borderRadius: 6,
    marginVertical: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
  },
});
