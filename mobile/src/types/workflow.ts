export type WorkflowStepType =
  | 'PROJECT_SELECT'
  | 'YES_NO_QUESTION'
  | 'FREE_TEXT_SUMMARY'
  | 'STRUCTURED_EXTRACTION'
  | 'LOCATION_CAPTURE'
  | 'ACTION_ITEMS_CHECKLIST';

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  prompt: string;
  type: WorkflowStepType;
  extractionGoal?: string; // Guidance prompt for Llama reasoning
  placeholderFallback?: string;
  required?: boolean;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string; // Icon identifier e.g. 'FileText', 'Clock', 'Package', 'ShieldAlert'
  triggerPhrases: string[];
  steps: WorkflowStepDefinition[];
  completionMessage: string;
  completionAction: string; // e.g. 'SAVE_VOICE_NOTE' | 'CLOCK_JOB_TIME' | 'DEDUCT_MATERIALS' | 'SAFETY_LOG'
}

export interface WorkflowExecutionResult {
  id: string;
  workflowId: string;
  workflowTitle: string;
  timestamp: string;
  projectName: string;
  isNewProject?: boolean;
  projectStatus?: string;
  latitude?: number;
  longitude?: number;
  locationAddress?: string;
  audioFilePath: string;
  extractedData: Record<string, any>; // Key-value map of stepId -> extracted value
  summaryText: string;
  syncStatus: 'PENDING_SYNC' | 'SYNCING' | 'SYNCED';
  firestoreDocId?: string;
  firebaseStorageUrl?: string;
  errorMessage?: string;
}
