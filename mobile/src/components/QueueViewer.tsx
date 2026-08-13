import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { LocalNoteRecord, StructuredNote } from '../types';
import { Clock, CheckCircle, AlertCircle, UploadCloud, Trash2, ChevronDown, ChevronUp, FileText, Tag, AlertTriangle } from 'lucide-react-native';
import { deleteNoteRecord } from '../services/sqlite';
import { processNoteUpload } from '../services/sync';

interface QueueViewerProps {
  notes: LocalNoteRecord[];
  onRefresh: () => void;
}

export const QueueViewer: React.FC<QueueViewerProps> = ({ notes, onRefresh }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDelete = async (id: string) => {
    await deleteNoteRecord(id);
    onRefresh();
  };

  const handleRetryUpload = async (note: LocalNoteRecord) => {
    try {
      await processNoteUpload(note);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message || 'Failed to upload note');
    }
  };

  const renderNoteItem = ({ item }: { item: LocalNoteRecord }) => {
    const isExpanded = expandedId === item.id;
    let structured: StructuredNote | null = null;
    if (item.structured_data_json) {
      try {
        structured = JSON.parse(item.structured_data_json);
      } catch (e) {
        // parsing fallback
      }
    }

    const renderStatusBadge = () => {
      switch (item.status) {
        case 'PENDING_UPLOAD':
          return (
            <View style={[styles.badge, styles.badgePending]}>
              <Clock color="#F59E0B" size={12} />
              <Text style={[styles.badgeText, { color: '#F59E0B' }]}>Queued Offline</Text>
            </View>
          );
        case 'UPLOADING':
          return (
            <View style={[styles.badge, styles.badgeUploading]}>
              <UploadCloud color="#38BDF8" size={12} />
              <Text style={[styles.badgeText, { color: '#38BDF8' }]}>Uploading...</Text>
            </View>
          );
        case 'UPLOADED':
          return (
            <View style={[styles.badge, styles.badgeUploaded]}>
              <CheckCircle color="#22C55E" size={12} />
              <Text style={[styles.badgeText, { color: '#22C55E' }]}>Synced & AI Processed</Text>
            </View>
          );
        case 'FAILED':
          return (
            <View style={[styles.badge, styles.badgeFailed]}>
              <AlertCircle color="#EF4444" size={12} />
              <Text style={[styles.badgeText, { color: '#EF4444' }]}>Upload Failed</Text>
            </View>
          );
      }
    };

    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => toggleExpand(item.id)}>
          <View style={styles.headerLeft}>
            <Text style={styles.noteTitle}>
              {structured?.client_or_project || `Voice Note #${item.id.slice(-6)}`}
            </Text>
            <Text style={styles.dateText}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
          
          <View style={styles.headerRight}>
            {renderStatusBadge()}
            {isExpanded ? <ChevronUp color="#94A3B8" size={18} /> : <ChevronDown color="#94A3B8" size={18} />}
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.cardBody}>
            <View style={styles.audioSummary}>
              <Text style={styles.sectionHeading}>Captured Audio Segments:</Text>
              <Text style={styles.audioFileText}>1. Context: {item.client_audio_uri.split('/').pop()}</Text>
              <Text style={styles.audioFileText}>2. Main Content: {item.content_audio_uri.split('/').pop()}</Text>
              <Text style={styles.audioFileText}>3. Action Items: {item.actions_audio_uri.split('/').pop()}</Text>
            </View>

            {structured && (
              <View style={styles.structuredSection}>
                <View style={styles.aiHeader}>
                  <FileText color="#38BDF8" size={16} />
                  <Text style={styles.aiHeaderTitle}>Gemini AI Structured Output</Text>
                </View>

                {structured.summary ? (
                  <View style={styles.summaryBox}>
                    <Text style={styles.summaryLabel}>Summary:</Text>
                    <Text style={styles.summaryText}>{structured.summary}</Text>
                  </View>
                ) : null}

                {structured.action_items && structured.action_items.length > 0 && (
                  <View style={styles.actionBox}>
                    <Text style={styles.summaryLabel}>Action Items:</Text>
                    {structured.action_items.map((act, idx) => (
                      <Text key={idx} style={styles.actionItemText}>
                        • {act}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.metaRow}>
                  {structured.category && (
                    <View style={styles.metaPill}>
                      <Tag color="#94A3B8" size={12} />
                      <Text style={styles.metaPillText}>{structured.category}</Text>
                    </View>
                  )}
                  {structured.urgency && (
                    <View style={styles.metaPill}>
                      <AlertTriangle color="#F59E0B" size={12} />
                      <Text style={styles.metaPillText}>Urgency: {structured.urgency}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {item.error_message && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Error: {item.error_message}</Text>
              </View>
            )}

            <View style={styles.actionsRow}>
              {(item.status === 'FAILED' || item.status === 'PENDING_UPLOAD') && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetryUpload(item)}>
                  <UploadCloud color="#FFFFFF" size={14} />
                  <Text style={styles.retryBtnText}>Retry Upload</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                <Trash2 color="#EF4444" size={14} />
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
      <Text style={styles.title}>Offline Queue & Notes ({notes.length})</Text>
      {notes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No voice notes recorded yet.</Text>
          <Text style={styles.emptySubtext}>
            Start a hands-free voice session while driving. Notes are saved offline in SQLite and synced automatically when 4G returns.
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
    marginTop: 12,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptyContainer: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  noteTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    color: '#64748B',
    fontSize: 11,
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePending: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  badgeUploading: { backgroundColor: 'rgba(56, 189, 248, 0.15)' },
  badgeUploaded: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  badgeFailed: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
  },
  sectionHeading: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  audioSummary: {
    marginBottom: 10,
  },
  audioFileText: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  structuredSection: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiHeaderTitle: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryBox: {
    marginBottom: 6,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
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
  actionItemText: {
    color: '#4ADE80',
    fontSize: 12,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  metaPillText: {
    color: '#94A3B8',
    fontSize: 10,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
  },
});
