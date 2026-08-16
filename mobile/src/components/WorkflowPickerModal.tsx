import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { WorkflowTemplate } from '../types/workflow';
import { DEFAULT_WORKFLOW_TEMPLATES } from '../services/WorkflowTemplates';
import {
  FileText,
  Clock,
  Package,
  ShieldAlert,
  X,
  Check,
  ChevronRight,
  Layers,
} from 'lucide-react-native';

interface WorkflowPickerModalProps {
  visible: boolean;
  onClose: () => void;
  activeWorkflowId: string;
  onSelectWorkflow: (template: WorkflowTemplate) => void;
}

export const WorkflowPickerModal: React.FC<WorkflowPickerModalProps> = ({
  visible,
  onClose,
  activeWorkflowId,
  onSelectWorkflow,
}) => {
  const getIcon = (iconName: string, isSelected: boolean) => {
    const color = isSelected ? '#38BDF8' : '#94A3B8';
    switch (iconName) {
      case 'Clock':
        return <Clock color={color} size={22} />;
      case 'Package':
        return <Package color={color} size={22} />;
      case 'ShieldAlert':
        return <ShieldAlert color={color} size={22} />;
      default:
        return <FileText color={color} size={22} />;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Layers color="#38BDF8" size={20} />
              <Text style={styles.headerTitle}>Select Business Workflow</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#94A3B8" size={20} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Switch voice QA purpose (or say trigger phrase e.g. "Clock in" / "Materials used"):
          </Text>

          {/* Workflow List */}
          <ScrollView style={styles.listContainer} contentContainerStyle={{ gap: 10 }}>
            {DEFAULT_WORKFLOW_TEMPLATES.map((wf) => {
              const isSelected = wf.id === activeWorkflowId;
              return (
                <TouchableOpacity
                  key={wf.id}
                  style={[styles.workflowCard, isSelected && styles.workflowCardSelected]}
                  onPress={() => {
                    onSelectWorkflow(wf);
                    onClose();
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.iconContainer}>
                    {getIcon(wf.icon, isSelected)}
                  </View>

                  <View style={styles.infoContainer}>
                    <View style={styles.cardTopRow}>
                      <Text style={[styles.workflowName, isSelected && styles.workflowNameSelected]}>
                        {wf.name}
                      </Text>
                      {isSelected ? (
                        <View style={styles.activeTag}>
                          <Check color="#38BDF8" size={12} />
                          <Text style={styles.activeTagText}>ACTIVE</Text>
                        </View>
                      ) : (
                        <ChevronRight color="#64748B" size={16} />
                      )}
                    </View>

                    <Text style={styles.categoryText}>{wf.category}</Text>
                    <Text style={styles.descriptionText}>{wf.description}</Text>

                    <View style={styles.stepsBadge}>
                      <Text style={styles.stepsBadgeText}>
                        {wf.steps.length} Voice Steps ({wf.steps.map((s) => s.name).join(' → ')})
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 16,
  },
  listContainer: {
    marginBottom: 10,
  },
  workflowCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  workflowCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
  },
  iconContainer: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    padding: 10,
    borderRadius: 10,
    marginTop: 2,
  },
  infoContainer: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workflowName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  workflowNameSelected: {
    color: '#38BDF8',
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeTagText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  categoryText: {
    color: '#A855F7',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  descriptionText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  stepsBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  stepsBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
});
