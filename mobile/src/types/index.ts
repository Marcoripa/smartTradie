export type NoteStatus = 'PENDING_UPLOAD' | 'UPLOADING' | 'UPLOADED' | 'FAILED';

export enum VoiceStep {
  IDLE = 'IDLE',
  AUDIO_FOCUS = 'AUDIO_FOCUS',
  STEP_1_CLIENT_PROMPT = 'STEP_1_CLIENT_PROMPT',
  STEP_1_CLIENT_RECORDING = 'STEP_1_CLIENT_RECORDING',
  STEP_2_CONTENT_PROMPT = 'STEP_2_CONTENT_PROMPT',
  STEP_2_CONTENT_RECORDING = 'STEP_2_CONTENT_RECORDING',
  STEP_3_ACTIONS_PROMPT = 'STEP_3_ACTIONS_PROMPT',
  STEP_3_ACTIONS_RECORDING = 'STEP_3_ACTIONS_RECORDING',
  SAVING = 'SAVING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface LocalNoteRecord {
  id: string;
  created_at: number;
  client_audio_uri: string;
  content_audio_uri: string;
  actions_audio_uri: string;
  status: NoteStatus;
  retry_count: number;
  error_message?: string;
  backend_note_id?: string;
  structured_data_json?: string;
}

export interface StructuredNote {
  id: string;
  client_or_project: string;
  raw_transcript: {
    client: string;
    content: string;
    actions: string;
  };
  summary: string;
  action_items: string[];
  category: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
}

export interface VoiceState {
  currentStep: VoiceStep;
  isRecording: boolean;
  isSpeaking: boolean;
  audioMeterLevel: number; // dB (-160 to 0)
  speechDetected: boolean;
  silenceDurationMs: number;
  clientAudioUri?: string;
  contentAudioUri?: string;
  actionsAudioUri?: string;
  error?: string;
}
